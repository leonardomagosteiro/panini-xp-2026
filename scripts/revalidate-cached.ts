import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'
import { createAdminClient } from '../lib/supabase-admin'
import { validateReceipt } from '../lib/validate-receipt'
import type { ExtractedData } from '../lib/extract-receipt'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const RESULTS_FILE = path.resolve(__dirname, '../predict-backlog-results.json')

interface CachedResult {
  id: string
  predicted_status: string
  predicted_reason: string | null
  textract_amount: number | null
  textract_cnpj: string | null
  textract_date: string | null
  textract_confidence: 'high' | 'medium' | 'low' | null
  would_send_email: boolean
  error: string | null
}

async function main() {
  if (!fs.existsSync(RESULTS_FILE)) {
    console.error(`Results file not found: ${RESULTS_FILE}`)
    process.exit(1)
  }

  const state = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf-8'))
  const cached = Object.values(state.results) as CachedResult[]
  console.log(`Loaded ${cached.length} cached extractions.\n`)

  // Fetch email-sent flags for each receipt (needed to compute would_send_email).
  // We do this in one batched query to avoid N round-trips.
  const supabase = createAdminClient()
  const ids = cached.map(c => c.id)
  const { data: rows, error } = await supabase
    .from('receipts')
    .select('id, manual_review_email_sent_at, reupload_request_sent_at')
    .in('id', ids)

  if (error) {
    console.error('Failed to fetch email flags:', error)
    process.exit(1)
  }

  const emailFlags = new Map<string, { manual: string | null; reupload: string | null }>()
  for (const row of rows ?? []) {
    emailFlags.set(row.id, {
      manual: row.manual_review_email_sent_at,
      reupload: row.reupload_request_sent_at,
    })
  }

  // Replay the validator on each cached extraction.
  const buckets: Record<string, number> = {}
  let totalEmails = 0
  let revalidationErrors = 0

  for (const c of cached) {
    if (c.error) {
      // Carry through errors from the original Textract call — can't revalidate.
      const key = `error / ${c.predicted_reason}`
      buckets[key] = (buckets[key] ?? 0) + 1
      continue
    }

    // Reconstruct an ExtractedData object from cached Textract output.
    const extracted: ExtractedData = {
      is_receipt: c.textract_cnpj !== null || c.textract_amount !== null || c.textract_date !== null,
      is_readable: c.textract_cnpj !== null || c.textract_amount !== null || c.textract_date !== null,
      cnpj: c.textract_cnpj,
      amount_total_brl: c.textract_amount,
      receipt_number: null,
      receipt_date: c.textract_date,
      confidence: c.textract_confidence ?? 'low',
      notes: '',
    }

    try {
      const validation = await validateReceipt(extracted, c.id, supabase)
      let reason: string | null = null
      let wouldSendEmail = false
      const flags = emailFlags.get(c.id)
      if (validation.status === 'needs_review') {
        reason = validation.review_reason
        wouldSendEmail = !flags?.manual
      } else if (validation.status === 'awaiting_reupload') {
        reason = validation.review_reason
        wouldSendEmail = !flags?.reupload
      } else if (validation.status === 'rejected') {
        reason = validation.reason
        wouldSendEmail = true
      } else if (validation.status === 'approved') {
        reason = `codes:${validation.codes_to_generate}`
        wouldSendEmail = true
      }
      const key = `${validation.status}${reason ? ' / ' + reason : ''}`
      buckets[key] = (buckets[key] ?? 0) + 1
      if (wouldSendEmail) totalEmails++
    } catch (err: any) {
      revalidationErrors++
      const key = `revalidation_error / ${err.message ?? 'unknown'}`
      buckets[key] = (buckets[key] ?? 0) + 1
    }
  }

  console.log('========================================')
  console.log(`Revalidated distribution (n=${cached.length})`)
  console.log('========================================')
  const sorted = Object.entries(buckets).sort((a, b) => b[1] - a[1])
  for (const [key, count] of sorted) {
    const pct = ((count / cached.length) * 100).toFixed(1)
    console.log(`  ${count.toString().padStart(5)}  (${pct}%)  ${key}`)
  }
  console.log('')
  console.log(`Emails that would be sent: ${totalEmails}`)
  console.log(`Revalidation errors: ${revalidationErrors}`)
}

main().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
