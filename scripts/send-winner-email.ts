export {}

/**
 * Generalized winner notification email.
 *
 * Sends a single email to a draw winner via the Resend API. Reusable across draws.
 *
 * Usage:
 *   npx tsx scripts/send-winner-email.ts --to=winner@example.com --name=Fulano --draw-date="31 de julho" --deadline="9 de agosto de 2026, as 23h59" --prize-image=https://app.paninixp.com.br/prize-bola-oficial.png
 */

import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

// ── CLI arg parsing ─────────────────────────────────────────────────────────────

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const eq = a.indexOf('=')
    return eq === -1 ? [a.replace(/^--/, ''), ''] : [a.slice(2, eq), a.slice(eq + 1)]
  })
)

const USAGE = 'Usage: npx tsx scripts/send-winner-email.ts --to=winner@example.com --name=Fulano --draw-date="31 de julho" --deadline="9 de agosto de 2026, as 23h59" [--prize-image=https://...]'

const to = args['to'] ?? ''
const name = args['name'] ?? ''
const drawDate = args['draw-date'] ?? ''
const deadline = args['deadline'] ?? ''
const prizeImage = args['prize-image'] ?? ''

if (!to || !name || !drawDate || !deadline) {
  console.error('ERROR: missing required flags.')
  console.error('  --to           recipient email (required)')
  console.error('  --name         first name for the greeting (required)')
  console.error('  --draw-date    human-readable draw date in Portuguese, e.g. "31 de julho" (required)')
  console.error('  --deadline     human-readable reply deadline in Portuguese, e.g. "9 de agosto de 2026, as 23h59" (required)')
  console.error('  --prize-image  full https URL of a prize image (optional)')
  console.error(USAGE)
  process.exit(1)
}

if (!to.includes('@')) {
  console.error(`ERROR: --to "${to}" does not look like a valid email address.`)
  process.exit(1)
}

if (prizeImage && !prizeImage.startsWith('https://')) {
  console.error(`ERROR: --prize-image "${prizeImage}" must start with https://`)
  process.exit(1)
}

// ── Email content ───────────────────────────────────────────────────────────────

const FROM = 'Panini XP <diretoria@paninixp.com.br>'
const REPLY_TO = 'diretoria@paninixp.com.br'
const SUBJECT = 'Parabéns! Você é o ganhador do sorteio Panini XP 2026'

const prizeImageHtml = prizeImage
  ? `  <p style="text-align: center; margin: 24px 0;">
    <img src="${prizeImage}" alt="Prêmio Panini XP 2026" style="max-width: 320px; width: 100%; height: auto; border-radius: 8px;" />
  </p>
`
  : ''

const HTML = `<div style="font-family: Arial, sans-serif; font-size: 16px; color: #222; line-height: 1.5;">
  <p>Olá, ${name}!</p>
  <p>Temos uma ótima notícia: <strong>você foi o ganhador do sorteio Panini XP 2026</strong>, realizado ao vivo no nosso Instagram no dia ${drawDate}. Parabéns!</p>
${prizeImageHtml}  <p>Para combinarmos a entrega do seu prêmio, precisamos que você confirme o recebimento desta mensagem. É só nos responder até ${deadline}, por um destes canais:</p>
  <ul>
    <li><strong>Respondendo este e-mail</strong> (diretoria@paninixp.com.br)</li>
    <li><strong>Por mensagem direta no Instagram</strong> <a href="https://instagram.com/paninixp">@paninixp</a></li>
  </ul>
  <p><strong>Importante:</strong> caso não recebamos sua resposta até essa data, um novo sorteio será realizado para escolher outro ganhador.</p>
  <p>Assim que você responder, nossa equipe segue com você para confirmar seus dados e organizar a entrega do seu prêmio.</p>
  <p>Mais uma vez, parabéns e obrigado por participar!</p>
  <p><strong>Equipe Panini XP</strong></p>
</div>`

const TEXT = `Olá, ${name}!

Temos uma ótima notícia: você foi o ganhador do sorteio Panini XP 2026, realizado ao vivo no nosso Instagram no dia ${drawDate}. Parabéns!

Para combinarmos a entrega do seu prêmio, precisamos que você confirme o recebimento desta mensagem. É só nos responder até ${deadline}, por um destes canais:

- Respondendo este e-mail (diretoria@paninixp.com.br)
- Por mensagem direta no Instagram: @paninixp (https://instagram.com/paninixp)

Importante: caso não recebamos sua resposta até essa data, um novo sorteio será realizado para escolher outro ganhador.

Assim que você responder, nossa equipe segue com você para confirmar seus dados e organizar a entrega do seu prêmio.

Mais uma vez, parabéns e obrigado por participar!

Equipe Panini XP`

// ── Send ────────────────────────────────────────────────────────────────────────

async function main() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('ERROR: RESEND_API_KEY is not set in the environment.')
    process.exit(1)
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, reply_to: REPLY_TO, to: [to], subject: SUBJECT, text: TEXT, html: HTML }),
  })

  const body = await res.json() as { id?: string; message?: string }

  if (!res.ok) {
    console.error(`ERROR: Resend returned HTTP ${res.status}: ${body.message ?? JSON.stringify(body)}`)
    process.exit(1)
  }

  console.log(`Sent to: ${to}`)
  console.log(`Resend id: ${body.id ?? '(no id)'}`)
}

main()
