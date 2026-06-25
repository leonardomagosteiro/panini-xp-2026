import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'
import { createAdminClient } from '../lib/supabase-admin'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing required env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

// --- Arg parsing ---
const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run')

function getArgValue(flag: string, defaultValue: string): string {
  const idx = args.indexOf(flag)
  if (idx !== -1 && args[idx + 1]) return args[idx + 1]
  return defaultValue
}

const candidatesFile = getArgValue('--candidates-file', '/tmp/rescue-candidates-2026-06-24.json')
const backupFile = getArgValue('--backup-file', '/tmp/pre-reset-backup-2026-06-24.json')

// --- Read candidates file ---
if (!fs.existsSync(candidatesFile)) {
  console.error(`Candidates file not found: ${candidatesFile}`)
  process.exit(1)
}

let candidates: Array<{ id: string; [key: string]: unknown }>
try {
  const raw = fs.readFileSync(candidatesFile, 'utf-8')
  candidates = JSON.parse(raw)
  if (!Array.isArray(candidates)) throw new Error('Expected a JSON array')
  if (candidates.length === 0) {
    console.log('Candidates file is empty — nothing to do.')
    process.exit(0)
  }
  if (typeof candidates[0].id !== 'string') throw new Error('Each candidate must have an "id" string field')
} catch (err) {
  console.error(`Failed to read or parse candidates file: ${candidatesFile}`)
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
}

const ids = candidates.map(c => c.id)
console.log(`Read ${ids.length} candidate IDs from ${candidatesFile}`)

async function main() {
  const supabase = createAdminClient()

  // --- Step 5: Fetch full current state for backup ---
  const { data: currentRows, error: fetchError } = await supabase
    .from('receipts')
    .select('*')
    .in('id', ids)

  if (fetchError) {
    console.error('Failed to fetch receipts for backup:', fetchError.message)
    process.exit(1)
  }

  fs.writeFileSync(backupFile, JSON.stringify(currentRows, null, 2))
  console.log(`Backup written to: ${backupFile}`)
  console.log(`Receipts backed up: ${(currentRows ?? []).length}`)

  if ((currentRows ?? []).length !== ids.length) {
    console.error(`ABORT: Backup row count mismatch. Expected ${ids.length}, got ${(currentRows ?? []).length}. This likely means the .in() filter truncated. No DB updates have been performed. Investigate before retrying.`)
    process.exit(1)
  }

  // --- Step 6: Pre-update summary ---
  const statusCounts: Record<string, number> = {}
  for (const row of currentRows ?? []) {
    const s = row.status ?? 'null'
    statusCounts[s] = (statusCounts[s] ?? 0) + 1
  }

  console.log('\n--- Pre-update summary ---')
  console.log(`Receipts to reset: ${ids.length}`)
  console.log('Current status distribution:')
  for (const [status, count] of Object.entries(statusCounts)) {
    console.log(`  ${status}: ${count}`)
  }

  if (isDryRun) {
    console.log(`\nDRY RUN — would update ${ids.length} receipts`)
    console.log('No DB writes performed.')
    return
  }

  // --- Countdown with SIGINT handler ---
  console.log('\nProceeding with update in 5 seconds. Press Ctrl+C to abort.')

  await new Promise<void>((resolve) => {
    let secondsLeft = 5
    const sigintHandler = () => {
      console.log('\nAborted before update')
      process.exit(0)
    }
    process.on('SIGINT', sigintHandler)

    const interval = setInterval(() => {
      process.stdout.write(`\r${secondsLeft}...`)
      secondsLeft--
      if (secondsLeft < 0) {
        clearInterval(interval)
        process.removeListener('SIGINT', sigintHandler)
        process.stdout.write('\n')
        resolve()
      }
    }, 1000)
  })

  // --- Step 8: Batch update ---
  const { error: updateError } = await supabase
    .from('receipts')
    .update({
      status: 'uploaded',
      ai_raw_response: null,
      rejection_reason: null,
      ai_processed_at: null,
      ai_confidence: null,
      cnpj_on_receipt: null,
      amount_on_receipt: null,
      receipt_date: null,
      receipt_number: null,
      updated_at: new Date().toISOString(),
    })
    .in('id', ids)

  if (updateError) {
    console.error('Update failed:', updateError.message)
    process.exit(1)
  }

  console.log(`Update issued for ${ids.length} receipts.`)

  // --- Step 9: Confirm ---
  const { data: confirmedRows, error: confirmError } = await supabase
    .from('receipts')
    .select('id, status, ai_raw_response')
    .in('id', ids)

  if (confirmError) {
    console.error('Confirmation query failed:', confirmError.message)
    process.exit(1)
  }

  const confirmed = confirmedRows ?? []
  let allGood = true

  for (const row of confirmed) {
    if (row.status !== 'uploaded' || row.ai_raw_response !== null) {
      console.warn(`WARNING: receipt ${row.id} not in expected state — status=${row.status}, ai_raw_response=${JSON.stringify(row.ai_raw_response)}`)
      allGood = false
    }
  }

  if (allGood) {
    console.log(`Confirmed: ${confirmed.length} receipts now in uploaded status with cleared AI fields.`)
  }

  // --- Step 10: Final summary ---
  console.log('\n--- Final summary ---')
  console.log(`Receipts updated: ${ids.length}`)
  console.log(`Backup file: ${backupFile}`)
  console.log('Next step: Run scripts/process-receipts-backlog.ts --limit 10 to process the first wave')
}

main()
