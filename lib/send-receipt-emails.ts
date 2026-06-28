import { Resend } from 'resend'
import { logError } from './log-error'

const FROM = 'Panini XP <copa2026@paninixp.com.br>'
const REPLY_TO = 'campinas@paninixp.com.br'
const REUPLOAD_URL = 'https://app.paninixp.com.br/enviar-recibo'
const LOGO_URL = 'https://app.paninixp.com.br/logo-panini-xp.png'
const INSTAGRAM_HANDLE = process.env.DRAW_INSTAGRAM_HANDLE || 'paninixp'
const INSTAGRAM_ICON_URL = 'https://app.paninixp.com.br/instagram-icon.png'
const PRIZE_IMAGE_URL = 'https://app.paninixp.com.br/prize-camiseta-brasil.png'

function formatBrDate(isoOrTimestamp: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(
    new Date(isoOrTimestamp)
  )
}

// CTA button rendered as a table cell for maximum email client compatibility
function ctaButton(label: string, url: string): string {
  return `<table cellpadding="0" cellspacing="0" role="presentation" style="margin:20px 0;">
  <tr>
    <td style="background:#111111;border-radius:6px;">
      <a href="${url}" style="display:inline-block;padding:12px 28px;color:#ffffff;text-decoration:none;font-weight:bold;font-family:Arial,Helvetica,sans-serif;font-size:15px;">${label}</a>
    </td>
  </tr>
</table>`
}

// Wraps body HTML in the standard Panini XP logo + container email template.
// Uses <table> layouts throughout for email client compatibility.
// Inline styles only — no <style> blocks.
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
              <img src="${INSTAGRAM_ICON_URL}" width="16" height="16" alt="" style="display:inline-block;vertical-align:middle;border:0;margin-right:6px;" /><a href="https://instagram.com/${INSTAGRAM_HANDLE}" style="color:#aaaaaa;text-decoration:none;">@${INSTAGRAM_HANDLE}</a>
              &nbsp;&middot;&nbsp;
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

// Draw announcement block injected into outgoing emails while DRAW_ANNOUNCEMENT_ACTIVE=true.
// Returns empty strings when the flag is off so callers need no conditional logic.
function buildDrawBlock(variant: 'celebratory' | 'urgent' | 'patient'): { text: string; html: string } {
  if (process.env.DRAW_ANNOUNCEMENT_ACTIVE !== 'true') {
    return { text: '', html: '' }
  }

  const date = process.env.DRAW_DATE_DISPLAY || '30 de junho'
  const handle = process.env.DRAW_INSTAGRAM_HANDLE || 'paninixp'
  const instagramUrl = `https://instagram.com/${handle}`
  const disclaimer = `Prêmio sujeito à disponibilidade na Centauro. Caso indisponível, oferecemos voucher de mesmo valor de compra na Centauro.`

  let headline: string
  let bodyPlain: string
  let bodyHtml: string

  if (variant === 'celebratory') {
    headline = `Sorteio ao vivo em ${date}`
    bodyPlain = `Seu(s) código(s) já estão na disputa! O sorteio acontece ao vivo no Instagram @${handle} no dia ${date}. O prêmio é uma Camiseta Oficial da Seleção Brasileira fornecida pela nossa parceira Centauro.`
    bodyHtml = `Seu(s) código(s) já estão na disputa! O sorteio acontece ao vivo no Instagram <a href="${instagramUrl}" style="color:#333333;">@${handle}</a> no dia ${date}. O prêmio é uma <strong>Camiseta Oficial da Seleção Brasileira</strong> fornecida pela nossa parceira Centauro.`
  } else if (variant === 'urgent') {
    headline = `Reenvie seu recibo antes do sorteio`
    bodyPlain = `O sorteio acontece ao vivo no Instagram @${handle} no dia ${date}. O prêmio é uma Camiseta Oficial da Seleção Brasileira fornecida pela nossa parceira Centauro. Para participar, reenvie a foto do seu recibo o quanto antes.`
    bodyHtml = `O sorteio acontece ao vivo no Instagram <a href="${instagramUrl}" style="color:#333333;">@${handle}</a> no dia ${date}. O prêmio é uma <strong>Camiseta Oficial da Seleção Brasileira</strong> fornecida pela nossa parceira Centauro. Para participar, reenvie a foto do seu recibo <strong>o quanto antes</strong>.`
  } else {
    headline = `Sorteio ao vivo em ${date}`
    bodyPlain = `O sorteio acontece ao vivo no Instagram @${handle} no dia ${date}. O prêmio é uma Camiseta Oficial da Seleção Brasileira fornecida pela nossa parceira Centauro. Enviaremos um e-mail confirmando o resultado da análise do seu recibo antes do sorteio.`
    bodyHtml = `O sorteio acontece ao vivo no Instagram <a href="${instagramUrl}" style="color:#333333;">@${handle}</a> no dia ${date}. O prêmio é uma <strong>Camiseta Oficial da Seleção Brasileira</strong> fornecida pela nossa parceira Centauro. Enviaremos um e-mail confirmando o resultado da análise do seu recibo antes do sorteio.`
  }

  const text = `\n${headline}\n\n${bodyPlain}\n\n${disclaimer}\n\nAcompanhar no Instagram: ${instagramUrl}\n`

  const html = `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f5f5f5;border-radius:6px;margin:20px 0;">
  <tr>
    <td style="padding:16px 20px;">
      <p style="font-size:16px;font-weight:bold;color:#111111;margin:0 0 12px 0;">${headline}</p>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 12px 0;">
        <tr>
          <td align="center">
            <img src="${PRIZE_IMAGE_URL}" alt="Camiseta Oficial da Seleção Brasileira" width="280" style="display:block;max-width:280px;width:100%;height:auto;border:0;border-radius:4px;" />
          </td>
        </tr>
      </table>
      <p style="font-size:15px;color:#333333;line-height:1.7;margin:0 0 12px 0;">${bodyHtml}</p>
      <p style="font-size:12px;color:#888888;line-height:1.6;margin:0 0 12px 0;">${disclaimer}</p>
      ${ctaButton('Acompanhar no Instagram', instagramUrl)}
    </td>
  </tr>
</table>`

  return { text, html }
}

// Email A — Approved with codes
export async function sendReceiptApproved(params: {
  participantId: string
  email: string
  nickname: string
  uploadDate: string
  codes: string[]
  amountBrl: number
}): Promise<void> {
  const date = formatBrDate(params.uploadDate)
  const n = params.codes.length
  const codeList = params.codes.join('\n')
  const drawBlock = buildDrawBlock('celebratory')
  const text = `Olá, ${params.nickname}!

Seu recibo enviado em ${date} foi aprovado! Você ganhou ${n} código(s) para o sorteio da Copa do Mundo 2026:

${codeList}

Guarde este email com cuidado. Os códigos serão usados no sorteio dos prêmios.

Quer mais chances? Envie outro recibo:
👉 ${REUPLOAD_URL}
${drawBlock.text}
Boa sorte!

Equipe Panini XP`

  const codesHtml = params.codes
    .map(c => `<tr><td style="font-family:monospace;font-size:18px;font-weight:bold;color:#111111;letter-spacing:1px;padding:6px 0;">${c}</td></tr>`)
    .join('')

  const bodyHtml = `
<p>Olá, <strong>${params.nickname}</strong>!</p>
<p>Seu recibo enviado em ${date} foi aprovado! Você ganhou <strong>${n} código(s)</strong> para o sorteio da Copa do Mundo 2026:</p>
<table width="100%" cellpadding="12" cellspacing="0" role="presentation" style="background:#f5f5f5;border-radius:6px;margin:20px 0;padding:4px 12px;">
  ${codesHtml}
</table>
<p>Guarde este email com cuidado. Os códigos serão usados no sorteio dos prêmios.</p>
<p>Quer mais chances? Envie outro recibo:</p>
${ctaButton('Enviar novo recibo', REUPLOAD_URL)}
${drawBlock.html}
<p>Boa sorte!</p>`

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: FROM,
      replyTo: REPLY_TO,
      to: params.email,
      subject: 'Seus códigos chegaram — Panini XP',
      text,
      html: buildEmailHtml(bodyHtml),
    })
  } catch (err) {
    await logError('send-receipt-emails', 'Failed to send approved email', {
      participant_id: params.participantId,
      email: params.email,
      error: String(err),
    })
  }
}

// Email B — Rejection: not a receipt
export async function sendReceiptRejectedNotReceipt(params: {
  participantId: string
  email: string
  nickname: string
  uploadDate: string
  isDelayedAnalysis?: boolean
}): Promise<void> {
  const prefix = params.isDelayedAnalysis ? 'Recebemos seu recibo há alguns dias e finalizamos a análise agora.\n\n' : ''
  const text = `${prefix}Olá, ${params.nickname}!

Não foi possível processar seu envio — a imagem não contém uma nota fiscal válida ou as informações necessárias.

Para receber seu(s) código(s), envie uma nova foto do recibo inteiro com:

📌 CNPJ da loja
📌 Razão social
📌 Data da compra
📌 Valor total
📌 Número do cupom

⚠️ Não envie apenas o QR Code — ele não é suficiente. Precisamos do recibo inteiro.

📸 Para uma boa leitura: iluminação clara, recibo plano, todos os cantos visíveis, texto legível.

👉 ${REUPLOAD_URL}

Equipe Panini XP`

  const prefixHtml = params.isDelayedAnalysis
    ? '<p style="color:#666666;font-style:italic;">Recebemos seu recibo há alguns dias e finalizamos a análise agora.</p>'
    : ''

  const bodyHtml = `
${prefixHtml}
<p>Olá, <strong>${params.nickname}</strong>!</p>
<p>Não foi possível processar seu envio — a imagem não contém uma nota fiscal válida ou as informações necessárias.</p>
<p>Para receber seu(s) código(s), envie uma nova foto do recibo inteiro com:</p>
<ul style="padding-left:20px;line-height:2.0;margin:12px 0;">
  <li>CNPJ da loja</li>
  <li>Razão social</li>
  <li>Data da compra</li>
  <li>Valor total</li>
  <li>Número do cupom</li>
</ul>
<p style="background:#fff3cd;border-left:4px solid #cc8800;padding:12px 16px;margin:16px 0;border-radius:0 4px 4px 0;">
  <strong>⚠️ Não envie apenas o QR Code</strong> — ele não é suficiente. Precisamos do recibo inteiro.
</p>
<p>📸 Para uma boa leitura: iluminação clara, recibo plano, todos os cantos visíveis, texto legível.</p>
${ctaButton('Enviar novo recibo', REUPLOAD_URL)}`

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: FROM,
      replyTo: REPLY_TO,
      to: params.email,
      subject: 'Não conseguimos processar seu envio — Panini XP',
      text,
      html: buildEmailHtml(bodyHtml),
    })
  } catch (err) {
    await logError('send-receipt-emails', 'Failed to send not-a-receipt rejection email', {
      participant_id: params.participantId,
      email: params.email,
      error: String(err),
    })
  }
}

// Email C — Rejection: wrong store / invalid CNPJ
export async function sendReceiptRejectedInvalidCnpj(params: {
  participantId: string
  email: string
  nickname: string
  uploadDate: string
  isDelayedAnalysis?: boolean
}): Promise<void> {
  const prefix = params.isDelayedAnalysis ? 'Recebemos seu recibo há alguns dias e finalizamos a análise agora.\n\n' : ''
  const text = `${prefix}Olá, ${params.nickname}!

Seu recibo foi recebido, mas o CNPJ da loja não está entre os participantes desta campanha.

A campanha Panini XP é válida apenas para compras realizadas nas Unidades Panini XP Participantes.

Você pode enviar um novo recibo de uma loja participante:
👉 ${REUPLOAD_URL}

Equipe Panini XP`

  const prefixHtml = params.isDelayedAnalysis
    ? '<p style="color:#666666;font-style:italic;">Recebemos seu recibo há alguns dias e finalizamos a análise agora.</p>'
    : ''

  const bodyHtml = `
${prefixHtml}
<p>Olá, <strong>${params.nickname}</strong>!</p>
<p>Seu recibo foi recebido, mas o CNPJ da loja não está entre os participantes desta campanha.</p>
<p>A campanha Panini XP é válida apenas para compras realizadas nas Unidades Panini XP Participantes.</p>
<p>Você pode enviar um novo recibo de uma loja participante:</p>
${ctaButton('Enviar novo recibo', REUPLOAD_URL)}`

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: FROM,
      replyTo: REPLY_TO,
      to: params.email,
      subject: 'Recibo não elegível — Panini XP',
      text,
      html: buildEmailHtml(bodyHtml),
    })
  } catch (err) {
    await logError('send-receipt-emails', 'Failed to send invalid-cnpj rejection email', {
      participant_id: params.participantId,
      email: params.email,
      error: String(err),
    })
  }
}

// Email D — Rejection: amount too low
export async function sendReceiptRejectedAmountTooLow(params: {
  participantId: string
  email: string
  nickname: string
  uploadDate: string
  amountBrl: number
  isDelayedAnalysis?: boolean
}): Promise<void> {
  const prefix = params.isDelayedAnalysis ? 'Recebemos seu recibo há alguns dias e finalizamos a análise agora.\n\n' : ''
  const text = `${prefix}Olá, ${params.nickname}!

Seu recibo foi recebido, mas o valor total está abaixo de R$50, que é o mínimo para gerar um código.

A regra é: a cada R$50 em compras, você ganha 1 código no sorteio.

Continue acumulando! Você pode enviar mais recibos a qualquer momento:
👉 ${REUPLOAD_URL}

Equipe Panini XP`

  const prefixHtml = params.isDelayedAnalysis
    ? '<p style="color:#666666;font-style:italic;">Recebemos seu recibo há alguns dias e finalizamos a análise agora.</p>'
    : ''

  const bodyHtml = `
${prefixHtml}
<p>Olá, <strong>${params.nickname}</strong>!</p>
<p>Seu recibo foi recebido, mas o valor total está abaixo de R$50, que é o mínimo para gerar um código.</p>
<p>A regra é: a cada R$50 em compras, você ganha 1 código no sorteio.</p>
<p>Continue acumulando! Você pode enviar mais recibos a qualquer momento:</p>
${ctaButton('Enviar novo recibo', REUPLOAD_URL)}`

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: FROM,
      replyTo: REPLY_TO,
      to: params.email,
      subject: 'Recibo recebido, mas abaixo do valor mínimo — Panini XP',
      text,
      html: buildEmailHtml(bodyHtml),
    })
  } catch (err) {
    await logError('send-receipt-emails', 'Failed to send amount-too-low rejection email', {
      participant_id: params.participantId,
      email: params.email,
      error: String(err),
    })
  }
}

// Email E — Rejection: date out of window
export async function sendReceiptRejectedDateOutOfWindow(params: {
  participantId: string
  email: string
  nickname: string
  uploadDate: string
  isDelayedAnalysis?: boolean
}): Promise<void> {
  const prefix = params.isDelayedAnalysis ? 'Recebemos seu recibo há alguns dias e finalizamos a análise agora.\n\n' : ''
  const text = `${prefix}Olá, ${params.nickname}!

Seu recibo foi recebido, mas a data não está dentro do período válido da campanha.

A campanha Panini XP é válida para compras realizadas a partir de 30/04/2026.

Envie um recibo dentro do período:
👉 ${REUPLOAD_URL}

Equipe Panini XP`

  const prefixHtml = params.isDelayedAnalysis
    ? '<p style="color:#666666;font-style:italic;">Recebemos seu recibo há alguns dias e finalizamos a análise agora.</p>'
    : ''

  const bodyHtml = `
${prefixHtml}
<p>Olá, <strong>${params.nickname}</strong>!</p>
<p>Seu recibo foi recebido, mas a data não está dentro do período válido da campanha.</p>
<p>A campanha Panini XP é válida para compras realizadas a partir de <strong>30/04/2026</strong>.</p>
<p>Envie um recibo dentro do período:</p>
${ctaButton('Enviar novo recibo', REUPLOAD_URL)}`

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: FROM,
      replyTo: REPLY_TO,
      to: params.email,
      subject: 'Recibo fora do período da campanha — Panini XP',
      text,
      html: buildEmailHtml(bodyHtml),
    })
  } catch (err) {
    await logError('send-receipt-emails', 'Failed to send date-out-of-window rejection email', {
      participant_id: params.participantId,
      email: params.email,
      error: String(err),
    })
  }
}

// Email F — Rejection: duplicate
export async function sendReceiptRejectedDuplicate(params: {
  participantId: string
  email: string
  nickname: string
  uploadDate: string
  isDelayedAnalysis?: boolean
}): Promise<void> {
  const prefix = params.isDelayedAnalysis ? 'Recebemos seu recibo há alguns dias e finalizamos a análise agora.\n\n' : ''
  const text = `${prefix}Olá, ${params.nickname}!

Recebemos seu envio, mas este recibo já foi registrado anteriormente em nossa campanha. Cada recibo só pode ser usado uma única vez.

Envie um novo recibo de outra compra:
👉 ${REUPLOAD_URL}

Equipe Panini XP`

  const prefixHtml = params.isDelayedAnalysis
    ? '<p style="color:#666666;font-style:italic;">Recebemos seu recibo há alguns dias e finalizamos a análise agora.</p>'
    : ''

  const bodyHtml = `
${prefixHtml}
<p>Olá, <strong>${params.nickname}</strong>!</p>
<p>Recebemos seu envio, mas este recibo já foi registrado anteriormente em nossa campanha. Cada recibo só pode ser usado uma única vez.</p>
<p>Envie um novo recibo de outra compra:</p>
${ctaButton('Enviar novo recibo', REUPLOAD_URL)}`

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: FROM,
      replyTo: REPLY_TO,
      to: params.email,
      subject: 'Recibo já registrado — Panini XP',
      text,
      html: buildEmailHtml(bodyHtml),
    })
  } catch (err) {
    await logError('send-receipt-emails', 'Failed to send duplicate rejection email', {
      participant_id: params.participantId,
      email: params.email,
      error: String(err),
    })
  }
}

// Email G — Please reupload (unreadable)
export async function sendReceiptPleaseReupload(params: {
  participantId: string
  email: string
  nickname: string
  uploadDate: string
  isDelayedAnalysis?: boolean
}): Promise<void> {
  const prefix = params.isDelayedAnalysis ? 'Recebemos seu recibo há alguns dias e finalizamos a análise agora.\n\n' : ''
  const drawBlock = buildDrawBlock('urgent')
  const text = `${prefix}Olá, ${params.nickname}!

Recebemos seu recibo, mas a imagem não está clara o suficiente para identificarmos as informações.

Por favor, tire uma nova foto do recibo com:
- Boa iluminação
- Recibo plano (sem dobras)
- Foco nítido
- Enquadramento completo (todo o recibo na foto)

Envie a nova foto aqui:
👉 ${REUPLOAD_URL}
${drawBlock.text}
Equipe Panini XP`

  const prefixHtml = params.isDelayedAnalysis
    ? '<p style="color:#666666;font-style:italic;">Recebemos seu recibo há alguns dias e finalizamos a análise agora.</p>'
    : ''

  const bodyHtml = `
${prefixHtml}
<p>Olá, <strong>${params.nickname}</strong>!</p>
<p>Recebemos seu recibo, mas a imagem não está clara o suficiente para identificarmos as informações.</p>
<p>Por favor, tire uma nova foto do recibo com:</p>
<ul style="padding-left:20px;line-height:2.0;margin:12px 0;">
  <li>Boa iluminação</li>
  <li>Recibo plano (sem dobras)</li>
  <li>Foco nítido</li>
  <li>Enquadramento completo (todo o recibo na foto)</li>
</ul>
<p>Envie a nova foto aqui:</p>
${ctaButton('Enviar nova foto', REUPLOAD_URL)}
${drawBlock.html}`

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: FROM,
      replyTo: REPLY_TO,
      to: params.email,
      subject: 'Não conseguimos ler seu recibo — Panini XP',
      text,
      html: buildEmailHtml(bodyHtml),
    })
  } catch (err) {
    await logError('send-receipt-emails', 'Failed to send please-reupload email', {
      participant_id: params.participantId,
      email: params.email,
      error: String(err),
    })
  }
}

// Email H — Re-upload request (admin-triggered, better photo needed)
export async function sendReceiptReuploadRequest(params: {
  participantId: string
  email: string
  nickname: string
  uploadDate: string
}): Promise<void> {
  const drawBlock = buildDrawBlock('urgent')
  const text = `Olá, ${params.nickname}!

Recebemos seu recibo, mas a imagem não está nítida o suficiente para identificarmos as informações necessárias.

Para receber seu(s) código(s), precisamos que a foto mostre o recibo inteiro com:

📌 CNPJ da loja
📌 Razão social
📌 Data da compra
📌 Valor total
📌 Número do cupom

⚠️ Não envie apenas o QR Code — ele não é suficiente. Precisamos do recibo inteiro.

Para uma boa leitura:
📸 Iluminação clara, sem sombras
📸 Recibo plano, sem dobras
📸 Todos os cantos visíveis
📸 Texto legível na foto

👉 ${REUPLOAD_URL}
${drawBlock.text}
Equipe Panini XP`

  const bodyHtml = `
<p>Olá, <strong>${params.nickname}</strong>!</p>
<p>Recebemos seu recibo, mas a imagem não está nítida o suficiente para identificarmos as informações necessárias.</p>
<p>Para receber seu(s) código(s), precisamos que a foto mostre o recibo inteiro com:</p>
<ul style="padding-left:20px;line-height:2.0;margin:12px 0;">
  <li>CNPJ da loja</li>
  <li>Razão social</li>
  <li>Data da compra</li>
  <li>Valor total</li>
  <li>Número do cupom</li>
</ul>
<p style="background:#fff3cd;border-left:4px solid #cc8800;padding:12px 16px;margin:16px 0;border-radius:0 4px 4px 0;">
  <strong>⚠️ Não envie apenas o QR Code</strong> — ele não é suficiente. Precisamos do recibo inteiro.
</p>
<p>Para uma boa leitura:</p>
<ul style="padding-left:20px;line-height:2.0;margin:12px 0;">
  <li>📸 Iluminação clara, sem sombras</li>
  <li>📸 Recibo plano, sem dobras</li>
  <li>📸 Todos os cantos visíveis</li>
  <li>📸 Texto legível na foto</li>
</ul>
${ctaButton('Enviar nova foto', REUPLOAD_URL)}
${drawBlock.html}`

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: FROM,
      replyTo: REPLY_TO,
      to: params.email,
      subject: 'Precisamos de uma foto melhor — Panini XP',
      text,
      html: buildEmailHtml(bodyHtml),
    })
  } catch (err) {
    await logError('send-receipt-emails', 'Failed to send reupload-request email', {
      participant_id: params.participantId,
      email: params.email,
      error: String(err),
    })
  }
}

// Email I — Manual review notification (receipt under human review)
export async function sendReceiptManualReviewNotification(params: {
  participantId: string
  email: string
  nickname: string
  uploadDate: string
}): Promise<void> {
  const drawBlock = buildDrawBlock('patient')
  const text = `Olá, ${params.nickname}!

Recebemos seu recibo. Como a imagem precisa de uma análise mais cuidadosa, nosso time vai revisar manualmente em até 48 horas úteis.

Vamos te avisar por email assim que terminarmos. Se aprovado, você receberá seu(s) código(s).

Obrigado pela paciência!
${drawBlock.text}
Equipe Panini XP`

  const bodyHtml = `
<p>Olá, <strong>${params.nickname}</strong>!</p>
<p>Recebemos seu recibo. Como a imagem precisa de uma análise mais cuidadosa, nosso time vai revisar manualmente em até <strong>48 horas úteis</strong>.</p>
<p>Vamos te avisar por email assim que terminarmos. Se aprovado, você receberá seu(s) código(s).</p>
<p>Obrigado pela paciência!</p>
${drawBlock.html}`

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: FROM,
      replyTo: REPLY_TO,
      to: params.email,
      subject: 'Estamos analisando seu recibo — Panini XP',
      text,
      html: buildEmailHtml(bodyHtml),
    })
  } catch (err) {
    await logError('send-receipt-emails', 'Failed to send manual-review-notification email', {
      participant_id: params.participantId,
      email: params.email,
      error: String(err),
    })
  }
}
