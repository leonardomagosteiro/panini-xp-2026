export {}

/**
 * One-time draw announcement blast.
 *
 * Sends two variants to two audience segments:
 *   APPROVED         → celebratory email ("você está concorrendo com N códigos")
 *   AWAITING_REUPLOAD → urgent email ("reenvie seu recibo antes do sorteio")
 *   A participant with BOTH approved AND awaiting_reupload receipts lands in
 *   APPROVED only (the celebratory variant is more accurate for them).
 *
 * Usage examples:
 *
 *   # Dry run, both segments (RECOMMENDED FIRST STEP — no sends, shows audience counts)
 *   npx tsx scripts/send-draw-announcement.ts --dry-run
 *
 *   # Smoke test: send 1 email of each segment to your own address (2 emails total)
 *   npx tsx scripts/send-draw-announcement.ts --limit=2 --to=leonardomagosteiro@gmail.com
 *
 *   # Real send to ALL customers in both segments (DESTRUCTIVE — sends ~1617 emails)
 *   npx tsx scripts/send-draw-announcement.ts
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import { createAdminClient } from '../lib/supabase-admin'
import { fetchAllRows } from '../lib/paginate-query'
import {
  buildDrawBlock,
  buildEmailHtml,
  ctaButton,
} from '../lib/send-receipt-emails'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const REUPLOAD_URL = 'https://app.paninixp.com.br/enviar-recibo'
const DRAW_DATE = process.env.DRAW_DATE_DISPLAY || '30 de junho'

// ── CLI arg parsing ────────────────────────────────────────────────────────────

const USAGE = `
Usage: npx tsx scripts/send-draw-announcement.ts [--dry-run] [--segment=approved|awaiting-reupload|both] [--limit=N] [--to=email]

  --dry-run                    Print audience counts + 5 sample rows per segment. No sends.
  --segment=approved|          Which audience to target. Default: both.
            awaiting-reupload|
            both
  --limit=N                    Cap total sends across all segments. Use --limit=2 for smoke tests.
  --to=email                   Override recipient for all sends (nickname becomes 'Smoke Test').
`.trim()

type Segment = 'approved' | 'awaiting-reupload' | 'both'

function parseArgs() {
  const raw = Object.fromEntries(
    process.argv.slice(2).map(a => {
      const eq = a.indexOf('=')
      return eq === -1 ? [a.replace(/^--/, ''), ''] : [a.slice(2, eq), a.slice(eq + 1)]
    })
  )

  const dryRun = 'dry-run' in raw
  const segmentRaw = raw['segment'] ?? 'both'
  const limitRaw = raw['limit'] ?? ''
  const toOverride = raw['to'] ?? ''

  const validSegments: Segment[] = ['approved', 'awaiting-reupload', 'both']
  if (!validSegments.includes(segmentRaw as Segment)) {
    console.error(`ERROR: --segment must be one of: approved | awaiting-reupload | both (got: "${segmentRaw}")\n`)
    console.error(USAGE)
    process.exit(1)
  }

  let limit: number | null = null
  if (limitRaw) {
    limit = parseInt(limitRaw, 10)
    if (!Number.isInteger(limit) || limit <= 0) {
      console.error(`ERROR: --limit must be a positive integer (got: "${limitRaw}")\n`)
      console.error(USAGE)
      process.exit(1)
    }
  }

  if (toOverride && !toOverride.includes('@')) {
    console.error(`ERROR: --to "${toOverride}" does not look like a valid email address.\n`)
    console.error(USAGE)
    process.exit(1)
  }

  return { dryRun, segment: segmentRaw as Segment, limit, toOverride }
}

// ── Audience row types ─────────────────────────────────────────────────────────

interface ApprovedRow {
  id: string
  email: string
  nickname: string
  code_count: number
}

interface ReuploadRow {
  id: string
  email: string
  nickname: string
}

// ── Audience queries ───────────────────────────────────────────────────────────

async function queryApproved(supabase: ReturnType<typeof createAdminClient>): Promise<ApprovedRow[]> {
  // Participants with at least one approved receipt and a known email.
  // code_count is on the participant row (maintained by the code generator).
  return fetchAllRows<ApprovedRow>((from, to) =>
    supabase
      .from('participants')
      .select('id, email, nickname, code_count')
      .not('email', 'is', null)
      .gt('code_count', 0)
      .order('id')
      .range(from, to)
  )
}

async function queryAwaitingReupload(supabase: ReturnType<typeof createAdminClient>): Promise<ReuploadRow[]> {
  // Participants with an awaiting_reupload receipt but NO approved receipt,
  // and a known email. We achieve this with two sequential queries instead of
  // a sub-select (PostgREST doesn't support NOT EXISTS directly).
  const allWaiting = await fetchAllRows<ReuploadRow>((from, to) =>
    supabase
      .from('participants')
      .select('id, email, nickname')
      .not('email', 'is', null)
      .order('id')
      .range(from, to)
  )

  // Get all participant IDs that have at least one approved receipt.
  const approvedIds = await fetchAllRows<{ participant_id: string }>((from, to) =>
    supabase
      .from('receipts')
      .select('participant_id')
      .eq('status', 'approved')
      .range(from, to)
  )
  const approvedIdSet = new Set(approvedIds.map(r => r.participant_id))

  // Get all participant IDs that have at least one awaiting_reupload receipt.
  const waitingIds = await fetchAllRows<{ participant_id: string }>((from, to) =>
    supabase
      .from('receipts')
      .select('participant_id')
      .eq('status', 'awaiting_reupload')
      .range(from, to)
  )
  const waitingIdSet = new Set(waitingIds.map(r => r.participant_id))

  // Keep only participants in waiting but NOT in approved.
  return allWaiting.filter(p => waitingIdSet.has(p.id) && !approvedIdSet.has(p.id))
}

// ── Email builders ─────────────────────────────────────────────────────────────

function buildApprovedEmail(nickname: string, codeCount: number) {
  const subject = `Sorteio em ${DRAW_DATE} — você está concorrendo! | Panini XP`
  const codeLabel = codeCount === 1 ? '1 código' : `${codeCount} códigos`
  const drawBlock = buildDrawBlock('celebratory', 'announced')

  const text = `Olá, ${nickname}!

Você está concorrendo com ${codeLabel} no nosso sorteio.
${drawBlock.text}
Boa sorte!

Equipe Panini XP`

  const html = buildEmailHtml(`
<p>Olá, <strong>${nickname}</strong>!</p>
<p>Você está concorrendo com <strong>${codeLabel}</strong> no nosso sorteio.</p>
${drawBlock.html}
<p>Boa sorte!</p>
`)

  return { subject, text, html }
}

function buildReuploadEmail(nickname: string) {
  const subject = `Reenvie seu recibo antes do sorteio de ${DRAW_DATE} | Panini XP`
  const drawBlock = buildDrawBlock('urgent', 'announced')

  const text = `Olá, ${nickname}!

Recebemos seu recibo, mas a foto não pôde ser lida. Para participar do sorteio, envie uma nova foto antes do dia ${DRAW_DATE}.

Envie sua nova foto aqui:
👉 ${REUPLOAD_URL}
${drawBlock.text}
Equipe Panini XP`

  const html = buildEmailHtml(`
<p>Olá, <strong>${nickname}</strong>!</p>
<p>Recebemos seu recibo, mas a foto não pôde ser lida. Para participar do sorteio, envie uma nova foto <strong>antes do dia ${DRAW_DATE}</strong>.</p>
${ctaButton('Enviar nova foto', REUPLOAD_URL)}
${drawBlock.html}
`)

  return { subject, text, html }
}

// ── Send via Resend REST API ───────────────────────────────────────────────────

const FROM = 'Panini XP <copa2026@paninixp.com.br>'
const REPLY_TO = 'campinas@paninixp.com.br'

async function sendEmail(to: string, subject: string, text: string, html: string): Promise<string> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY not set')

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, reply_to: REPLY_TO, to: [to], subject, text, html }),
  })
  const body = await res.json() as { id?: string; message?: string }
  if (!res.ok) throw new Error(body.message ?? `HTTP ${res.status}`)
  return body.id ?? '(no id)'
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const { dryRun, segment, limit, toOverride } = parseArgs()

  console.log('=== Panini XP draw announcement blast ===')
  console.log(`  Segment:   ${segment}`)
  console.log(`  Dry run:   ${dryRun}`)
  console.log(`  Limit:     ${limit ?? 'none'}`)
  console.log(`  To:        ${toOverride || '(real audience)'}`)
  console.log(`  Draw date: ${DRAW_DATE}`)
  console.log('')

  const supabase = createAdminClient()

  // ── Fetch audiences ──────────────────────────────────────────────────────────

  let approvedRows: ApprovedRow[] = []
  let reuploadRows: ReuploadRow[] = []

  if (segment === 'approved' || segment === 'both') {
    process.stdout.write('Querying approved segment...')
    approvedRows = await queryApproved(supabase)
    console.log(` ${approvedRows.length} recipients`)
  }

  if (segment === 'awaiting-reupload' || segment === 'both') {
    process.stdout.write('Querying awaiting-reupload segment...')
    reuploadRows = await queryAwaitingReupload(supabase)
    console.log(` ${reuploadRows.length} recipients`)
  }

  const totalAudience = approvedRows.length + reuploadRows.length
  const totalToSend = limit !== null ? Math.min(limit, totalAudience) : totalAudience
  console.log(`\nTotal audience: ${totalAudience}. Emails to send: ${totalToSend}.`)

  // ── Dry run ──────────────────────────────────────────────────────────────────

  if (dryRun) {
    console.log('\n--- APPROVED segment sample (first 5) ---')
    for (const p of approvedRows.slice(0, 5)) {
      console.log(`  ${p.email.padEnd(40)} | ${p.nickname.padEnd(20)} | ${p.code_count} code(s)`)
    }

    console.log('\n--- AWAITING_REUPLOAD segment sample (first 5) ---')
    for (const p of reuploadRows.slice(0, 5)) {
      console.log(`  ${p.email.padEnd(40)} | ${p.nickname}`)
    }

    console.log('\nDry run complete. No emails sent.')
    return
  }

  // ── Real send ────────────────────────────────────────────────────────────────

  let sentApproved = 0
  let failedApproved = 0
  let sentReupload = 0
  let failedReupload = 0
  let totalSent = 0

  // Approved segment
  for (const p of approvedRows) {
    if (limit !== null && totalSent >= limit) break

    const to = toOverride || p.email
    const nickname = toOverride ? 'Smoke Test' : p.nickname
    const { subject, text, html } = buildApprovedEmail(nickname, p.code_count)
    const label = `[approved ${totalSent + 1}/${totalToSend}] ${p.email}`

    try {
      const id = await sendEmail(to, subject, text, html)
      console.log(`${label} -> SENT (id=${id})`)
      sentApproved++
    } catch (err) {
      console.log(`${label} -> FAILED: ${err instanceof Error ? err.message : String(err)}`)
      failedApproved++
    }

    totalSent++
    await sleep(200)
  }

  // Awaiting-reupload segment
  for (const p of reuploadRows) {
    if (limit !== null && totalSent >= limit) break

    const to = toOverride || p.email
    const nickname = toOverride ? 'Smoke Test' : p.nickname
    const { subject, text, html } = buildReuploadEmail(nickname)
    const label = `[reupload  ${totalSent + 1}/${totalToSend}] ${p.email}`

    try {
      const id = await sendEmail(to, subject, text, html)
      console.log(`${label} -> SENT (id=${id})`)
      sentReupload++
    } catch (err) {
      console.log(`${label} -> FAILED: ${err instanceof Error ? err.message : String(err)}`)
      failedReupload++
    }

    totalSent++
    await sleep(200)
  }

  // ── Summary ──────────────────────────────────────────────────────────────────

  console.log('')
  console.log('==========================================')
  console.log('Summary')
  console.log('==========================================')
  console.log(`  Approved segment:          ${sentApproved} sent, ${failedApproved} failed`)
  console.log(`  Awaiting-reupload segment: ${sentReupload} sent, ${failedReupload} failed`)
  console.log(`  Total:                     ${sentApproved + sentReupload} sent, ${failedApproved + failedReupload} failed`)

  if (failedApproved + failedReupload > 0) process.exit(1)
}

main().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
