export {}

/**
 * READ-ONLY draw snapshot export.
 *
 * Fetches all rows from the `codes` table and exports them in four formats:
 *   draw-exports/codes.txt   — one code per line
 *   draw-exports/codes.csv   — single-column CSV with header "code"
 *   draw-exports/codes.xlsx  — SheetJS workbook, sheet "Codes", header "code"
 *   draw-exports/codes.pdf   — header block + all codes, multi-column layout
 *
 * Does NOT mutate any database row.
 * Does NOT touch any table other than `codes`.
 *
 * PRE-REQUISITE: xlsx is not yet in package.json. Install before running:
 *   npm install xlsx
 *
 * Usage:
 *   npx tsx scripts/generate-draw-snapshot.ts
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'
import { createClient } from '@supabase/supabase-js'
import { EXCLUDED_DRAW_CODES } from '../lib/draw-exclusions'

// pdfkit ships as CommonJS; require avoids ESM default-export friction.
// @types/pdfkit is not installed — using `any` to keep typecheck clean.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as any

// xlsx is NOT yet in package.json. Run `npm install xlsx` before executing.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx') as any

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const EXPORT_DIR = path.resolve(__dirname, '../draw-exports')
const PAGE_SIZE = 1000

// ── Step 1: column introspection ──────────────────────────────────────────────

async function logColumnNames(): Promise<void> {
  const { data, error } = await supabase
    .from('codes')
    .select('*')
    .limit(1)
    .single()

  if (error) {
    console.error('ERROR fetching sample row from codes:', error.message)
    process.exit(1)
  }

  const cols = Object.keys(data as Record<string, unknown>)
  console.log('CODES TABLE COLUMNS:', cols.join(', '))
}

// ── Step 2: paginated full fetch ──────────────────────────────────────────────

interface CodeRow {
  code: string
  created_at: string
  [key: string]: unknown
}

async function fetchAllCodes(): Promise<CodeRow[]> {
  const all: CodeRow[] = []
  let from = 0

  for (;;) {
    const to = from + PAGE_SIZE - 1
    const { data, error } = await supabase
      .from('codes')
      .select('*')
      .order('created_at', { ascending: true })
      .range(from, to)

    if (error) {
      console.error(`ERROR fetching codes (range ${from}-${to}):`, error.message)
      process.exit(1)
    }

    const page = (data ?? []) as CodeRow[]
    all.push(...page)

    if (page.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return all
}

// ── Step 3: file writers ──────────────────────────────────────────────────────

function writeTxt(codes: string[]): void {
  const out = path.join(EXPORT_DIR, 'codes.txt')
  fs.writeFileSync(out, codes.join('\n') + '\n', 'utf8')
  console.log(`  codes.txt   — ${codes.length} codes written`)
}

function writeCsv(codes: string[]): void {
  const out = path.join(EXPORT_DIR, 'codes.csv')
  const content = ['code', ...codes].join('\n') + '\n'
  fs.writeFileSync(out, content, 'utf8')
  console.log(`  codes.csv   — ${codes.length} codes written (+ 1 header row)`)
}

function writeXlsx(codes: string[]): void {
  const out = path.join(EXPORT_DIR, 'codes.xlsx')
  const rows: string[][] = [['code'], ...codes.map(c => [c])]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Codes')
  XLSX.writeFile(wb, out)
  console.log(`  codes.xlsx  — ${codes.length} codes written (+ 1 header row)`)
}

async function writePdf(codes: string[], snapshotTimestamp: string): Promise<void> {
  const out = path.join(EXPORT_DIR, 'codes.pdf')

  return new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' })
    const stream = fs.createWriteStream(out)
    doc.pipe(stream)

    // Layout constants (A4: 595.28 x 841.89 pt)
    const MARGIN = 50
    const PAGE_H = 841.89
    const USABLE_W = 495    // 595.28 - 2 x 50
    const COLS = 5
    const COL_W = Math.floor(USABLE_W / COLS)  // 99pt — fits PXP-2026-XXXXX at font size 9
    const FONT_SZ = 9
    const LINE_H = 14       // line height including inter-line gap

    // Header block
    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('Panini XP 2026 — Draw Snapshot', MARGIN, MARGIN, {
        align: 'center',
        width: USABLE_W,
        lineBreak: true,
      })
      .moveDown(0.5)
      .fontSize(10)
      .font('Helvetica')
      .text(`Snapshot: ${snapshotTimestamp}`, MARGIN, undefined, {
        align: 'center',
        width: USABLE_W,
        lineBreak: true,
      })
      .moveDown(0.25)
      .text(`Total codes: ${codes.length}`, MARGIN, undefined, {
        align: 'center',
        width: USABLE_W,
        lineBreak: true,
      })
      .moveDown(1)

    // Starting Y for the code grid (immediately after header)
    let y = doc.y as number
    doc.fontSize(FONT_SZ).font('Courier')

    for (let i = 0; i < codes.length; i++) {
      const col = i % COLS
      const x = MARGIN + col * COL_W

      // Explicit x, y positioning overrides the internal pdfkit cursor.
      // lineBreak: false prevents pdfkit from advancing the cursor after each cell.
      doc.text(codes[i], x, y, { lineBreak: false, width: COL_W })

      // After the last column in a row (or the very last code), advance Y.
      if (col === COLS - 1 || i === codes.length - 1) {
        y += LINE_H
        // Add a new page if the next row would overflow the bottom margin.
        if (y + LINE_H > PAGE_H - MARGIN) {
          doc.addPage()
          y = MARGIN
        }
      }
    }

    doc.end()

    stream.on('finish', () => {
      console.log(`  codes.pdf   — ${codes.length} codes written`)
      resolve()
    })
    stream.on('error', (err: Error) => reject(err))
  })
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('=== Panini XP 2026 — Generate Draw Snapshot ===')
  console.log('READ-ONLY: no database mutations.')
  console.log('')

  // 1. Column introspection — see real column names before doing anything else
  await logColumnNames()
  console.log('')

  // 2. Fetch all codes (paginated to handle PostgREST 1000-row cap)
  process.stdout.write('Fetching all codes (paginated)...')
  const rows = await fetchAllCodes()
  console.log(' done.')
  console.log(`TOTAL CODES FETCHED: ${rows.length}`)
  console.log('')

  // 3. Extract code strings from rows, then filter out excluded (past-winner) codes
  const allCodes = rows.map(r => r.code)
  const codes = allCodes.filter(c => !EXCLUDED_DRAW_CODES.has(c))
  const excludedCount = allCodes.length - codes.length
  if (excludedCount > 0) {
    console.log(`Excluded ${excludedCount} code(s) present in EXCLUDED_DRAW_CODES.`)
    console.log('')
  }

  // 4. Ensure output directory exists
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true })
    console.log('Created directory: draw-exports/')
  } else {
    console.log('Output directory: draw-exports/ (already exists)')
  }
  console.log('')

  // 5. Write all four export files
  const snapshotTimestamp = new Date().toISOString()
  console.log(`Snapshot timestamp: ${snapshotTimestamp}`)
  console.log('')
  console.log('WRITE SUMMARY:')
  writeTxt(codes)
  writeCsv(codes)
  writeXlsx(codes)
  await writePdf(codes, snapshotTimestamp)

  console.log('')
  console.log('All four files written to draw-exports/')
}

main().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
