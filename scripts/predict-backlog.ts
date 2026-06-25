import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'
import { createAdminClient } from '../lib/supabase-admin'
import { fetchAllRows } from '../lib/paginate-query'
import { extractReceiptTextract } from '../lib/extract-receipt-textract'
import { validateReceipt } from '../lib/validate-receipt'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const OUTPUT_FILE = path.resolve(__dirname, '../predict-backlog-results.json')
const PROGRESS_EVERY = 1
const BACKOFF_MS = 2000
const PER_RECEIPT_TIMEOUT_MS = 30000

interface ReceiptRow {
  id: string
  storage_path: string
  manual_review_email_sent_at: string | null
  reupload_request_sent_at: string | null
}

interface PerReceiptResult {
  id: string
  predicted_status: 'approved' | 'rejected' | 'needs_review' | 'awaiting_reupload' | 'error'
  predicted_reason: string | null
  textract_amount: number | null
  textract_cnpj: string | null
  textract_date: string | null
  textract_confidence: 'high' | 'medium' | 'low' | null
  would_send_email: boolean
  error: string | null
}

interface ResultsFile {
  started_at: string
  finished_at: string | null
  total_receipts: number
  results: Record<string, PerReceiptResult>
}

function loadResults(): ResultsFile {
  if (fs.existsSync(OUTPUT_FILE)) {
    const raw = fs.readFileSync(OUTPUT_FILE, 'utf-8')
    return JSON.parse(raw) as ResultsFile
  }
  return {
    started_at: new Date().toISOString(),
    finished_at: null,
    total_receipts: 0,
    results: {},
  }
}

function saveResults(state: ResultsFile) {
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(state, null, 2))
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout (${ms}ms): ${label}`)), ms)
    promise.then(
      value => { clearTimeout(timer); resolve(value) },
      err => { clearTimeout(timer); reject(err) }
    )
  })
}

async function processOne(
  supabase: ReturnType<typeof createAdminClient>,
  receipt: ReceiptRow
): Promise<PerReceiptResult> {
  try {
    const { data: blob, error: dlError } = await supabase
      .storage.from('receipts').download(receipt.storage_path)
    if (dlError || !blob) {
      return {
        id: receipt.id,
        predicted_status: 'error',
        predicted_reason: 'download_failed',
        textract_amount: null,
        textract_cnpj: null,
        textract_date: null,
        textract_confidence: null,
        would_send_email: false,
        error: dlError?.message ?? 'no blob',
      }
    }
    const base64 = Buffer.from(await blob.arrayBuffer()).toString('base64')

    let extracted
    try {
      extracted = await extractReceiptTextract(base64, 'image/jpeg')
    } catch (err: any) {
      // Rate-limit: back off and retry once
      if (err.message?.includes('ProvisionedThroughputExceeded') || err.message?.includes('ThrottlingException')) {
        await sleep(BACKOFF_MS)
        extracted = await extractReceiptTextract(base64, 'image/jpeg')
      } else {
        throw err
      }
    }

    const validation = await validateReceipt(extracted, receipt.id, supabase)

    let wouldSendEmail = false
    let predictedReason: string | null = null
    if (validation.status === 'needs_review') {
      predictedReason = validation.review_reason
      wouldSendEmail = receipt.manual_review_email_sent_at === null
    } else if (validation.status === 'awaiting_reupload') {
      predictedReason = validation.review_reason
      wouldSendEmail = receipt.reupload_request_sent_at === null
    } else if (validation.status === 'rejected') {
      predictedReason = validation.reason
      wouldSendEmail = true
    } else if (validation.status === 'approved') {
      predictedReason = `codes:${validation.codes_to_generate}`
      wouldSendEmail = true
    }

    return {
      id: receipt.id,
      predicted_status: validation.status,
      predicted_reason: predictedReason,
      textract_amount: extracted.amount_total_brl,
      textract_cnpj: extracted.cnpj,
      textract_date: extracted.receipt_date,
      textract_confidence: extracted.confidence,
      would_send_email: wouldSendEmail,
      error: null,
    }
  } catch (err: any) {
    return {
      id: receipt.id,
      predicted_status: 'error',
      predicted_reason: 'exception',
      textract_amount: null,
      textract_cnpj: null,
      textract_date: null,
      textract_confidence: null,
      would_send_email: false,
      error: err.message ?? String(err),
    }
  }
}

async function main() {
  const supabase = createAdminClient()

  console.log('Loading existing results (if any)...')
  const state = loadResults()
  const alreadyProcessed = Object.keys(state.results).length
  if (alreadyProcessed > 0) {
    console.log(`Resuming: ${alreadyProcessed} receipts already processed.`)
  }

  console.log('Fetching all needs_review receipts...')
  const all = await fetchAllRows<ReceiptRow>((from, to) =>
    supabase
      .from('receipts')
      .select('id, storage_path, manual_review_email_sent_at, reupload_request_sent_at')
      .eq('status', 'needs_review')
      .range(from, to)
  )
  state.total_receipts = all.length
  console.log(`Total needs_review: ${all.length}. To process: ${all.length - alreadyProcessed}.`)
  console.log('')

  const startTime = Date.now()
  let processedThisRun = 0

  for (let i = 0; i < all.length; i++) {
    const r = all[i]
    if (state.results[r.id]) continue  // resumable

    const receiptStart = Date.now()
    let result: PerReceiptResult
    try {
      result = await withTimeout(processOne(supabase, r), PER_RECEIPT_TIMEOUT_MS, `receipt ${r.id}`)
    } catch (err: any) {
      result = {
        id: r.id,
        predicted_status: 'error',
        predicted_reason: 'timeout',
        textract_amount: null,
        textract_cnpj: null,
        textract_date: null,
        textract_confidence: null,
        would_send_email: false,
        error: err.message ?? String(err),
      }
    }
    const receiptElapsed = ((Date.now() - receiptStart) / 1000).toFixed(1)
    state.results[r.id] = result
    processedThisRun++

    const summary = result.predicted_status === 'error'
      ? `ERROR (${result.error})`
      : `${result.predicted_status}${result.predicted_reason ? ' / ' + result.predicted_reason : ''}`
    const processedTotal = Object.keys(state.results).length
    console.log(`  [${processedTotal}/${all.length}] ${receiptElapsed}s  ${r.id}  ${summary}`)

    saveResults(state)

    if (processedTotal % 25 === 0) {
      const elapsed = (Date.now() - startTime) / 1000
      const rate = processedThisRun / elapsed
      const remaining = all.length - processedTotal
      const eta = remaining / rate
      console.log(`  --- rate ${rate.toFixed(2)}/sec | ETA ${Math.round(eta)}s ---`)
    }
  }

  state.finished_at = new Date().toISOString()
  saveResults(state)

  // Aggregate summary
  console.log('')
  console.log('========================================')
  console.log('Distribution summary')
  console.log('========================================')
  const buckets: Record<string, number> = {}
  let totalEmails = 0
  for (const result of Object.values(state.results)) {
    const key = result.predicted_status + (result.predicted_reason ? ` / ${result.predicted_reason}` : '')
    buckets[key] = (buckets[key] ?? 0) + 1
    if (result.would_send_email) totalEmails++
  }
  const sorted = Object.entries(buckets).sort((a, b) => b[1] - a[1])
  for (const [key, count] of sorted) {
    const pct = ((count / all.length) * 100).toFixed(1)
    console.log(`  ${count.toString().padStart(5)}  (${pct}%)  ${key}`)
  }
  console.log('')
  console.log(`Emails that would be sent: ${totalEmails}`)
  console.log(`Results saved to: ${OUTPUT_FILE}`)
}

main().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
