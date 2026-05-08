import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { validateAdminSession } from '@/lib/admin-auth'
import { generateCodesForReceipt } from '@/lib/generate-codes'
import { sendReceiptApproved } from '@/lib/send-receipt-emails'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!validateAdminSession(req)) {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
  }

  const body = await req.json() as { codes_count?: number }
  const codesCount = body.codes_count

  if (!Number.isInteger(codesCount) || (codesCount as number) < 1) {
    return NextResponse.json({ error: 'codes_count invalido' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const receiptId = params.id

  const { data: receipt, error: receiptError } = await supabase
    .from('receipts')
    .select('id, participant_id, created_at, status, ai_raw_response')
    .eq('id', receiptId)
    .single()

  if (receiptError || !receipt) {
    return NextResponse.json({ error: 'Recibo nao encontrado' }, { status: 404 })
  }

  if (receipt.status !== 'needs_review') {
    return NextResponse.json({ error: 'Recibo nao esta em revisao' }, { status: 409 })
  }

  const { data: participant, error: participantError } = await supabase
    .from('participants')
    .select('id, email, nickname')
    .eq('id', receipt.participant_id)
    .single()

  if (participantError || !participant) {
    return NextResponse.json({ error: 'Participante nao encontrado' }, { status: 404 })
  }

  let codes: string[]
  try {
    codes = await generateCodesForReceipt(receiptId, receipt.participant_id, codesCount as number, supabase)
  } catch (err) {
    return NextResponse.json({ error: `Falha ao gerar codigos: ${String(err)}` }, { status: 500 })
  }

  await supabase
    .from('receipts')
    .update({
      status: 'approved',
      codes_generated: codesCount,
      reviewed_by: 'admin',
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', receiptId)

  if (participant.email) {
    const aiRaw = receipt.ai_raw_response as Record<string, unknown> | null
    const amountBrl = typeof aiRaw?.amount_total_brl === 'number' ? aiRaw.amount_total_brl : 0

    await sendReceiptApproved({
      participantId: receipt.participant_id as string,
      email: participant.email as string,
      nickname: participant.nickname as string,
      uploadDate: receipt.created_at as string,
      codes,
      amountBrl,
    })
  }

  return NextResponse.json({ ok: true, codes })
}
