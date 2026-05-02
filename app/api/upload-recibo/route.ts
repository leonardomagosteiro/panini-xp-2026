import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { logError } from '@/lib/log-error'
import { randomUUID } from 'crypto'
import { Resend } from 'resend'

const MAX_SIZE = 4.5 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

export async function POST(req: NextRequest) {
  let cpf = ''
  let fileSize = 0

  try {
    const formData = await req.formData()
    cpf = (formData.get('cpf') as string) ?? ''
    const file = formData.get('file') as File | null

    if (!cpf || !file) {
      return NextResponse.json({ error: 'CPF e foto sao obrigatorios.' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Formato invalido. Use JPEG, PNG ou WebP.' },
        { status: 400 }
      )
    }

    fileSize = file.size
    if (fileSize > MAX_SIZE) {
      return NextResponse.json(
        { error: 'Arquivo muito grande. Tamanho maximo: 4.5MB.' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    const { data: participant, error: cpfError } = await supabase
      .from('participants')
      .select('id, cpf, email, nickname')
      .eq('cpf', cpf)
      .maybeSingle()

    if (cpfError) {
      await logError('upload-recibo', 'CPF lookup failed', { cpf, error: String(cpfError) })
      return NextResponse.json({ error: 'Erro ao verificar CPF. Tente novamente.' }, { status: 500 })
    }

    if (!participant) {
      return NextResponse.json(
        { error: 'CPF nao encontrado. Cadastre-se primeiro.' },
        { status: 404 }
      )
    }

    const timestamp = Date.now()
    const uuid = randomUUID()
    const ext =
      file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    const storagePath = `${participant.id}/${timestamp}-${uuid}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(storagePath, arrayBuffer, { contentType: file.type, upsert: false })

    if (uploadError) {
      await logError('upload-recibo', 'Storage upload failed', {
        cpf,
        participant_id: participant.id,
        file_size: fileSize,
        error: String(uploadError),
      })
      return NextResponse.json({ error: 'Erro ao enviar foto. Tente novamente.' }, { status: 500 })
    }

    const { error: insertError } = await supabase.from('receipts').insert({
      participant_id: participant.id,
      cpf,
      storage_path: storagePath,
      status: 'uploaded',
    })

    if (insertError) {
      await logError('upload-recibo', 'Receipt insert failed', {
        cpf,
        participant_id: participant.id,
        storage_path: storagePath,
        error: String(insertError),
      })
      return NextResponse.json(
        { error: 'Erro ao registrar recibo. Tente novamente.' },
        { status: 500 }
      )
    }

    if (participant.email) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY)
        const greeting = participant.nickname ? `Olá, ${participant.nickname}!` : 'Olá!'
        await resend.emails.send({
          from: 'Panini XP <copa2026@paninixp.com.br>',
          replyTo: 'campinas@paninixp.com.br',
          to: participant.email,
          subject: 'Recibo recebido — Panini XP',
          text: `${greeting}\n\nRecebemos seu recibo da Panini Point Experience. Em breve você receberá seus códigos para concorrer aos prêmios da Copa do Mundo 2026.\n\nOs códigos serão enviados antes de qualquer sorteio, então fique tranquilo.\n\nObrigado por participar!\n\nEquipe Panini XP`,
        })
      } catch (emailErr) {
        await logError('upload-recibo-email', 'Failed to send confirmation email', {
          participant_id: participant.id,
          cpf,
          error: String(emailErr),
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    await logError('upload-recibo', 'Unexpected error', {
      cpf,
      file_size: fileSize,
      error: String(err),
    })
    return NextResponse.json({ error: 'Erro inesperado. Tente novamente.' }, { status: 500 })
  }
}
