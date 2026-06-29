import { NextRequest, NextResponse } from 'next/server'
import { validateAdminSession } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  if (!validateAdminSession(req)) {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('campaign_state')
    .update({ draw_phase: 'completed', updated_at: now })
    .eq('id', 1)
    .select('updated_at')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Erro ao iniciar sorteio' }, { status: 500 })
  }

  const started_at = (data as { updated_at: string } | null)?.updated_at ?? now

  return NextResponse.json({ draw_phase: 'completed', started_at })
}
