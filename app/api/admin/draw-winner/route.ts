import { NextRequest, NextResponse } from 'next/server'
import { validateAdminSession } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  if (!validateAdminSession(req)) {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
  }

  const url = new URL(req.url)
  const raw = url.searchParams.get('code') ?? ''
  if (!raw.trim()) {
    return NextResponse.json({ error: 'Codigo nao informado' }, { status: 400 })
  }

  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  // Must be PXP2026 + exactly 5 alphanumeric chars (total length 12)
  if (!/^PXP2026[A-Z0-9]{5}$/.test(cleaned)) {
    return NextResponse.json({ found: false })
  }
  const code = 'PXP-2026-' + cleaned.slice(7)

  const supabase = createAdminClient()

  try {
    // 1. Look up the code
    const { data: codeRow, error: codeError } = await supabase
      .from('codes')
      .select('id, participant_id, receipt_id, code, created_at')
      .eq('code', code)
      .maybeSingle()

    if (codeError) throw codeError

    if (!codeRow) {
      return NextResponse.json({ found: false })
    }

    // 2. Fetch participant and receipt in parallel
    const [participantResult, receiptResult] = await Promise.all([
      supabase
        .from('participants')
        .select('nickname, full_name, cpf')
        .eq('id', codeRow.participant_id)
        .single(),
      supabase
        .from('receipts')
        .select('status, amount_on_receipt, cnpj_on_receipt, receipt_date, storage_path')
        .eq('id', codeRow.receipt_id)
        .single(),
    ])

    if (participantResult.error) throw participantResult.error
    if (receiptResult.error) throw receiptResult.error

    const participant = participantResult.data as {
      nickname: string
      full_name: string
      cpf: string
    }

    const receipt = receiptResult.data as {
      status: string
      amount_on_receipt: number | null
      cnpj_on_receipt: string | null
      receipt_date: string | null
      storage_path: string
    }

    // 3. Generate signed URL — failure is non-fatal
    let imageUrl: string | null = null
    if (receipt.storage_path) {
      try {
        const { data: urlData } = await supabase.storage
          .from('receipts')
          .createSignedUrl(receipt.storage_path, 28800)
        imageUrl = urlData?.signedUrl ?? null
      } catch {
        imageUrl = null
      }
    }

    // 4. Compute validity
    const valid = receipt.status === 'approved'

    return NextResponse.json({
      found: true,
      code: codeRow.code,
      valid,
      participant: {
        nickname: participant.nickname,
        full_name: participant.full_name,
        cpf: participant.cpf,
      },
      receipt: {
        status: receipt.status,
        amount_on_receipt: receipt.amount_on_receipt,
        cnpj_on_receipt: receipt.cnpj_on_receipt,
        receipt_date: receipt.receipt_date,
      },
      imageUrl,
    })
  } catch {
    return NextResponse.json({ error: 'Erro ao buscar vencedor' }, { status: 500 })
  }
}
