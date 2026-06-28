export {}

/**
 * Reusable one-off correction email: delivers a missed code to a customer
 * whose receipt was manually approved with fewer codes than they were owed.
 *
 * The DB must already be patched (codes table, participants.code_count,
 * receipts.codes_generated) before running this script.
 *
 * Usage example:
 *   set -a; source .env.local; set +a
 *   npx tsx scripts/send-correction-email.ts \
 *     --email=customer@example.com \
 *     --nickname=Fulano \
 *     --original-code=PXP-2026-AAAAA \
 *     --new-code=PXP-2026-BBBBB \
 *     --amount=105
 */

// ── CLI arg parsing ────────────────────────────────────────────────────────────

const CODE_PATTERN = /^PXP-2026-[A-Z0-9]{5}$/

const USAGE = `
Usage: npx tsx scripts/send-correction-email.ts \\
  --email=customer@example.com \\
  --nickname=Fulano \\
  --original-code=PXP-2026-AAAAA \\
  --new-code=PXP-2026-BBBBB \\
  --amount=105

Flags (all required):
  --email           Recipient email address
  --nickname        Customer first name as shown in other Panini XP emails
  --original-code   Code already sent to the customer (format PXP-2026-XXXXX)
  --new-code        Additional code to deliver now (format PXP-2026-XXXXX)
  --amount          Purchase amount in whole reais, e.g. 105 (positive integer, no decimals)
`.trim()

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {}
  for (const arg of argv.slice(2)) {
    const m = arg.match(/^--([a-zA-Z-]+)=(.+)$/)
    if (m) args[m[1]] = m[2]
  }
  return args
}

function validateArgs(args: Record<string, string>): {
  email: string
  nickname: string
  codeOriginal: string
  codeNew: string
  amount: number
} {
  const errors: string[] = []

  const email = args['email'] ?? ''
  const nickname = args['nickname'] ?? ''
  const codeOriginal = args['original-code'] ?? ''
  const codeNew = args['new-code'] ?? ''
  const amountRaw = args['amount'] ?? ''

  if (!email) errors.push('--email is required')
  else if (!email.includes('@')) errors.push(`--email "${email}" does not look like a valid email address`)

  if (!nickname) errors.push('--nickname is required')

  if (!codeOriginal) errors.push('--original-code is required')
  else if (!CODE_PATTERN.test(codeOriginal)) errors.push(`--original-code "${codeOriginal}" must match PXP-2026-XXXXX (5 uppercase alphanumeric chars)`)

  if (!codeNew) errors.push('--new-code is required')
  else if (!CODE_PATTERN.test(codeNew)) errors.push(`--new-code "${codeNew}" must match PXP-2026-XXXXX (5 uppercase alphanumeric chars)`)

  let amount = 0
  if (!amountRaw) {
    errors.push('--amount is required')
  } else if (!/^\d+$/.test(amountRaw)) {
    errors.push(`--amount "${amountRaw}" must be a positive integer (no decimals, no negatives)`)
  } else {
    amount = parseInt(amountRaw, 10)
    if (amount <= 0) errors.push(`--amount must be greater than zero`)
  }

  if (errors.length > 0) {
    console.error('ERROR: Missing or invalid arguments:\n')
    for (const e of errors) console.error(`  ${e}`)
    console.error(`\n${USAGE}`)
    process.exit(1)
  }

  return { email, nickname, codeOriginal, codeNew, amount }
}

const args = parseArgs(process.argv)
const { email, nickname, codeOriginal, codeNew, amount } = validateArgs(args)

// ── Derived values ─────────────────────────────────────────────────────────────

// "R$ 105,00" — two decimal places, comma separator, space after R$
const amountDisplay = `R$ ${amount},00`
// How many codes the customer was owed for this receipt
const codeCount = Math.floor(amount / 50)

// ── Email constants ────────────────────────────────────────────────────────────

const FROM = 'Panini XP <copa2026@paninixp.com.br>'
const REPLY_TO = 'campinas@paninixp.com.br'
const LOGO_URL = 'https://app.paninixp.com.br/logo-panini-xp.png'

// TODO: "seu segundo código" in the subject is accurate when the customer is
// owed exactly one extra code (total 2). For cases where total codes > 2
// (e.g., amount=150 → 3 codes, customer received 1), "segundo" is misleading.
// Parameterize or reword the subject before reusing this script for those cases.
const SUBJECT = 'Correção - seu segundo código Panini XP 2026'

// ── Plain-text body ────────────────────────────────────────────────────────────

const textBody = `Olá, ${nickname}!

Identificamos um erro na revisão manual do seu recibo de ${amountDisplay}. Por engano, enviamos apenas 1 código na aprovação — mas o valor de ${amountDisplay} garante ${codeCount} códigos (1 código a cada R$ 50 gastos).

Seu primeiro código, enviado anteriormente:
${codeOriginal}

Seu segundo código, gerado agora:
${codeNew}

Pedimos desculpas pela confusão. Ambos os códigos estão válidos e serão utilizados no sorteio do dia 30 de junho.

Boa sorte!

Equipe Panini XP`

// ── HTML body ─────────────────────────────────────────────────────────────────

function buildEmailHtml(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Panini XP</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f4f4f4;padding:24px 0;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;">
          <tr>
            <td align="center" style="padding:28px 24px 16px;">
              <a href="https://paninixp.com.br" style="display:block;text-decoration:none;">
                <img src="${LOGO_URL}" width="120" height="120" alt="Panini XP" style="display:block;border:0;" />
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#333333;line-height:1.7;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:16px 24px;border-top:1px solid #eeeeee;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#aaaaaa;">
              Equipe Panini XP &nbsp;&middot;&nbsp;
              <a href="https://paninixp.com.br" style="color:#aaaaaa;text-decoration:none;">paninixp.com.br</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

const htmlBody = buildEmailHtml(`
<p>Olá, <strong>${nickname}</strong>!</p>
<p>Identificamos um erro na revisão manual do seu recibo de <strong>R$&nbsp;${amount},00</strong>. Por engano, enviamos apenas 1 código na aprovação — mas o valor de R$&nbsp;${amount} garante <strong>${codeCount} códigos</strong> (1 código a cada R$&nbsp;50 gastos).</p>
<p>Seu primeiro código, enviado anteriormente:</p>
<table width="100%" cellpadding="12" cellspacing="0" role="presentation" style="background:#f5f5f5;border-radius:6px;margin:12px 0;">
  <tr>
    <td style="font-family:monospace;font-size:18px;font-weight:bold;color:#111111;letter-spacing:1px;padding:6px 0;">${codeOriginal}</td>
  </tr>
</table>
<p>Seu segundo código, gerado agora:</p>
<table width="100%" cellpadding="12" cellspacing="0" role="presentation" style="background:#f5f5f5;border-radius:6px;margin:12px 0;">
  <tr>
    <td style="font-family:monospace;font-size:18px;font-weight:bold;color:#111111;letter-spacing:1px;padding:6px 0;">${codeNew}</td>
  </tr>
</table>
<p>Pedimos desculpas pela confusão. Ambos os códigos estão válidos e serão utilizados no sorteio do dia <strong>30 de junho</strong>.</p>
<p>Boa sorte!</p>
`)

// ── Send via Resend REST API ───────────────────────────────────────────────────

async function main() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('ERROR: RESEND_API_KEY is not set. Run: set -a; source .env.local; set +a')
    process.exit(1)
  }

  console.log(`Sending correction email to: ${email}`)
  console.log(`Nickname: ${nickname}`)
  console.log(`Amount: ${amountDisplay} → ${codeCount} codes`)
  console.log(`Codes: ${codeOriginal} (original) + ${codeNew} (new)`)
  console.log(`Subject: ${SUBJECT}`)
  console.log('')

  const payload = {
    from: FROM,
    reply_to: REPLY_TO,
    to: [email],
    subject: SUBJECT,
    text: textBody,
    html: htmlBody,
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const responseBody = await res.json() as { id?: string; statusCode?: number; message?: string; name?: string }

  if (!res.ok) {
    console.error('ERROR: Resend API returned non-OK status:', res.status)
    console.error('Response body:', JSON.stringify(responseBody, null, 2))
    process.exit(1)
  }

  console.log('SUCCESS')
  console.log('Resend email id:', responseBody.id)
  console.log('HTTP status:', res.status)
}

main().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
