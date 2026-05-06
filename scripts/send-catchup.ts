import * as dotenv from 'dotenv'
import * as readline from 'readline'

dotenv.config({ path: '.env.local' })

// ── Env validation ────────────────────────────────────────────────────────────

const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'RESEND_API_KEY',
] as const

const missing = REQUIRED_ENV_VARS.filter(v => !process.env[v])
if (missing.length > 0) {
  console.error(`❌ Missing required env vars: ${missing.join(', ')}. Check your .env.local file.`)
  process.exit(1)
}

import { createAdminClient } from '../lib/supabase-admin'
import { logError } from '../lib/log-error'
import { Resend } from 'resend'

// ── Constants ─────────────────────────────────────────────────────────────────

const CUTOFF = '2026-05-02T13:00:00.000Z'

// ── Types ─────────────────────────────────────────────────────────────────────

type Participant = {
  id: string
  nickname: string | null
  email: string
  cpf: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function maskCPF(cpf: string): string {
  const digits = cpf.replace(/\D/g, '')
  return `***.***.***-${digits.slice(-4)}`
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return '***'
  return `${local.slice(0, 3)}***@${domain}`
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function waitForEnter(): Promise<void> {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question('', () => {
      rl.close()
      resolve()
    })
  })
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const isDryRun = process.argv.includes('--dry-run')
  const supabase = createAdminClient()

  // Step 1: fetch all CPFs from receipts uploaded before the cutoff
  const { data: receiptRows, error: receiptsError } = await supabase
    .from('receipts')
    .select('cpf')
    .lt('created_at', CUTOFF)

  if (receiptsError) {
    console.error(`❌ Failed to fetch receipts: ${receiptsError.message}`)
    process.exit(1)
  }

  const cpfsWithEarlyReceipt = new Set<string>((receiptRows ?? []).map(r => r.cpf as string))

  if (cpfsWithEarlyReceipt.size === 0) {
    console.log('No receipts found before cutoff. Nothing to send.')
    process.exit(0)
  }

  // Step 2: fetch matching participants with email
  const { data: participantRows, error: participantsError } = await supabase
    .from('participants')
    .select('id, nickname, email, cpf')
    .in('cpf', Array.from(cpfsWithEarlyReceipt))
    .not('email', 'is', null)
    .neq('email', '')

  if (participantsError) {
    console.error(`❌ Failed to fetch participants: ${participantsError.message}`)
    process.exit(1)
  }

  const recipients = (participantRows ?? []) as Participant[]

  // ── Dry run ────────────────────────────────────────────────────────────────

  if (isDryRun) {
    console.log(`\nDRY RUN — ${recipients.length} recipient(s) would receive a catch-up email:\n`)
    for (const p of recipients) {
      console.log(`  ${(p.nickname ?? '(sem apelido)').padEnd(24)} ${maskCPF(p.cpf).padEnd(18)} ${maskEmail(p.email)}`)
    }
    console.log(`\nTotal: ${recipients.length}`)
    process.exit(0)
  }

  // ── Live run ───────────────────────────────────────────────────────────────

  if (recipients.length === 0) {
    console.log('No recipients found. Nothing to send.')
    process.exit(0)
  }

  console.log(`\nAbout to send ${recipients.length} email(s). Press Enter to continue or Ctrl+C to cancel.`)
  await waitForEnter()

  const resend = new Resend(process.env.RESEND_API_KEY)
  let sent = 0
  let failed = 0

  for (const p of recipients) {
    const masked = maskEmail(p.email)
    const greeting = p.nickname ? `Olá, ${p.nickname}!` : 'Olá!'

    try {
      await resend.emails.send({
        from: 'Panini XP <copa2026@paninixp.com.br>',
        replyTo: 'campinas@paninixp.com.br',
        to: p.email,
        subject: 'Recibo recebido — Panini XP',
        text: `${greeting}\n\nConfirmamos que recebemos seu(s) recibo(s) da Panini Point Experience. Estamos processando todas as participações com cuidado.\n\nEm breve você receberá seus códigos para concorrer aos prêmios da Copa do Mundo 2026.\n\nOs códigos serão enviados antes de qualquer sorteio, então fique tranquilo.\n\nObrigado pela paciência e por participar!\n\nEquipe Panini XP`,
      })
      console.log(`✅ ${masked}`)
      sent++
    } catch (err) {
      console.log(`❌ ${masked} — ${String(err)}`)
      await logError('send-catchup', 'Failed to send catch-up email', {
        participant_id: p.id,
        cpf: p.cpf,
        error: String(err),
      })
      failed++
    }

    await sleep(600)
  }

  console.log(`\nDone. Sent: ${sent} / Failed: ${failed} / Total: ${recipients.length}`)
}

main().catch(err => { console.error(err); process.exit(1) })
