import * as dotenv from 'dotenv'
import * as path from 'path'
import { createAdminClient } from '../lib/supabase-admin'
import { fetchAllRows } from '../lib/paginate-query'
import { extractReceiptTextract } from '../lib/extract-receipt-textract'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const SAMPLE_SIZE = 5

interface ReceiptRow {
  id: string
  storage_path: string
  rejection_reason: string | null
  ai_confidence: string | null
  cnpj_on_receipt: string | null
  amount_on_receipt: number | null
}

async function main() {
  const supabase = createAdminClient()

  console.log(`Fetching all needs_review receipts...`)
  const all = await fetchAllRows<ReceiptRow>((from, to) =>
    supabase
      .from('receipts')
      .select('id, storage_path, rejection_reason, ai_confidence, cnpj_on_receipt, amount_on_receipt')
      .eq('status', 'needs_review')
      .range(from, to)
  )
  console.log(`Total needs_review receipts: ${all.length}`)

  const shuffled = [...all].sort(() => Math.random() - 0.5)
  const sample = shuffled.slice(0, SAMPLE_SIZE)
  console.log(`Sampling ${sample.length} receipts.\n`)

  for (let i = 0; i < sample.length; i++) {
    const r = sample[i]
    console.log(`============================================================`)
    console.log(`Receipt ${i + 1} of ${sample.length}: ${r.id}`)
    console.log(`============================================================`)
    console.log(`OpenAI extraction (from DB):`)
    console.log(`  CNPJ:               ${r.cnpj_on_receipt ?? '(null)'}`)
    console.log(`  amount:             ${r.amount_on_receipt ?? '(null)'}`)
    console.log(`  ai_confidence:      ${r.ai_confidence ?? '(none)'}`)
    console.log('')

    const { data: signed } = await supabase
      .storage.from('receipts').createSignedUrl(r.storage_path, 3600)
    if (signed) console.log(`  URL: ${signed.signedUrl}\n`)

    const { data: blob, error: downloadError } = await supabase
      .storage.from('receipts').download(r.storage_path)
    if (downloadError || !blob) {
      console.log(`  Textract: SKIPPED (download failed: ${downloadError?.message})\n`)
      continue
    }
    const arrayBuffer = await blob.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')

    try {
      const extracted = await extractReceiptTextract(base64, 'image/jpeg')
      console.log(`Textract -> ExtractedData:`)
      console.log(`  is_receipt:         ${extracted.is_receipt}`)
      console.log(`  is_readable:        ${extracted.is_readable}`)
      console.log(`  cnpj:               ${extracted.cnpj ?? '(null)'}`)
      console.log(`  amount_total_brl:   ${extracted.amount_total_brl ?? '(null)'}`)
      console.log(`  receipt_date:       ${extracted.receipt_date ?? '(null)'}`)
      console.log(`  receipt_number:     ${extracted.receipt_number ?? '(null)'}`)
      console.log(`  confidence:         ${extracted.confidence}`)
      console.log(`  notes:              ${extracted.notes}`)
    } catch (err: any) {
      console.log(`  Textract: ERROR (${err.message ?? err})`)
    }
    console.log('')
  }

  console.log('Comparison complete.')
}

main().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
