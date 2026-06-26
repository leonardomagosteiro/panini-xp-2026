import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { validateAdminSession } from '@/lib/admin-auth'

type ParticipantJoin = {
  nickname: string
  email: string | null
  whatsapp: string
  full_name: string
}

type ReceiptRow = {
  id: string
  storage_path: string
  created_at: string
  ai_raw_response: Record<string, unknown> | null
  ai_confidence: string | null
  cnpj_on_receipt: string | null
  receipt_date: string | null
  amount_on_receipt: number | null
  participants: ParticipantJoin
}

export async function GET(req: NextRequest) {
  if (!validateAdminSession(req)) {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Bucket-based filtering for review workflow.
  // 'all' (default): every needs_review receipt
  // 'amount': CNPJ + date set, amount is null or > 200 (only need to verify amount)
  // 'cnpj': amount in range + date set, CNPJ is null (only need to verify CNPJ)
  // 'ebancas': CNPJ matches an EBANCAS CNPJ (need visual confirmation it's EBANCAS)
  // 'empty': amount and CNPJ both null (the hardest cases)
  const url = new URL(req.url)
  const bucket = url.searchParams.get('bucket') ?? 'all'

  const EBANCAS_CNPJS = [
    '54.511.074/0001-11', '54511074000111',
    '54.511.074/0002-00', '54511074000200',
  ]

  let query = supabase
    .from('receipts')
    .select(`
      id,
      storage_path,
      created_at,
      ai_raw_response,
      ai_confidence,
      cnpj_on_receipt,
      receipt_date,
      amount_on_receipt,
      participants (
        nickname,
        email,
        whatsapp,
        full_name
      )
    `)
    .eq('status', 'needs_review')
    .order('created_at', { ascending: true })

  if (bucket === 'amount') {
    query = query
      .not('cnpj_on_receipt', 'is', null)
      .not('receipt_date', 'is', null)
      .or('amount_on_receipt.is.null,amount_on_receipt.gt.200')
  } else if (bucket === 'cnpj') {
    query = query
      .is('cnpj_on_receipt', null)
      .not('amount_on_receipt', 'is', null)
      .gte('amount_on_receipt', 50)
      .lte('amount_on_receipt', 200)
      .not('receipt_date', 'is', null)
  } else if (bucket === 'ebancas') {
    query = query.in('cnpj_on_receipt', EBANCAS_CNPJS)
  } else if (bucket === 'empty') {
    query = query
      .is('cnpj_on_receipt', null)
      .is('amount_on_receipt', null)
  }
  // 'all' or unrecognized bucket: no extra filter

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Erro ao buscar recibos' }, { status: 500 })
  }

  const rows = data as unknown as ReceiptRow[]

  // Generate signed URLs (8 hours — long enough for a manual review session)
  const withUrls = await Promise.all(
    rows.map(async (row) => {
      const { data: urlData } = await supabase.storage
        .from('receipts')
        .createSignedUrl(row.storage_path, 28800)

      return {
        ...row,
        signed_image_url: urlData?.signedUrl ?? null,
      }
    })
  )

  return NextResponse.json(withUrls)
}
