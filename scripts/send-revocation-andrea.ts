export {}

/**
 * One-off revocation/correction email for Andrea Oliveira Andrade (deiaoandrade@hotmail.com).
 *
 * Context: participant RB2026 uploaded the same receipt twice. The first upload
 * was correctly approved on 2026-06-28 at 14:18 UTC with 7 codes. The second
 * upload was approved by mistake at 16:38 UTC, generating 1 extra code
 * (PXP-2026-KXQVU). DB has been patched: orphan code deleted, code_count
 * corrected to 7, duplicate receipt marked status=rejected/rejection_reason=duplicate.
 * This email notifies Andrea transparently and reassures her that her 7 original
 * codes remain valid.
 *
 * Run (after "set -a; source .env.local; set +a"):
 *   npx tsx scripts/send-revocation-andrea.ts
 */

const TO = 'deiaoandrade@hotmail.com'
const NICKNAME = 'RB2026'
const REVOKED_CODE = 'PXP-2026-KXQVU'
const VALID_CODES = [
  'PXP-2026-6CDFP',
  'PXP-2026-0XK1S',
  'PXP-2026-P5Q3F',
  'PXP-2026-935TS',
  'PXP-2026-UOCDX',
  'PXP-2026-ERG9W',
  'PXP-2026-WL71O',
]

const FROM = 'Panini XP <copa2026@paninixp.com.br>'
const REPLY_TO = 'campinas@paninixp.com.br'
const LOGO_URL = 'https://app.paninixp.com.br/logo-panini-xp.png'
const SUBJECT = 'Correção - código duplicado removido | Panini XP 2026'

// ── Plain-text body ────────────────────────────────────────────────────────────

const validCodesText = VALID_CODES.join('\n')

const textBody = `Olá, ${NICKNAME}!

Precisamos te informar sobre uma situação que identificamos em nossa análise de hoje.

Detectamos que o mesmo recibo foi enviado duas vezes em nosso sistema. O primeiro envio foi aprovado corretamente. O segundo envio foi aprovado por engano durante a revisão manual da nossa equipe, gerando um código adicional indevido.

O código que não deveria ter sido gerado é:
${REVOKED_CODE}

Já removemos esse código do nosso sistema. Isso foi um erro nosso, não seu.

Seus ${VALID_CODES.length} códigos válidos, gerados na aprovação original, permanecem íntegros e serão utilizados normalmente no sorteio do dia 30 de junho:

${validCodesText}

Pedimos desculpas pela confusão. Seus códigos estão seguros e válidos para o sorteio.

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

const validCodesHtml = VALID_CODES
  .map(c => `  <tr><td style="font-family:monospace;font-size:18px;font-weight:bold;color:#111111;letter-spacing:1px;padding:6px 0;">${c}</td></tr>`)
  .join('\n')

const htmlBody = buildEmailHtml(`
<p>Olá, <strong>${NICKNAME}</strong>!</p>
<p>Precisamos te informar sobre uma situação que identificamos em nossa análise de hoje.</p>
<p>Detectamos que o mesmo recibo foi enviado duas vezes em nosso sistema. O primeiro envio foi aprovado corretamente. O segundo envio foi aprovado por engano durante a revisão manual da nossa equipe, gerando um código adicional indevido.</p>
<p>O código que não deveria ter sido gerado é:</p>
<p style="font-family:monospace;font-size:16px;font-weight:bold;color:#888888;letter-spacing:1px;text-decoration:line-through;margin:8px 0;">${REVOKED_CODE}</p>
<p>Já removemos esse código do nosso sistema. <strong>Isso foi um erro nosso, não seu.</strong></p>
<p>Seus <strong>${VALID_CODES.length} códigos válidos</strong>, gerados na aprovação original, permanecem íntegros e serão utilizados normalmente no sorteio do dia <strong>30 de junho</strong>:</p>
<table width="100%" cellpadding="12" cellspacing="0" role="presentation" style="background:#f5f5f5;border-radius:6px;margin:20px 0;">
${validCodesHtml}
</table>
<p>Pedimos desculpas pela confusão. Seus códigos estão seguros e válidos para o sorteio.</p>
<p>Boa sorte!</p>
`)

// ── Send via Resend REST API ───────────────────────────────────────────────────

async function main() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('ERROR: RESEND_API_KEY is not set. Run: set -a; source .env.local; set +a')
    process.exit(1)
  }

  console.log(`Sending revocation/correction email to: ${TO}`)
  console.log(`Nickname: ${NICKNAME}`)
  console.log(`Subject: ${SUBJECT}`)
  console.log(`Revoked code: ${REVOKED_CODE}`)
  console.log(`Valid codes (${VALID_CODES.length}):`)
  for (const c of VALID_CODES) console.log(`  ${c}`)
  console.log('')

  const payload = {
    from: FROM,
    reply_to: REPLY_TO,
    to: [TO],
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
