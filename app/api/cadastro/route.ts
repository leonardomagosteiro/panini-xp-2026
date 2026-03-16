import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const supabase = createAdminClient()

  if (body.mode === 'new') {
    const { nickname, full_name, cpf, whatsapp, email, store_origin, lgpd_consent } = body

    if (!nickname || !full_name || !cpf || !whatsapp || !lgpd_consent) {
      return NextResponse.json({ error: 'Preencha todos os campos obrigatorios' }, { status: 400 })
    }

    const { data: existing } = await supabase
      .from('participants')
      .select('id')
      .eq('cpf', cpf)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'Este CPF ja esta cadastrado.' },
        { status: 409 }
      )
    }

    const { data: participant, error: insertError } = await supabase
      .from('participants')
      .insert({
        nickname,
        full_name,
        cpf,
        whatsapp,
        email: email || null,
        amount_spent: null,
        code_count: 0,
        store_origin: store_origin || null,
        lgpd_consent: true,
      })
      .select('id')
      .single()

    if (insertError) {
      return NextResponse.json({ error: 'Erro ao realizar cadastro. Tente novamente.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, participant_id: participant.id })
  }

  return NextResponse.json({ error: 'Modo invalido' }, { status: 400 })
}
