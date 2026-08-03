import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Campaign ended 2026-08-03 — cron is a no-op. Original logic in git history; restore to revive.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({ ok: true, status: 'campaign_ended', expired_count: 0 })
}
