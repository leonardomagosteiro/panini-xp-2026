import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { cpf } = body

  if (!cpf) {
    return NextResponse.json({ error: 'CPF obrigatorio' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('participants')
    .select('id, nickname')
    .eq('cpf', cpf)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: 'Erro ao buscar CPF. Tente novamente.' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ found: false })
  }

  return NextResponse.json({ found: true, participant: { id: data.id, nickname: data.nickname } })
}
