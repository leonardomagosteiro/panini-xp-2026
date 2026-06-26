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

  if (bucket === 'outros') {
    // 'Outros': fetch all, then filter in-memory to receipts that don't match any specific bucket.
    // We do this in-memory because expressing the negation across multiple OR conditions in
    // PostgREST is hairy. The list is small enough (~150 receipts) that in-memory filtering is fine.
    // The filter happens AFTER the await below — see "outros filter" comment.
  } else if (bucket === 'ready') {
    // 'Pronto para aprovar': all core fields set, amount in valid range,
    // CNPJ is NOT EBANCAS (default DMCAMP-all-data-present case).
    query = query
      .not('cnpj_on_receipt', 'is', null)
      .not('receipt_date', 'is', null)
      .not('amount_on_receipt', 'is', null)
      .gte('amount_on_receipt', 50)
      .lte('amount_on_receipt', 200)
      .not('cnpj_on_receipt', 'in', `(${EBANCAS_CNPJS.map(c => `"${c}"`).join(',')})`)
  } else if (bucket === 'amount') {
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

  const { data: rawData, error } = await query

  // Apply outros filter in-memory
  type DataRow = { cnpj_on_receipt: string | null; amount_on_receipt: number | null; receipt_date: string | null }
  let data: typeof rawData = rawData
  if (bucket === 'outros' && rawData) {
    const isEbancas = (cnpj: string | null) => cnpj !== null && EBANCAS_CNPJS.includes(cnpj)
    const isReady = (r: DataRow) =>
      r.cnpj_on_receipt !== null && r.receipt_date !== null &&
      r.amount_on_receipt !== null && r.amount_on_receipt >= 50 && r.amount_on_receipt <= 200 &&
      !isEbancas(r.cnpj_on_receipt)
    const isAmount = (r: DataRow) =>
      r.cnpj_on_receipt !== null && r.receipt_date !== null &&
      (r.amount_on_receipt === null || r.amount_on_receipt > 200)
    const isCnpj = (r: DataRow) =>
      r.cnpj_on_receipt === null && r.receipt_date !== null &&
      r.amount_on_receipt !== null && r.amount_on_receipt >= 50 && r.amount_on_receipt <= 200
    const isEmpty = (r: DataRow) =>
      r.cnpj_on_receipt === null && r.amount_on_receipt === null
    data = rawData.filter((r: any) =>
      !isReady(r) && !isAmount(r) && !isCnpj(r) && !isEbancas(r.cnpj_on_receipt) && !isEmpty(r)
    )
  }

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
