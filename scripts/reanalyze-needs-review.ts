import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'OPENAI_API_KEY',
  'RESEND_API_KEY',
] as const

const missing = REQUIRED_ENV_VARS.filter(v => !process.env[v])
if (missing.length > 0) {
  console.error(`Missing required env vars: ${missing.join(', ')}. Check your .env.local file.`)
  process.exit(1)
}

// --- Arg parsing ---

const args = process.argv.slice(2)

if (args.includes('--dry-run') && args.includes('--apply')) {
  console.error('Cannot use --dry-run and --apply together.')
  process.exit(1)
}

const applyMode = args.includes('--apply')
const dryRun = !applyMode  // default is dry-run

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

// --- Types ---

// Note: Supabase JS client infers many-to-one embedded relations as arrays in TypeScript,
// but PostgREST returns them as a single object at runtime for FK joins.
// Verified empirically via curl against the live DB on 2026-05-07.
// We cast via `as unknown as ReceiptRow[]` to match actual runtime shape.
type ReceiptRow = {
  id: string
  participant_id: string
  rejection_reason: string | null
  ai_confidence: string | null
  participants: { nickname: string; email: string | null } | null
}

type ErrorEntry = {
  receiptId: string
  message: string
}

// --- Counters (module-level so SIGINT handler can read them) ---

let approved = 0
let rejected = 0
let stillNeedsReview = 0
let errors = 0
let processed = 0  // receipts actually sent to processReceipt in apply mode
const errorLog: ErrorEntry[] = []
let startTime = 0

// --- Helpers ---

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function printSummary(total: number): void {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log('\n========== SUMMARY ==========')
  console.log(`Total receipts queried:  ${total}`)
  console.log(`Approved:                ${approved}`)
  console.log(`Rejected:                ${rejected}`)
  console.log(`Still needs review:      ${stillNeedsReview}`)
  console.log(`Errors:                  ${errors}`)
  console.log(`Total time:              ${elapsed}s`)
  if (applyMode) {
    console.log(`Estimated OpenAI cost:   ~$${(processed * 0.01).toFixed(2)} (~$0.01/call)`)
  }
  if (errorLog.length > 0) {
    console.log('\nErrors encountered:')
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

  console.log('========== REANALYZE NEEDS-REVIEW ==========')
  console.log(`Mode:    ${dryRun ? 'DRY RUN (pass --apply to process for real)' : 'LIVE — will call OpenAI and send emails'}`)
  console.log(`Limit:   ${limit !== null ? limit : 'none (all)'}`)
  console.log('=============================================\n')

  // Fetch all needs_review receipts with participant data
  // Filter by email in JS — Supabase JS filter on joined columns is unreliable
  const { data: allReceipts, error: fetchError } = await supabase
    .from('receipts')
    .select('id, participant_id, rejection_reason, ai_confidence, participants(nickname, email)')
    .eq('status', 'needs_review')
    .order('created_at', { ascending: true })

  if (fetchError || allReceipts === null) {
    console.error(`Failed to fetch receipts: ${fetchError?.message ?? 'no data'}`)
    process.exit(1)
  }

  const withEmail = (allReceipts as unknown as ReceiptRow[])
    .filter(r => r.participants?.email)

  const receipts: ReceiptRow[] = limit !== null
    ? withEmail.slice(0, limit)
    : withEmail

  const skippedNoEmail = (allReceipts as unknown as ReceiptRow[]).length - withEmail.length
  const total = receipts.length

  console.log(`Found ${(allReceipts as unknown as ReceiptRow[]).length} needs_review receipts total.`)
  console.log(`Skipped ${skippedNoEmail} without email on file (WhatsApp follow-up required).`)
  console.log(`Will process: ${total} receipt(s).\n`)

  if (total === 0) {
    console.log('Nothing to do.')
    return
  }

  if (applyMode) {
    console.log('Starting in 5 seconds. Ctrl+C to abort.')

    process.on('SIGINT', () => {
      console.log('\n\nAborted by user.')
      printSummary(total)
      process.exit(0)
    })

    await sleep(5000)
    startTime = Date.now()
    console.log('')
  }

  const CONSECUTIVE_ERROR_LIMIT = 5
  let consecutiveErrors = 0

  for (let i = 0; i < receipts.length; i++) {
    const receipt = receipts[i]
    const nickname = receipt.participants?.nickname ?? 'unknown'
    const confidence = receipt.ai_confidence ?? 'unknown'
    const reason = receipt.rejection_reason ?? 'none'

    console.log(`[${i + 1}/${total}] ${receipt.id} (${nickname})`)
    console.log(`  rejection_reason: ${reason}  |  ai_confidence: ${confidence}`)

    if (dryRun) {
      console.log('  → would re-process\n')
      continue
    }

    // Reset to uploaded so processReceipt will run (it skips non-uploaded receipts)
    const { error: resetError } = await supabase
      .from('receipts')
      .update({ status: 'uploaded' })
      .eq('id', receipt.id)

    if (resetError) {
      errors++
      consecutiveErrors++
      const msg = `Failed to reset status: ${resetError.message}`
      errorLog.push({ receiptId: receipt.id, message: msg })
      console.log(`  → error: ${msg}\n`)

      if (consecutiveErrors >= CONSECUTIVE_ERROR_LIMIT) {
        console.log(`\nAborted: ${CONSECUTIVE_ERROR_LIMIT} consecutive errors. Check errors before continuing.`)
        break
      }
      continue
    }

    processed++
    const result = await processReceipt(receipt.id, supabase, { isDelayedAnalysis: true })

    switch (result.status) {
      case 'approved':
        approved++
        consecutiveErrors = 0
        console.log(`  → approved (${result.codes.length} code(s): ${result.codes.join(', ')})\n`)
        break
      case 'rejected':
        rejected++
        consecutiveErrors = 0
        console.log(`  → rejected (${result.reason})\n`)
        break
      case 'needs_review':
        stillNeedsReview++
        consecutiveErrors = 0
        console.log(`  → still needs_review\n`)
        break
      case 'skipped':
        // Should not happen — we reset to uploaded above
        consecutiveErrors = 0
        console.log(`  → skipped unexpectedly (was: ${result.previousStatus})\n`)
        break
      case 'error':
        errors++
        consecutiveErrors++
        errorLog.push({ receiptId: receipt.id, message: result.message })
        console.log(`  → error: ${result.message}\n`)

        if (consecutiveErrors >= CONSECUTIVE_ERROR_LIMIT) {
          console.log(`\nAborted: ${CONSECUTIVE_ERROR_LIMIT} consecutive errors. Check errors before continuing.`)
          printSummary(total)
          process.exit(1)
        }
        break
    }

    // Sleep between receipts (skip on last)
    if (i < receipts.length - 1) {
      await sleep(1000)
    }
  }

  printSummary(total)
}

main().catch(err => {
  console.error('\nUnexpected error:')
  console.error(err instanceof Error ? err.stack : String(err))
  process.exit(1)
})
