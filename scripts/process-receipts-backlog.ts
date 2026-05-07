import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ANTHROPIC_API_KEY',
  'RESEND_API_KEY',
] as const

const missing = REQUIRED_ENV_VARS.filter(v => !process.env[v])
if (missing.length > 0) {
  console.error(`Missing required env vars: ${missing.join(', ')}. Check your .env.local file.`)
  process.exit(1)
}

// --- Arg parsing ---

const args = process.argv.slice(2)

const dryRun = args.includes('--dry-run')

const limitIdx = args.indexOf('--limit')
let limit: number | null = null
if (limitIdx !== -1) {
  const parsed = parseInt(args[limitIdx + 1], 10)
  if (isNaN(parsed) || parsed <= 0) {
    console.error('--limit must be a positive integer.')
    process.exit(1)
  }
  limit = parsed
}

const stopRateIdx = args.indexOf('--stop-on-error-rate')
let stopOnErrorRate = 0.1
if (stopRateIdx !== -1) {
  const parsed = parseFloat(args[stopRateIdx + 1])
  if (isNaN(parsed) || parsed < 0 || parsed > 1) {
    console.error('--stop-on-error-rate must be a number between 0 and 1.')
    process.exit(1)
  }
  stopOnErrorRate = parsed
}

// --- Types ---

// Note: Supabase JS client infers many-to-one embedded relations as arrays in TypeScript,
// but PostgREST returns them as a single object at runtime for FK joins.
// Verified empirically via curl against the live DB on 2026-05-07.
// We cast to this type (via `as unknown as ReceiptRow[]`) to match actual runtime shape.
type ReceiptRow = {
  id: string
  participant_id: string
  participants: { nickname: string } | null
}

type ErrorEntry = {
  receiptId: string
  message: string
}

// --- Counters (module-level so SIGINT handler can read them) ---

let approved = 0
let rejected = 0
let needsReview = 0
let skipped = 0
let errors = 0
let processed = 0  // actually called processReceipt (non-dry-run, non-skipped)
const errorLog: ErrorEntry[] = []
let startTime = 0

// --- Helpers ---

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function printSummary(total: number): void {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log('\n========== SUMMARY ==========')
  console.log(`Total receipts queried: ${total}`)
  console.log(`Approved:              ${approved}`)
  console.log(`Rejected:              ${rejected}`)
  console.log(`Needs review:          ${needsReview}`)
  console.log(`Skipped:               ${skipped}`)
  console.log(`Errors:                ${errors}`)
  console.log(`Total time:            ${elapsed}s`)
  if (errorLog.length > 0) {
    console.log('\nErrors:')
    for (const e of errorLog) {
      console.log(`  ${e.receiptId}: ${e.message}`)
    }
  }
  console.log('=============================')
}

// --- Main ---

async function main(): Promise<void> {
  const { createAdminClient } = await import('../lib/supabase-admin')
  const { processReceipt } = await import('../lib/process-receipt')

  const supabase = createAdminClient()

  console.log('========== BACKLOG PROCESSOR ==========')
  console.log(`Mode:              ${dryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log(`Limit:             ${limit !== null ? limit : 'none (all)'}`)
  console.log(`Stop on error rate: ${stopOnErrorRate === 0 ? 'disabled' : `>${(stopOnErrorRate * 100).toFixed(0)}%`}`)
  console.log('=======================================\n')

  // Fetch uploaded receipts with participant nickname
  const query = supabase
    .from('receipts')
    .select('id, participant_id, participants(nickname)')
    .eq('status', 'uploaded')
    .order('created_at', { ascending: true })

  const { data: allReceipts, error: fetchError } = await query

  if (fetchError || allReceipts === null) {
    console.error(`Failed to fetch receipts: ${fetchError?.message ?? 'no data'}`)
    process.exit(1)
  }

  const receipts: ReceiptRow[] = limit !== null
    ? (allReceipts as unknown as ReceiptRow[]).slice(0, limit)
    : (allReceipts as unknown as ReceiptRow[])

  const total = receipts.length

  if (total === 0) {
    console.log('No uploaded receipts found. Nothing to do.')
    return
  }

  console.log(`About to process ${total} receipt(s). Starting in 5 seconds. Ctrl+C to abort.`)

  // Register SIGINT before the sleep so Ctrl+C during the countdown works too
  process.on('SIGINT', () => {
    console.log('\n\nAborted by user.')
    printSummary(total)
    process.exit(0)
  })

  await sleep(5000)

  startTime = Date.now()
  console.log('')

  for (let i = 0; i < receipts.length; i++) {
    const receipt = receipts[i]
    const nickname = receipt.participants?.nickname ?? 'unknown'

    console.log(`[${i + 1}/${total}] Processing ${receipt.id} (${nickname})...`)

    if (dryRun) {
      console.log('  → DRY RUN — would process\n')
      continue
    }

    const result = await processReceipt(receipt.id, supabase)

    switch (result.status) {
      case 'approved':
        approved++
        processed++
        console.log(`  → approved (${result.codes.length} code(s): ${result.codes.join(', ')})\n`)
        break
      case 'rejected':
        rejected++
        processed++
        console.log(`  → rejected (${result.reason})\n`)
        break
      case 'needs_review':
        needsReview++
        processed++
        console.log(`  → needs_review\n`)
        break
      case 'skipped':
        skipped++
        console.log(`  → skipped (was: ${result.previousStatus})\n`)
        break
      case 'error':
        errors++
        processed++
        errorLog.push({ receiptId: receipt.id, message: result.message })
        console.log(`  → error: ${result.message}\n`)
        break
    }

    // Sleep between receipts (skip on last to avoid pointless wait at the end)
    if (i < receipts.length - 1) {
      await sleep(1000)
    }

    // Error rate check after every 20 actually-processed receipts
    if (stopOnErrorRate > 0 && processed > 0 && processed % 20 === 0) {
      const rate = errors / processed
      if (rate > stopOnErrorRate) {
        console.log(`\nAuto-stopped: error rate ${(rate * 100).toFixed(1)}% exceeds threshold of ${(stopOnErrorRate * 100).toFixed(0)}%.`)
        console.log('Check errors before continuing.')
        printSummary(total)
        process.exit(1)
      }
    }
  }

  printSummary(total)
}

main().catch(err => {
  console.error('Unexpected error:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
