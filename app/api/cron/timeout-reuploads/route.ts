import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Authentication: Vercel cron passes Authorization: Bearer <CRON_SECRET>
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Find awaiting_reupload receipts older than 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: expired, error: selectError } = await supabase
    .from('receipts')
    .select('id, participant_id, reupload_request_sent_at')
    .eq('status', 'awaiting_reupload')
    .lt('reupload_request_sent_at', sevenDaysAgo)

  if (selectError) {
    console.error('[cron timeout-reuploads] select failed:', selectError)
    return NextResponse.json({ error: 'select_failed', message: selectError.message }, { status: 500 })
  }

  if (!expired || expired.length === 0) {
    return NextResponse.json({ ok: true, expired_count: 0 })
  }

  // Update all expired receipts to needs_review (silently — no email)
  const expiredIds = expired.map(r => r.id)
  const { error: updateError } = await supabase
    .from('receipts')
    .update({ status: 'needs_review', rejection_reason: null })
    .in('id', expiredIds)

  if (updateError) {
    console.error('[cron timeout-reuploads] update failed:', updateError)
    return NextResponse.json({ error: 'update_failed', message: updateError.message }, { status: 500 })
  }

  console.log(`[cron timeout-reuploads] moved ${expired.length} receipts from awaiting_reupload to needs_review`)
  return NextResponse.json({ ok: true, expired_count: expired.length, ids: expiredIds })
}
