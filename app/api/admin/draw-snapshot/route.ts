import { NextRequest, NextResponse } from 'next/server'
import { validateAdminSession } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'
import { EXCLUDED_DRAW_CODES } from '@/lib/draw-exclusions'

const PAGE_SIZE = 1000

interface CodeRow {
  code: string
  created_at: string
}

// Fetches all rows from `codes` ordered by created_at ascending.
// Paginates in batches of 1000 to work around PostgREST's default row cap.
// Throws on any Supabase error so the caller can return a clean 500.
async function fetchAllCodes(): Promise<CodeRow[]> {
  const supabase = createAdminClient()
  const all: CodeRow[] = []
  let from = 0

  for (;;) {
    const to = from + PAGE_SIZE - 1
    const { data, error } = await supabase
      .from('codes')
      .select('code, created_at')
      .order('created_at', { ascending: true })
      .range(from, to)

    if (error) {
      throw new Error(error.message)
    }

    const page = (data ?? []) as CodeRow[]
    all.push(...page)

    if (page.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return all
}

export async function GET(req: NextRequest) {
  if (!validateAdminSession(req)) {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
  }

  const url = new URL(req.url)
  const format = url.searchParams.get('format')

  if (
    format !== 'count' &&
    format !== 'txt' &&
    format !== 'csv' &&
    format !== 'xlsx'
  ) {
    return NextResponse.json({ error: 'Formato invalido' }, { status: 400 })
  }

  // ── count ─────────────────────────────────────────────────────────────────
  // COUNT-only query — does not fetch rows; returns total immediately.

  if (format === 'count') {
    const supabase = createAdminClient()
    const { count, error } = await supabase
      .from('codes')
      .select('*', { count: 'exact', head: true })
    if (error) {
      return NextResponse.json(
        { error: `Erro ao contar codigos: ${error.message}` },
        { status: 500 }
      )
    }

    let draw_phase: string = 'announced'
    const { data: stateData } = await supabase
      .from('campaign_state')
      .select('draw_phase')
      .eq('id', 1)
      .single()
    const phase = (stateData as { draw_phase: string } | null)?.draw_phase
    if (phase === 'announced' || phase === 'completed') draw_phase = phase

    return NextResponse.json({ total: count ?? 0, draw_phase })
  }

  let rows: CodeRow[]
  try {
    rows = await fetchAllCodes()
  } catch (err) {
    return NextResponse.json(
      { error: `Erro ao buscar codigos: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }

  const codes = rows.map(r => r.code).filter(c => !EXCLUDED_DRAW_CODES.has(c))

  // ── txt ───────────────────────────────────────────────────────────────────

  if (format === 'txt') {
    const body = codes.join('\n') + '\n'
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': 'attachment; filename="codes.txt"',
      },
    })
  }

  // ── csv ───────────────────────────────────────────────────────────────────

  if (format === 'csv') {
    const body = ['code', ...codes].join('\n') + '\n'
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="codes.csv"',
      },
    })
  }

  // ── xlsx ──────────────────────────────────────────────────────────────────

  if (format === 'xlsx') {
    // xlsx is not in package.json yet — install with: npm install xlsx
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require('xlsx') as any
    const aoa: string[][] = [['code'], ...codes.map(c => [c])]
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Codes')
    const buffer: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="codes.xlsx"',
      },
    })
  }

}
