import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { validateAdminSession } from '@/lib/admin-auth'
import {
  sendReceiptRejectedNotReceipt,
  sendReceiptRejectedInvalidCnpj,
  sendReceiptRejectedAmountTooLow,
  sendReceiptRejectedDateOutOfWindow,
  sendReceiptRejectedDuplicate,
  sendReceiptPleaseReupload,
} from '@/lib/send-receipt-emails'

const VALID_REASONS = [
  'not_a_receipt',
  'invalid_cnpj',
  'amount_too_low',
  'date_out_of_window',
  'duplicate',
  'unreadable',
] as const

type AdminRejectionReason = typeof VALID_REASONS[number]

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!validateAdminSession(req)) {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
  }

  const body = await req.json() as { reason?: AdminRejectionReason }
  const reason = body.reason

  if (!reason || !(VALID_REASONS as readonly string[]).includes(reason)) {
    return NextResponse.json({ error: 'Motivo invalido' }, { status: 400 })
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

  const { data: participant } = await supabase
    .from('participants')
    .select('id, email, nickname')
    .eq('id', receipt.participant_id)
    .single()

  await supabase
    .from('receipts')
    .update({
      status: 'rejected',
      rejection_reason: reason,
      reviewed_by: 'admin',
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', receiptId)

  if (participant?.email) {
    const baseParams = {
      participantId: receipt.participant_id as string,
      email: participant.email as string,
      nickname: participant.nickname as string,
      uploadDate: receipt.created_at as string,
    }
    const aiRaw = receipt.ai_raw_response as Record<string, unknown> | null
    const amountBrl = typeof aiRaw?.amount_total_brl === 'number' ? aiRaw.amount_total_brl : 0

    switch (reason) {
      case 'not_a_receipt':
        await sendReceiptRejectedNotReceipt(baseParams)
        break
      case 'invalid_cnpj':
        await sendReceiptRejectedInvalidCnpj(baseParams)
        break
      case 'amount_too_low':
        await sendReceiptRejectedAmountTooLow({ ...baseParams, amountBrl })
        break
      case 'date_out_of_window':
        await sendReceiptRejectedDateOutOfWindow(baseParams)
        break
      case 'duplicate':
        await sendReceiptRejectedDuplicate(baseParams)
        break
      case 'unreadable':
        await sendReceiptPleaseReupload(baseParams)
        break
    }
  }

  return NextResponse.json({ ok: true })
}
