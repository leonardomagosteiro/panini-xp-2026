import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'
import { createAdminClient } from '../lib/supabase-admin'
import { fetchAllRows } from '../lib/paginate-query'
import { reprocessReceiptWithTextract } from '../lib/reprocess-receipt-textract'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

// Force Textract for this script's process — does NOT affect production Vercel env.
process.env.AI_EXTRACTION_PROVIDER = 'textract'
// Suppress the in-review notification email. The actual approval/rejection/reupload
// emails still fire as designed; only the "your receipt is being reviewed" email is
// skipped so it doesn't fire moments before the real outcome email.
process.env.SUPPRESS_MANUAL_REVIEW_EMAIL = '1'

const OUTPUT_FILE = path.resolve(__dirname, '../reprocess-backlog-results.json')
const PER_RECEIPT_TIMEOUT_MS = 45000

interface ReceiptRow {
  id: string
}

interface PerReceiptResult {
  id: string
  outcome: string
  elapsed_ms: number
  error: string | null
  timestamp: string
}

interface ResultsFile {
  started_at: string
  finished_at: string | null
  total_receipts: number
  results: Record<string, PerReceiptResult>
}

function loadResults(): ResultsFile {
  if (fs.existsSync(OUTPUT_FILE)) {
    return JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'))
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

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout (${ms}ms): ${label}`)), ms)
    promise.then(
      value => { clearTimeout(timer); resolve(value) },
      err => { clearTimeout(timer); reject(err) }
    )
  })
}

async function main() {
  console.log('=== Panini XP backlog reprocess ===')
  console.log(`Output file: ${OUTPUT_FILE}`)
  console.log(`AI_EXTRACTION_PROVIDER: ${process.env.AI_EXTRACTION_PROVIDER}`)
  console.log(`SUPPRESS_MANUAL_REVIEW_EMAIL: ${process.env.SUPPRESS_MANUAL_REVIEW_EMAIL}`)
  console.log('')

  const supabase = createAdminClient()
  const state = loadResults()
  const alreadyProcessed = Object.keys(state.results).length
  if (alreadyProcessed > 0) {
    console.log(`Resuming: ${alreadyProcessed} receipts already processed.`)
  }

  console.log('Fetching all needs_review receipts...')
  const all = await fetchAllRows<ReceiptRow>((from, to) =>
    supabase
      .from('receipts')
      .select('id')
      .eq('status', 'needs_review')
      .range(from, to)
  )
  state.total_receipts = all.length
  console.log(`Total needs_review: ${all.length}. To process: ${all.length - alreadyProcessed}.`)
  console.log('')

  // 5-second safety pause to let user abort if something looks wrong
  console.log('Starting in 5 seconds. Ctrl+C to abort.')
  await new Promise(resolve => setTimeout(resolve, 5000))
  console.log('')

  const startTime = Date.now()
  let processedThisRun = 0

  for (const r of all) {
    if (state.results[r.id]) continue

    const receiptStart = Date.now()
    let outcome: string
    let errorMsg: string | null = null

    try {
      const result = await withTimeout(
        reprocessReceiptWithTextract(r.id, supabase),
        PER_RECEIPT_TIMEOUT_MS,
        `receipt ${r.id}`
      )
      outcome = result.status
    } catch (err: any) {
      outcome = 'error'
      errorMsg = err.message ?? String(err)
    }

    const elapsedMs = Date.now() - receiptStart
    state.results[r.id] = {
      id: r.id,
      outcome,
      elapsed_ms: elapsedMs,
      error: errorMsg,
      timestamp: new Date().toISOString(),
    }
    processedThisRun++

    const processedTotal = Object.keys(state.results).length
    const summary = errorMsg ? `ERROR (${errorMsg})` : outcome
    console.log(`  [${processedTotal}/${all.length}] ${(elapsedMs/1000).toFixed(1)}s  ${r.id}  ${summary}`)

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

  console.log('')
  console.log('========================================')
  console.log('Reprocess complete. Summary:')
  console.log('========================================')
  const buckets: Record<string, number> = {}
  for (const r of Object.values(state.results)) {
    buckets[r.outcome] = (buckets[r.outcome] ?? 0) + 1
  }
  for (const [key, count] of Object.entries(buckets).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${count.toString().padStart(5)}  ${key}`)
  }
  console.log('')
  console.log(`Results saved to: ${OUTPUT_FILE}`)
}

main().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
