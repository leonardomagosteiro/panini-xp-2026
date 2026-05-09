import { Resend } from 'resend'
import { logError } from './log-error'

const FROM = 'Panini XP <copa2026@paninixp.com.br>'
const REPLY_TO = 'campinas@paninixp.com.br'
const REUPLOAD_URL = 'https://app.paninixp.com.br/enviar-recibo'

function formatBrDate(isoOrTimestamp: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(
    new Date(isoOrTimestamp)
  )
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
  const text = `Olá, ${params.nickname}!

Seu recibo enviado em ${date} foi aprovado! Você ganhou ${n} código(s) para o sorteio da Copa do Mundo 2026:

${codeList}

Guarde este email com cuidado. Os códigos serão usados no sorteio dos prêmios.

Quer mais chances? Envie outro recibo:
👉 ${REUPLOAD_URL}

Boa sorte!

Equipe Panini XP`

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: FROM,
      replyTo: REPLY_TO,
      to: params.email,
      subject: 'Seus códigos chegaram — Panini XP',
      text,
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

Recebemos seu envio, mas não conseguimos identificar uma nota fiscal válida na imagem.

Por favor, envie uma foto clara do seu cupom fiscal ou nota fiscal de compra:
👉 ${REUPLOAD_URL}

Equipe Panini XP`

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: FROM,
      replyTo: REPLY_TO,
      to: params.email,
      subject: 'Não conseguimos processar seu envio — Panini XP',
      text,
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

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: FROM,
      replyTo: REPLY_TO,
      to: params.email,
      subject: 'Recibo não elegível — Panini XP',
      text,
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

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: FROM,
      replyTo: REPLY_TO,
      to: params.email,
      subject: 'Recibo recebido, mas abaixo do valor mínimo — Panini XP',
      text,
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

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: FROM,
      replyTo: REPLY_TO,
      to: params.email,
      subject: 'Recibo fora do período da campanha — Panini XP',
      text,
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

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: FROM,
      replyTo: REPLY_TO,
      to: params.email,
      subject: 'Recibo já registrado — Panini XP',
      text,
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
  const text = `${prefix}Olá, ${params.nickname}!

Recebemos seu recibo, mas a imagem não está clara o suficiente para identificarmos as informações.

Por favor, tire uma nova foto do recibo com:
- Boa iluminação
- Recibo plano (sem dobras)
- Foco nítido
- Enquadramento completo (todo o recibo na foto)

Envie a nova foto aqui:
👉 ${REUPLOAD_URL}

Equipe Panini XP`

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: FROM,
      replyTo: REPLY_TO,
      to: params.email,
      subject: 'Não conseguimos ler seu recibo — Panini XP',
      text,
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
  const text = `Olá, ${params.nickname}!

Recebemos seu recibo, mas a imagem não está nítida o suficiente para identificarmos as informações.

Para que você possa receber seu(s) código(s), por favor envie uma nova foto do mesmo recibo. Para uma boa leitura:

📸 Iluminação clara, sem sombras
📸 Recibo plano, sem dobras
📸 Todos os cantos visíveis
📸 Texto legível na foto

👉 ${REUPLOAD_URL}

Equipe Panini XP`

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: FROM,
      replyTo: REPLY_TO,
      to: params.email,
      subject: 'Precisamos de uma foto melhor — Panini XP',
      text,
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
  const text = `Olá, ${params.nickname}!

Recebemos seu recibo. Como a imagem precisa de uma análise mais cuidadosa, nosso time vai revisar manualmente em até 48 horas úteis.

Vamos te avisar por email assim que terminarmos. Se aprovado, você receberá seu(s) código(s).

Obrigado pela paciência!

Equipe Panini XP`

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: FROM,
      replyTo: REPLY_TO,
      to: params.email,
      subject: 'Estamos analisando seu recibo — Panini XP',
      text,
    })
  } catch (err) {
    await logError('send-receipt-emails', 'Failed to send manual-review-notification email', {
      participant_id: params.participantId,
      email: params.email,
      error: String(err),
    })
  }
}
