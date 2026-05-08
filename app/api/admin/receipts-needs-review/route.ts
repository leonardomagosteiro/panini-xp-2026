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

  const { data, error } = await supabase
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

  if (error) {
    return NextResponse.json({ error: 'Erro ao buscar recibos' }, { status: 500 })
  }

  const rows = data as unknown as ReceiptRow[]

  // Generate signed URLs (1 hour)
  const withUrls = await Promise.all(
    rows.map(async (row) => {
      const { data: urlData } = await supabase.storage
        .from('receipts')
        .createSignedUrl(row.storage_path, 3600)

      return {
        ...row,
        signed_image_url: urlData?.signedUrl ?? null,
      }
    })
  )

  return NextResponse.json(withUrls)
}
