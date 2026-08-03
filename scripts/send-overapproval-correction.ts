export {}

/**
 * One-off correction email for Jessica Aguiar (jessica_aguiar@live.com, nickname Jessyaguiare).
 *
 * Context: her R$239,80 receipt was manually approved with 10 codes by mistake.
 * By the campaign rule (1 código a cada R$50), the correct count is 4 codes.
 * The DB has already been corrected before this script runs — this script only
 * sends the notification email. It does not touch the database.
 *
 * Usage:
 *   # Dry run — sends the real content to your own inbox instead of the customer
 *   npx tsx scripts/send-overapproval-correction.ts --to=leonardomagosteiro@gmail.com
 *
 *   # Real send to the customer
 *   npx tsx scripts/send-overapproval-correction.ts
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import { buildEmailHtml } from '../lib/send-receipt-emails'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

// ── CLI arg parsing ────────────────────────────────────────────────────────────

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const eq = a.indexOf('=')
    return eq === -1 ? [a.replace(/^--/, ''), ''] : [a.slice(2, eq), a.slice(eq + 1)]
  })
)

const toOverride = args['to'] ?? ''

if (toOverride && !toOverride.includes('@')) {
  console.error(`ERROR: --to "${toOverride}" does not look like a valid email address.`)
  process.exit(1)
}

// ── Case data ───────────────────────────────────────────────────────────────────

const CUSTOMER_EMAIL = 'jessica_aguiar@live.com'
const NICKNAME = 'Jessyaguiare'
const AMOUNT_DISPLAY = 'R$239,80'
const CORRECT_CODE_COUNT = 4

const VALID_CODES = [
  'PXP-2026-94O40',
  'PXP-2026-D0A49',
  'PXP-2026-0FVHD',
  'PXP-2026-BHGWG',
]

const REVOKED_CODES = [
  'PXP-2026-60RA0',
  'PXP-2026-ZN2WF',
  'PXP-2026-LDPFY',
  'PXP-2026-S7O3B',
  'PXP-2026-WMH7W',
  'PXP-2026-G503I',
]

const FROM = 'Panini XP <copa2026@paninixp.com.br>'
const REPLY_TO = 'campinas@paninixp.com.br'
const SUBJECT = 'Correção no número de códigos — Panini XP 2026'

// ── Plain-text body ────────────────────────────────────────────────────────────

const revokedCodesText = REVOKED_CODES.map(c => `  (removido) ${c}`).join('\n')
const validCodesText = VALID_CODES.join('\n')

const textBody = `Olá, ${NICKNAME}!

Precisamos te informar sobre uma correção que fizemos em sua conta.

Ao revisar manualmente o seu recibo de ${AMOUNT_DISPLAY}, nossa equipe cometeu um erro e gerou 10 códigos para essa compra. Pela regra da campanha — 1 código a cada R$50,00 em compras — o valor correto é ${CORRECT_CODE_COUNT} códigos (${AMOUNT_DISPLAY} ÷ R$50,00 = ${CORRECT_CODE_COUNT}).

Já corrigimos isso em nosso sistema. Isso foi um erro nosso, não seu.

Os códigos removidos foram:
${revokedCodesText}

Seus ${CORRECT_CODE_COUNT} códigos válidos permanecem íntegros e totalmente ativos no sorteio Panini XP 2026:

${validCodesText}

Pedimos desculpas pela confusão. Qualquer dúvida, é só responder este email.

Boa sorte!

Equipe Panini XP`

// ── HTML body ─────────────────────────────────────────────────────────────────

const revokedCodesHtml = REVOKED_CODES
  .map(c => `  <tr><td style="font-family:monospace;font-size:15px;color:#999999;letter-spacing:1px;text-decoration:line-through;padding:4px 0;">${c}</td></tr>`)
  .join('\n')

const validCodesHtml = VALID_CODES
  .map(c => `  <tr><td style="font-family:monospace;font-size:18px;font-weight:bold;color:#111111;letter-spacing:1px;padding:6px 0;">${c}</td></tr>`)
  .join('\n')

const htmlBody = buildEmailHtml(`
<p>Olá, <strong>${NICKNAME}</strong>!</p>
<p>Precisamos te informar sobre uma correção que fizemos em sua conta.</p>
<p>Ao revisar manualmente o seu recibo de <strong>${AMOUNT_DISPLAY}</strong>, nossa equipe cometeu um erro e gerou 10 códigos para essa compra. Pela regra da campanha — <strong>1 código a cada R$50,00</strong> em compras — o valor correto é <strong>${CORRECT_CODE_COUNT} códigos</strong> (${AMOUNT_DISPLAY} ÷ R$50,00 = ${CORRECT_CODE_COUNT}).</p>
<p><strong>Já corrigimos isso em nosso sistema. Isso foi um erro nosso, não seu.</strong></p>
<p>Os códigos removidos foram:</p>
<table width="100%" cellpadding="4" cellspacing="0" role="presentation" style="margin:12px 0;">
${revokedCodesHtml}
</table>
<p>Seus <strong>${CORRECT_CODE_COUNT} códigos válidos</strong> permanecem íntegros e totalmente ativos no sorteio Panini XP 2026:</p>
<table width="100%" cellpadding="12" cellspacing="0" role="presentation" style="background:#f5f5f5;border-radius:6px;margin:20px 0;">
${validCodesHtml}
</table>
<p>Pedimos desculpas pela confusão. Qualquer dúvida, é só responder este email.</p>
<p>Boa sorte!</p>
`)

// ── Send via Resend REST API ───────────────────────────────────────────────────

async function main() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('ERROR: RESEND_API_KEY is not set in the environment.')
    process.exit(1)
  }

  const to = toOverride || CUSTOMER_EMAIL

  console.log(`Sending overapproval correction email to: ${to}`)
  if (toOverride) {
    console.log(`(DRY RUN — real customer is ${CUSTOMER_EMAIL}, overridden by --to)`)
  }
  console.log(`Nickname: ${NICKNAME}`)
  console.log(`Subject: ${SUBJECT}`)
  console.log(`Revoked codes (${REVOKED_CODES.length}):`)
  for (const c of REVOKED_CODES) console.log(`  ${c}`)
  console.log(`Valid codes (${VALID_CODES.length}):`)
  for (const c of VALID_CODES) console.log(`  ${c}`)
  console.log('')

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, reply_to: REPLY_TO, to: [to], subject: SUBJECT, text: textBody, html: htmlBody }),
  })

  const body = await res.json() as { id?: string; message?: string }

  if (!res.ok) {
    console.error(`ERROR: Resend returned HTTP ${res.status}: ${body.message ?? JSON.stringify(body)}`)
    process.exit(1)
  }

  console.log('SUCCESS')
  console.log(`Resend id: ${body.id ?? '(no id)'}`)
}

main().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
