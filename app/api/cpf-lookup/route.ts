import { NextResponse } from 'next/server'

// Campaign ended 2026-08-03 — endpoint permanently closed.
// Original handler logic preserved in git history (see commit a665aa7 era files); restore from history to revive.
export async function POST() {
  return NextResponse.json({ error: 'A campanha Panini XP 2026 foi encerrada.' }, { status: 410 })
}
