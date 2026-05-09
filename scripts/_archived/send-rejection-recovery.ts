import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

// ── Env validation ────────────────────────────────────────────────────────────

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

// ── Arg parsing ───────────────────────────────────────────────────────────────

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

// ── Types ─────────────────────────────────────────────────────────────────────

// PostgREST returns many-to-one FK joins as a single object at runtime,
// despite TypeScript inferring them as arrays. Cast via as unknown as ReceiptRow[].
type ReceiptRow = {
  id: string
  created_at: string
  participant_id: string
  participants: {
    id: string
    nickname: string | null
    email: string | null
    created_at: string
  } | null
}

type Recipient = {
  participantId: string
  nickname: string | null
  email: string
  participantCreatedAt: string
  receiptCreatedAt: string
}

// ── Counters (module-level so SIGINT handler can read them) ───────────────────

let sent = 0
let failed = 0
let skippedNoEmail = 0

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function formatBrDate(isoOrTimestamp: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(
    new Date(isoOrTimestamp)
  )
}

function printSummary(total: number): void {
  console.log('\n========== SUMMARY ==========')
  console.log(`Total recipients:      ${total}`)
  console.log(`Sent:                  ${sent}`)
  console.log(`Failed:                ${failed}`)
  console.log(`Skipped (no email):    ${skippedNoEmail}`)
  console.log('=============================')
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { createAdminClient } = await import('../lib/supabase-admin')
  const { logError } = await import('../lib/log-error')
  const { Resend } = await import('resend')

  const supabase = createAdminClient()

  console.log('========== REJECTION RECOVERY BLAST ==========')
  console.log(`Mode:  ${dryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log(`Limit: ${limit !== null ? limit : 'none (all)'}`)
  console.log('===============================================\n')

  // Fetch all rejected receipts with participant join
  const { data: rawRows, error: fetchError } = await supabase
    .from('receipts')
    .select('id, created_at, participant_id, participants(id, nickname, email, created_at)')
    .eq('status', 'rejected')

  if (fetchError || rawRows === null) {
    console.error(`Failed to fetch rejected receipts: ${fetchError?.message ?? 'no data'}`)
    process.exit(1)
  }

  const rows = rawRows as unknown as ReceiptRow[]

  // Deduplicate by participant: one email per participant even with multiple rejected receipts.
  // For the receipt date shown in the email, use the most recent rejected receipt.
  // Track no-email participants separately for the summary.
  const noEmailParticipants = new Set<string>()
  const participantMap = new Map<string, Recipient>()

  for (const row of rows) {
    const p = row.participants

    if (!p) continue

    if (!p.email || p.email === '') {
      noEmailParticipants.add(p.id)
      continue
    }

    const existing = participantMap.get(p.id)
    if (!existing || row.created_at > existing.receiptCreatedAt) {
      participantMap.set(p.id, {
        participantId: p.id,
        nickname: p.nickname,
        email: p.email,
        participantCreatedAt: p.created_at,
        receiptCreatedAt: row.created_at,
      })
    }
  }

  skippedNoEmail = noEmailParticipants.size

  // Sort by participant registration date ASC (oldest customer first — fairness)
  let recipients: Recipient[] = Array.from(participantMap.values()).sort(
    (a, b) => a.participantCreatedAt.localeCompare(b.participantCreatedAt)
  )

  if (limit !== null) {
    recipients = recipients.slice(0, limit)
  }

  const total = recipients.length

  if (total === 0) {
    console.log('No recipients with email found. Nothing to send.')
    console.log(`(${skippedNoEmail} rejected-receipt participant(s) have no email on file.)`)
    return
  }

  // ── Dry run ────────────────────────────────────────────────────────────────

  if (dryRun) {
    console.log(`DRY RUN — ${total} recipient(s) would receive an email:\n`)
    for (const r of recipients) {
      const date = formatBrDate(r.receiptCreatedAt)
      console.log(`  ${(r.nickname ?? '(sem apelido)').padEnd(28)} ${r.email.padEnd(36)} receipt: ${date}`)
    }
    console.log(`\nTotal: ${total}`)
    console.log(`Skipped (no email): ${skippedNoEmail}`)
    return
  }

  // ── Live run ───────────────────────────────────────────────────────────────

  console.log(`About to send ${total} email(s). Starting in 5 seconds. Ctrl+C to abort.\n`)

  process.on('SIGINT', () => {
    console.log('\n\nAborted by user.')
    printSummary(total)
    process.exit(0)
  })

  await sleep(5000)

  const resend = new Resend(process.env.RESEND_API_KEY)

  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i]
    const nickname = r.nickname ?? 'participante'
    const date = formatBrDate(r.receiptCreatedAt)

    console.log(`[${i + 1}/${total}] Sending to ${r.email} (${nickname})...`)

    const text = `Olá, ${nickname}!

Identificamos uma possível inconsistência no processamento automático do seu recibo enviado em ${date} e queremos garantir que a análise foi correta.

Nossa equipe vai revisar manualmente o seu recibo nos próximos dias. Se identificarmos que o recibo é válido, você receberá os códigos correspondentes para o sorteio da Copa do Mundo 2026.

Não é necessário fazer nada agora — assim que concluirmos a revisão, enviaremos uma nova mensagem com o resultado.

Pedimos desculpas pelo inconveniente.

Equipe Panini XP`

    try {
      await resend.emails.send({
        from: 'Panini XP <copa2026@paninixp.com.br>',
        replyTo: 'campinas@paninixp.com.br',
        to: r.email,
        subject: 'Vamos revisar seu recibo — Panini XP',
        text,
      })
      sent++
      console.log(`  → sent\n`)
    } catch (err) {
      failed++
      await logError('send-rejection-recovery', 'failed to send', {
        participant_id: r.participantId,
        email: r.email,
        error: String(err),
      })
      console.log(`  → failed: ${String(err)}\n`)
    }

    if (i < recipients.length - 1) {
      await sleep(600)
    }
  }

  printSummary(total)
}

main().catch(err => {
  console.error('Unexpected error:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
