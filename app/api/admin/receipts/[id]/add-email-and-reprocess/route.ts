import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { validateAdminSession } from '@/lib/admin-auth'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!validateAdminSession(req)) {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
  }

  const body = await req.json() as { email?: string }
  const trimmedEmail = body.email?.trim() ?? ''

  if (!trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
    return NextResponse.json({ error: 'E-mail invalido' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const receiptId = params.id

  const { data: receipt, error: receiptError } = await supabase
    .from('receipts')
    .select('id, participant_id, status')
    .eq('id', receiptId)
    .single()

  if (receiptError || !receipt) {
    return NextResponse.json({ error: 'Recibo nao encontrado' }, { status: 404 })
  }

  if (receipt.status !== 'needs_review') {
    return NextResponse.json({ error: 'Recibo nao esta em revisao' }, { status: 409 })
  }

  const { error: participantUpdateError } = await supabase
    .from('participants')
    .update({ email: trimmedEmail })
    .eq('id', receipt.participant_id)

  if (participantUpdateError) {
    return NextResponse.json({ error: 'Falha ao salvar e-mail' }, { status: 500 })
  }

  // Reset to uploaded so the next backlog run picks it up. Clear the system note too.
  await supabase
    .from('receipts')
    .update({
      status: 'uploaded',
      ai_raw_response: null,
    })
    .eq('id', receiptId)

  return NextResponse.json({ ok: true })
}
