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

type OutcomeKey = 'approved' | 'rejected' | 'awaiting_reupload' | 'needs_review' | 'error'

type ErrorEntry = {
  receiptId: string
  message: string
}

// --- Counters ---

const counts: Record<OutcomeKey, number> = {
  approved: 0,
  rejected: 0,
  awaiting_reupload: 0,
  needs_review: 0,
  error: 0,
}
const errorLog: ErrorEntry[] = []

// --- Helpers ---

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function printSummary(total: number): void {
  console.log('\n========== SUMMARY ==========')
  console.log(`Total receipts queried: ${total}`)
  console.log(`  approved:          ${counts.approved}`)
  console.log(`  rejected:          ${counts.rejected}`)
  console.log(`  awaiting_reupload: ${counts.awaiting_reupload}`)
  console.log(`  needs_review:      ${counts.needs_review}`)
  console.log(`  error:             ${counts.error}`)
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
  const { validateReceipt } = await import('../lib/validate-receipt')
  const { generateCodesForReceipt } = await import('../lib/generate-codes')
  const {
    sendReceiptApproved,
    sendReceiptRejectedDuplicate,
    sendReceiptReuploadRequest,
    sendReceiptManualReviewNotification,
  } = await import('../lib/send-receipt-emails')

  const supabase = createAdminClient()

  console.log('========== RESOLVE STUCK RECEIPTS ==========')
  console.log(`Mode:  ${dryRun ? 'DRY RUN (pass --apply to execute for real)' : 'LIVE — will write DB and send emails'}`)
  console.log(`Limit: ${limit !== null ? limit : 'none (all)'}`)
  console.log('=============================================\n')

  // Fetch all processing receipts where AI already ran (ai_processed_at IS NOT NULL)
  const { data: allReceipts, error: fetchError } = await supabase
    .from('receipts')
    .select('id, participant_id, created_at, ai_confidence, ai_raw_response, participants(nickname, email)')
    .eq('status', 'processing')
    .not('ai_processed_at', 'is', null)
    .order('created_at', { ascending: true })

  if (fetchError || allReceipts === null) {
    console.error(`Failed to fetch stuck receipts: ${fetchError?.message ?? 'no data'}`)
    process.exit(1)
  }

  const rows = allReceipts as unknown as ReceiptRow[]

  const receipts: ReceiptRow[] = limit !== null ? rows.slice(0, limit) : rows
  const total = receipts.length

  console.log(`Found ${rows.length} stuck receipt(s) with ai_processed_at set.`)
  if (limit !== null && rows.length > limit) {
    console.log(`Processing first ${limit} (--limit applied).`)
  }
  console.log(`Will process: ${total}\n`)

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
    console.log('')
  }

  for (let i = 0; i < receipts.length; i++) {
    const receipt = receipts[i]
    const nickname = receipt.participants?.nickname ?? 'unknown'
    const email = receipt.participants?.email ?? null
    const confidence = receipt.ai_confidence ?? 'unknown'
    const uploadDate = receipt.created_at
    const participantId = receipt.participant_id
    const receiptId = receipt.id

    console.log(`[${i + 1}/${total}] ${receiptId}`)
    console.log(`  participant: ${nickname}`)
    console.log(`  ai_confidence: ${confidence}`)

    // Reconstruct ExtractedData from the flat ai_raw_response.
    // process-receipt.ts writes: ai_raw_response = { ...extracted, _provider: provider }
    // So ai_raw_response IS the ExtractedData shape (plus _provider which we ignore).
    const raw = receipt.ai_raw_response
    if (!raw || typeof raw !== 'object') {
      const msg = 'ai_raw_response is null or not an object — cannot reconstruct extracted data'
      console.log(`  → ERROR: ${msg}\n`)
      counts.error++
      errorLog.push({ receiptId, message: msg })
      continue
    }

    // Cast to ExtractedData. validateReceipt only reads the known fields; _provider is ignored.
    const extracted = raw as {
      is_receipt: boolean
      is_readable: boolean
      cnpj: string | null
      amount_total_brl: number | null
      receipt_number: string | null
      receipt_date: string | null
      confidence: string
      notes: string
    }

    // Run validation using cached data (no OpenAI call)
    let validation: Awaited<ReturnType<typeof validateReceipt>>
    try {
      validation = await validateReceipt(extracted as Parameters<typeof validateReceipt>[0], receiptId, supabase)
    } catch (err) {
      const msg = `validateReceipt threw: ${err instanceof Error ? err.message : String(err)}`
      console.log(`  → ERROR: ${msg}\n`)
      counts.error++
      errorLog.push({ receiptId, message: msg })
      continue
    }

    console.log(`  validateReceipt result: ${validation.status}${'review_reason' in validation ? ` (${validation.review_reason})` : ''}${'reason' in validation ? ` (${validation.reason})` : ''}${'codes_to_generate' in validation ? ` (${validation.codes_to_generate} code(s))` : ''}`)

    // --- Approved ---
    if (validation.status === 'approved') {
      const action = `status=approved, generate ${validation.codes_to_generate} code(s), send Email A`
      console.log(`  → ${dryRun ? 'DRY RUN' : 'APPLYING'}: ${action}`)

      if (!dryRun) {
        if (!email) {
          const msg = 'No email on file — cannot send approval email'
          console.log(`  → ERROR: ${msg}\n`)
          counts.error++
          errorLog.push({ receiptId, message: msg })
          continue
        }

        let codes: string[]
        try {
          codes = await generateCodesForReceipt(receiptId, participantId, validation.codes_to_generate, supabase)
        } catch (err) {
          // Check if codes were partially inserted
          const { data: existingCodes } = await supabase
            .from('codes')
            .select('code')
            .eq('receipt_id', receiptId)
          if (existingCodes && existingCodes.length > 0) {
            codes = existingCodes.map((r: { code: string }) => r.code)
          } else {
            const msg = `generateCodes failed: ${err instanceof Error ? err.message : String(err)}`
            console.log(`  → ERROR: ${msg}\n`)
            counts.error++
            errorLog.push({ receiptId, message: msg })
            continue
          }
        }

        const { error: updateErr } = await supabase
          .from('receipts')
          .update({ status: 'approved', codes_generated: codes.length })
          .eq('id', receiptId)

        if (updateErr) {
          const msg = `DB update failed: ${updateErr.message}`
          console.log(`  → ERROR: ${msg}\n`)
          counts.error++
          errorLog.push({ receiptId, message: msg })
          continue
        }

        await sendReceiptApproved({
          participantId,
          email,
          nickname,
          uploadDate,
          codes,
          amountBrl: (extracted.amount_total_brl ?? 0),
        })

        console.log(`  → APPLIED: codes generated: ${codes.join(', ')}`)
      }

      counts.approved++
      console.log('')
      continue
    }

    // --- Rejected (duplicate) ---
    if (validation.status === 'rejected') {
      const action = `status=rejected, rejection_reason=${validation.reason}, send Email F (isDelayedAnalysis: true)`
      console.log(`  → ${dryRun ? 'DRY RUN' : 'APPLYING'}: ${action}`)

      if (!dryRun) {
        const { error: updateErr } = await supabase
          .from('receipts')
          .update({ status: 'rejected', rejection_reason: validation.reason })
          .eq('id', receiptId)

        if (updateErr) {
          const msg = `DB update failed: ${updateErr.message}`
          console.log(`  → ERROR: ${msg}\n`)
          counts.error++
          errorLog.push({ receiptId, message: msg })
          continue
        }

        if (email) {
          await sendReceiptRejectedDuplicate({ participantId, email, nickname, uploadDate, isDelayedAnalysis: true })
        }

        console.log(`  → APPLIED`)
      }

      counts.rejected++
      console.log('')
      continue
    }

    // --- Awaiting reupload ---
    if (validation.status === 'awaiting_reupload') {
      // Check for second strike
      const { data: priorReceipt } = await supabase
        .from('receipts')
        .select('id, reupload_request_sent_at')
        .eq('participant_id', participantId)
        .neq('id', receiptId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const isSecondStrike = priorReceipt !== null && priorReceipt.reupload_request_sent_at !== null

      if (isSecondStrike) {
        const action = `status=needs_review (second_unreadable_upload), send Email I`
        console.log(`  → ${dryRun ? 'DRY RUN' : 'APPLYING'}: ${action}`)

        if (!dryRun) {
          const { error: updateErr } = await supabase
            .from('receipts')
            .update({ status: 'needs_review', rejection_reason: null })
            .eq('id', receiptId)

          if (updateErr) {
            const msg = `DB update failed: ${updateErr.message}`
            console.log(`  → ERROR: ${msg}\n`)
            counts.error++
            errorLog.push({ receiptId, message: msg })
            continue
          }

          if (email) {
            await sendReceiptManualReviewNotification({ participantId, email, nickname, uploadDate })
          }

          console.log(`  → APPLIED`)
        }

        counts.needs_review++
      } else {
        const action = `status=awaiting_reupload, reupload_request_sent_at=now, send Email H`
        console.log(`  → ${dryRun ? 'DRY RUN' : 'APPLYING'}: ${action}`)

        if (!dryRun) {
          const { error: updateErr } = await supabase
            .from('receipts')
            .update({
              status: 'awaiting_reupload',
              reupload_request_sent_at: new Date().toISOString(),
            })
            .eq('id', receiptId)

          if (updateErr) {
            const msg = `DB update failed: ${updateErr.message}`
            console.log(`  → ERROR: ${msg}\n`)
            counts.error++
            errorLog.push({ receiptId, message: msg })
            continue
          }

          if (email) {
            await sendReceiptReuploadRequest({ participantId, email, nickname, uploadDate })
          }

          console.log(`  → APPLIED`)
        }

        counts.awaiting_reupload++
      }

      console.log('')
      continue
    }

    // --- Needs review ---
    const action = `status=needs_review (${validation.review_reason}), send Email I`
    console.log(`  → ${dryRun ? 'DRY RUN' : 'APPLYING'}: ${action}`)

    if (!dryRun) {
      const { error: updateErr } = await supabase
        .from('receipts')
        .update({
          status: 'needs_review',
          ai_raw_response: {
            _system_note: `stuck_recovery_${validation.review_reason}`,
            extracted,
            resolved_at: new Date().toISOString(),
          },
        })
        .eq('id', receiptId)

      if (updateErr) {
        const msg = `DB update failed: ${updateErr.message}`
        console.log(`  → ERROR: ${msg}\n`)
        counts.error++
        errorLog.push({ receiptId, message: msg })
        continue
      }

      if (email) {
        await sendReceiptManualReviewNotification({ participantId, email, nickname, uploadDate })
      }

      console.log(`  → APPLIED`)
    }

    counts.needs_review++
    console.log('')

    // 2-second delay between receipts (skip on last)
    if (!dryRun && i < receipts.length - 1) {
      await sleep(2000)
    }
  }

  printSummary(total)
}

main().catch(err => {
  console.error('\nUnexpected error:')
  console.error(err instanceof Error ? err.stack : String(err))
  process.exit(1)
})
