import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
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
const dryRun = !applyMode // default is dry-run

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

// Supabase JS infers many-to-one FK joins as arrays in TypeScript,
// but PostgREST returns them as a single object at runtime.
// We cast via `as unknown as ReceiptRow[]` to match actual runtime shape.
type ReceiptRow = {
  id: string
  participant_id: string
  created_at: string
  ai_confidence: string | null
  ai_raw_response: Record<string, unknown> | null
  participants: { nickname: string; email: string | null } | null
}

type ErrorEntry = {
  receiptId: string
  message: string
}

// --- Counters ---

let totalQueried = 0
let totalMatched = 0
let totalRejected = 0
let totalErrors = 0
const errorLog: ErrorEntry[] = []

// --- Helpers ---

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Extracts is_receipt and confidence from ai_raw_response regardless of storage shape.
//
// Two shapes exist in the DB:
//   Flat (from Step 6 of processReceipt):
//     { is_receipt: bool, confidence: str, ..., _provider: str }
//   Nested (from the needs_review fallthrough which overwrites Step 6):
//     { _system_note: str, extracted: { is_receipt: bool, confidence: str, ... }, skipped_at: str }
//
// Returns null if neither shape yields the required fields.
function extractFields(raw: Record<string, unknown>): { is_receipt: boolean; confidence: string } | null {
  // Try flat shape first
  if (typeof raw.is_receipt === 'boolean' && typeof raw.confidence === 'string') {
    return { is_receipt: raw.is_receipt, confidence: raw.confidence }
  }

  // Try nested shape (needs_review fallthrough)
  if (raw.extracted && typeof raw.extracted === 'object') {
    const inner = raw.extracted as Record<string, unknown>
    if (typeof inner.is_receipt === 'boolean' && typeof inner.confidence === 'string') {
      return { is_receipt: inner.is_receipt, confidence: inner.confidence }
    }
  }

  return null
}

function printSummary(): void {
  console.log('\n========== SUMMARY ==========')
  console.log(`Total queried (needs_review with ai data): ${totalQueried}`)
  console.log(`Matched rule (is_receipt=false, confidence=high): ${totalMatched}`)
  console.log(`Auto-rejected: ${totalRejected}`)
  console.log(`Errors:        ${totalErrors}`)
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
  const { sendReceiptRejectedNotReceipt } = await import('../lib/send-receipt-emails')

  const supabase = createAdminClient()

  console.log('========== APPLY NOT-A-RECEIPT REJECTION ==========')
  console.log(`Mode:  ${dryRun ? 'DRY RUN (pass --apply to execute for real)' : 'LIVE — will write DB and send emails'}`)
  console.log(`Limit: ${limit !== null ? limit : 'none (all)'}`)
  console.log('====================================================\n')

  // Fetch all needs_review receipts that have AI data
  const { data: allReceipts, error: fetchError } = await supabase
    .from('receipts')
    .select('id, participant_id, created_at, ai_confidence, ai_raw_response, participants(nickname, email)')
    .eq('status', 'needs_review')
    .not('ai_raw_response', 'is', null)
    .order('created_at', { ascending: true })

  if (fetchError || allReceipts === null) {
    console.error(`Failed to fetch receipts: ${fetchError?.message ?? 'no data'}`)
    process.exit(1)
  }

  const rows = allReceipts as unknown as ReceiptRow[]
  totalQueried = rows.length

  // Filter to only rows matching the auto-reject rule
  const matched: Array<ReceiptRow & { fields: { is_receipt: boolean; confidence: string } }> = []
  let skippedNoFields = 0

  for (const row of rows) {
    if (!row.ai_raw_response) continue
    const fields = extractFields(row.ai_raw_response)
    if (!fields) {
      skippedNoFields++
      continue
    }
    if (fields.is_receipt === false && fields.confidence === 'high') {
      matched.push({ ...row, fields })
    }
  }

  totalMatched = matched.length

  const toProcess = limit !== null ? matched.slice(0, limit) : matched

  console.log(`Found ${totalQueried} needs_review receipts with AI data.`)
  if (skippedNoFields > 0) {
    console.log(`Skipped ${skippedNoFields} with unrecognized ai_raw_response shape (system-routed, no is_receipt field).`)
  }
  console.log(`Matched rule (is_receipt=false, confidence=high): ${totalMatched}`)
  if (limit !== null && totalMatched > limit) {
    console.log(`Applying limit: processing first ${limit}.`)
  }
  console.log(`Will process: ${toProcess.length}\n`)

  if (toProcess.length === 0) {
    console.log('Nothing to do.')
    printSummary()
    return
  }

  if (applyMode) {
    console.log('Starting in 5 seconds. Ctrl+C to abort.')
    process.on('SIGINT', () => {
      console.log('\n\nAborted by user.')
      printSummary()
      process.exit(0)
    })
    await sleep(5000)
    console.log('')
  }

  for (let i = 0; i < toProcess.length; i++) {
    const receipt = toProcess[i]
    const nickname = receipt.participants?.nickname ?? 'unknown'
    const email = receipt.participants?.email ?? null
    const receiptId = receipt.id
    const participantId = receipt.participant_id
    const uploadDate = receipt.created_at

    console.log(`[${i + 1}/${toProcess.length}] ${receiptId}`)
    console.log(`  participant:   ${nickname}`)
    console.log(`  ai_confidence: ${receipt.fields.confidence}`)
    console.log(`  is_receipt:    ${receipt.fields.is_receipt}`)

    const action = 'status=rejected, rejection_reason=not_a_receipt, send Email B'
    console.log(`  → ${dryRun ? 'DRY RUN' : 'APPLYING'}: ${action}`)

    if (!dryRun) {
      const { error: updateErr } = await supabase
        .from('receipts')
        .update({ status: 'rejected', rejection_reason: 'not_a_receipt' })
        .eq('id', receiptId)

      if (updateErr) {
        const msg = `DB update failed: ${updateErr.message}`
        console.log(`  → ERROR: ${msg}\n`)
        totalErrors++
        errorLog.push({ receiptId, message: msg })
        continue
      }

      if (email) {
        await sendReceiptRejectedNotReceipt({ participantId, email, nickname, uploadDate })
      } else {
        console.log('  → NOTE: no email on file, DB updated but Email B not sent')
      }

      console.log('  → APPLIED')
      totalRejected++
    }

    console.log('')

    // 2-second delay between rejections (skip on last)
    if (!dryRun && i < toProcess.length - 1) {
      await sleep(2000)
    }
  }

  printSummary()
}

main().catch(err => {
  console.error('\nUnexpected error:')
  console.error(err instanceof Error ? err.stack : String(err))
  process.exit(1)
})
