import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'
import { VALID_CNPJS } from '../lib/cnpj-match'
import { createAdminClient } from '../lib/supabase-admin'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing required env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  let prev = Array.from({ length: n + 1 }, (_, i) => i)
  let curr = new Array<number>(n + 1)
  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      )
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[n]
}

interface ReceiptRow {
  id: string
  cnpj_on_receipt: string | null
  participant_id: string
  created_at: string
}

interface RescueCandidate {
  id: string
  cnpj_on_receipt_raw: string | null
  cnpj_on_receipt_normalized: string
  participant_id: string
  created_at: string
  min_distance: number
  matched_valid_cnpj: string
}

async function main() {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('receipts')
    .select('id, cnpj_on_receipt, participant_id, created_at')
    .eq('status', 'needs_review')
    .eq('ai_raw_response->>_system_note', 'ai_extraction_review_invalid_cnpj')
    .order('created_at', { ascending: true })
    .limit(1000)

  if (error) {
    console.error('Query failed:', error.message)
    process.exit(1)
  }

  const rows: ReceiptRow[] = data ?? []
  console.log(`Queried ${rows.length} receipts with status=needs_review and review_reason=invalid_cnpj\n`)

  const candidates: RescueCandidate[] = []
  let countSkipped = 0
  let countRescuable = 0
  let countTooFar = 0
  const distanceBuckets: Record<number, number> = { 0: 0, 1: 0, 2: 0 }

  for (const row of rows) {
    const raw = row.cnpj_on_receipt
    const normalized = raw ? raw.replace(/\D/g, '') : ''

    if (!normalized || normalized.length !== 14) {
      console.log(`skipped: malformed CNPJ — receipt ${row.id} (raw: ${JSON.stringify(raw)})`)
      countSkipped++
      continue
    }

    let minDistance = Infinity
    let matchedCnpj = ''

    for (const valid of VALID_CNPJS) {
      const d = levenshtein(normalized, valid)
      if (d < minDistance) {
        minDistance = d
        matchedCnpj = valid
      }
    }

    if (minDistance <= 2) {
      countRescuable++
      distanceBuckets[minDistance] = (distanceBuckets[minDistance] ?? 0) + 1
      candidates.push({
        id: row.id,
        cnpj_on_receipt_raw: raw,
        cnpj_on_receipt_normalized: normalized,
        participant_id: row.participant_id,
        created_at: row.created_at,
        min_distance: minDistance,
        matched_valid_cnpj: matchedCnpj,
      })
    } else {
      countTooFar++
    }
  }

  console.log('--- Summary ---')
  console.log(`Total queried:          ${rows.length}`)
  console.log(`Rescuable (dist <= 2):  ${countRescuable}`)
  console.log(`  distance 0 (exact):   ${distanceBuckets[0]}`)
  console.log(`  distance 1:           ${distanceBuckets[1]}`)
  console.log(`  distance 2:           ${distanceBuckets[2]}`)
  console.log(`Too far (dist >= 3):    ${countTooFar}`)
  console.log(`Skipped (malformed):    ${countSkipped}`)

  const outPath = '/tmp/rescue-candidates-2026-06-24.json'
  fs.writeFileSync(outPath, JSON.stringify(candidates, null, 2))
  console.log(`\nJSON written to: ${outPath}`)
}

main()
