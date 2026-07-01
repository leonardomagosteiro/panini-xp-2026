export {}

/**
 * One-off winner notification email.
 *
 * Sends a single email to the draw winner via the Resend API.
 * --to is required; no recipient is hardcoded.
 *
 * Usage:
 *   npx tsx scripts/send-winner-email.ts --to=winner@example.com
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

const to = args['to'] ?? ''

if (!to) {
  console.error('ERROR: --to is required.')
  console.error('Usage: npx tsx scripts/send-winner-email.ts --to=winner@example.com')
  process.exit(1)
}

if (!to.includes('@')) {
  console.error(`ERROR: --to "${to}" does not look like a valid email address.`)
  process.exit(1)
}

// ── Email content ───────────────────────────────────────────────────────────────

const FROM = 'Panini XP <diretoria@paninixp.com.br>'
const REPLY_TO = 'diretoria@paninixp.com.br'
const SUBJECT = 'Parabéns! Você é o ganhador do sorteio Panini XP 2026'

const HTML = `<div style="font-family: Arial, sans-serif; font-size: 16px; color: #222; line-height: 1.5;">
  <p>Olá, Rodrigo!</p>
  <p>Temos uma ótima notícia: <strong>você foi o ganhador do sorteio Panini XP 2026</strong>, realizado ao vivo no nosso Instagram no dia 30 de junho. Parabéns!</p>
  <p style="text-align: center; margin: 24px 0;">
    <img src="https://app.paninixp.com.br/prize-camiseta-brasil.png" alt="Premio Panini XP 2026" style="max-width: 320px; width: 100%; height: auto; border-radius: 8px;" />
  </p>
  <p>Para combinarmos a entrega do seu prêmio, precisamos de uma informação: <strong>qual é o tamanho da sua camisa?</strong> (P, M, G, GG ou XG)</p>
  <p>É só nos responder <strong>até o dia 6 de julho de 2026, às 23h59</strong>, por um destes canais, informando o tamanho:</p>
  <ul>
    <li><strong>Respondendo este e-mail</strong> (diretoria@paninixp.com.br)</li>
    <li><strong>Por mensagem direta no Instagram</strong> <a href="https://instagram.com/paninixp">@paninixp</a></li>
  </ul>
  <p><strong>Importante:</strong> caso não recebamos sua resposta até essa data, um novo sorteio será realizado para escolher outro ganhador.</p>
  <p>Assim que você responder, nossa equipe segue com você para confirmar seus dados e organizar tudo.</p>
  <p>Mais uma vez, parabéns e obrigado por participar!</p>
  <p><strong>Equipe Panini XP</strong></p>
</div>`

const TEXT = `Olá, Rodrigo!

Temos uma ótima notícia: você foi o ganhador do sorteio Panini XP 2026, realizado ao vivo no nosso Instagram no dia 30 de junho. Parabéns!

Para combinarmos a entrega do seu prêmio, precisamos de uma informação: qual é o tamanho da sua camisa? (P, M, G, GG ou XG)

É só nos responder até o dia 6 de julho de 2026, às 23h59, por um destes canais, informando o tamanho:

- Respondendo este e-mail (diretoria@paninixp.com.br)
- Por mensagem direta no Instagram: @paninixp (https://instagram.com/paninixp)

Importante: caso não recebamos sua resposta até essa data, um novo sorteio será realizado para escolher outro ganhador.

Assim que você responder, nossa equipe segue com você para confirmar seus dados e organizar tudo.

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
