import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let suffix = ''
  for (let i = 0; i < 5; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)]
  }
  return `PXP-2026-${suffix}`
}

async function generateUniqueCodes(
  supabase: ReturnType<typeof import('@/lib/supabase-admin').createAdminClient>,
  count: number
): Promise<string[]> {
  const codes: string[] = []
  const maxAttempts = count * 20

  for (let attempts = 0; attempts < maxAttempts && codes.length < count; attempts++) {
    const code = generateCode()
    if (codes.includes(code)) continue

    const { data } = await supabase
      .from('codes')
      .select('code')
      .eq('code', code)
      .maybeSingle()

    if (!data) codes.push(code)
  }

  return codes
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const supabase = createAdminClient()

  if (body.mode === 'new') {
    const { nickname, full_name, cpf, whatsapp, email, amount_spent, store_origin, lgpd_consent } = body

    if (!nickname || !full_name || !cpf || !whatsapp || !amount_spent || !lgpd_consent) {
      return NextResponse.json({ error: 'Preencha todos os campos obrigatorios' }, { status: 400 })
    }

    const { data: existing } = await supabase
      .from('participants')
      .select('id')
      .eq('cpf', cpf)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'Este CPF ja esta cadastrado. Use a opcao de cliente retornante.' },
        { status: 409 }
      )
    }

    const codeCount = Math.floor(Number(amount_spent) / 50)

    const { data: participant, error: insertError } = await supabase
      .from('participants')
      .insert({
        nickname,
        full_name,
        cpf,
        whatsapp,
        email: email || null,
        amount_spent: Number(amount_spent),
        code_count: codeCount,
        store_origin: store_origin || null,
        lgpd_consent: true,
      })
      .select('id')
      .single()

    if (insertError) {
      return NextResponse.json({ error: 'Erro ao realizar cadastro. Tente novamente.' }, { status: 500 })
    }

    const codes = await generateUniqueCodes(supabase, codeCount)

    if (codes.length < codeCount) {
      return NextResponse.json({ error: 'Erro ao gerar codigos. Tente novamente.' }, { status: 500 })
    }

    const { error: codesError } = await supabase
      .from('codes')
      .insert(codes.map(code => ({ participant_id: participant.id, code })))

    if (codesError) {
      return NextResponse.json({ error: 'Erro ao salvar codigos. Tente novamente.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, participant_id: participant.id })
  }

  if (body.mode === 'returning') {
    const { participant_id, amount_spent, lgpd_consent } = body

    if (!participant_id || !amount_spent || !lgpd_consent) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
    }

    const { data: participant, error: fetchError } = await supabase
      .from('participants')
      .select('id, code_count')
      .eq('id', participant_id)
      .single()

    if (fetchError || !participant) {
      return NextResponse.json({ error: 'Participante nao encontrado' }, { status: 404 })
    }

    const newCodeCount = Math.floor(Number(amount_spent) / 50)
    const codes = await generateUniqueCodes(supabase, newCodeCount)

    if (codes.length < newCodeCount) {
      return NextResponse.json({ error: 'Erro ao gerar codigos. Tente novamente.' }, { status: 500 })
    }

    const { error: codesError } = await supabase
      .from('codes')
      .insert(codes.map(code => ({ participant_id, code })))

    if (codesError) {
      return NextResponse.json({ error: 'Erro ao salvar codigos. Tente novamente.' }, { status: 500 })
    }

    const { error: updateError } = await supabase
      .from('participants')
      .update({ code_count: participant.code_count + newCodeCount })
      .eq('id', participant_id)

    if (updateError) {
      return NextResponse.json({ error: 'Erro ao atualizar pontuacao. Tente novamente.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, participant_id })
  }

  return NextResponse.json({ error: 'Modo invalido' }, { status: 400 })
}
