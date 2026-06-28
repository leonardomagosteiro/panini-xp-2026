export {}

/**
 * Smoke-test script: sends all 9 customer-facing email functions to a test inbox.
 * Use this to visually verify draw-block injection (Part B) and the persistent
 * Instagram CTA in the footer.
 *
 * Usage (after "set -a; source .env.local; set +a"):
 *   npx tsx scripts/smoke-test-emails.ts --to=test@example.com
 *
 * Expected inbox:
 *   Functions 1-4 should contain the draw block (celebratory / urgent / patient).
 *   Functions 5-9 (rejections) should NOT contain the draw block.
 *   All 9 should show the Instagram CTA in the footer.
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import {
  sendReceiptApproved,
  sendReceiptPleaseReupload,
  sendReceiptReuploadRequest,
  sendReceiptManualReviewNotification,
  sendReceiptRejectedNotReceipt,
  sendReceiptRejectedInvalidCnpj,
  sendReceiptRejectedAmountTooLow,
  sendReceiptRejectedDateOutOfWindow,
  sendReceiptRejectedDuplicate,
} from '../lib/send-receipt-emails'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

// ── CLI arg parsing ────────────────────────────────────────────────────────────

const USAGE = `
Usage: npx tsx scripts/smoke-test-emails.ts --to=test@example.com

  --to    Destination email address for all 9 test sends (required)
`.trim()

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => {
      const eq = a.indexOf('=')
      return eq === -1 ? [a.slice(2), ''] : [a.slice(2, eq), a.slice(eq + 1)]
    })
)

const to = args['to'] ?? ''

if (!to) {
  console.error('ERROR: --to is required.\n')
  console.error(USAGE)
  process.exit(1)
}

if (!to.includes('@')) {
  console.error(`ERROR: --to "${to}" does not look like a valid email address.\n`)
  console.error(USAGE)
  process.exit(1)
}

// ── Shared test params ─────────────────────────────────────────────────────────

const TODAY = new Date().toISOString()

const BASE = {
  participantId: 'smoke-test-participant-id',
  email: to,
  nickname: 'SmokeTest',
  uploadDate: TODAY,
}

const CODES = ['PXP-2026-TEST1', 'PXP-2026-TEST2', 'PXP-2026-TEST3']

// ── Helpers ────────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

type SendResult = { fn: string; subject: string; status: 'ok' | 'error'; error?: string }

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Smoke-testing all 9 email functions → ${to}`)
  console.log(`DRAW_ANNOUNCEMENT_ACTIVE: ${process.env.DRAW_ANNOUNCEMENT_ACTIVE ?? '(not set)'}`)
  console.log(`DRAW_DATE_DISPLAY:        ${process.env.DRAW_DATE_DISPLAY ?? '(not set)'}`)
  console.log(`DRAW_INSTAGRAM_HANDLE:    ${process.env.DRAW_INSTAGRAM_HANDLE ?? '(not set)'}`)
  console.log('')

  const results: SendResult[] = []

  async function send(label: string, subject: string, fn: () => Promise<void>) {
    console.log(`[${results.length + 1}/9] ${label}`)
    console.log(`      Subject: "${subject}"`)
    try {
      await fn()
      console.log(`      -> sent`)
      results.push({ fn: label, subject, status: 'ok' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`      -> ERROR: ${msg}`)
      results.push({ fn: label, subject, status: 'error', error: msg })
    }
    await sleep(500)
    console.log('')
  }

  // 1. sendReceiptApproved — CELEBRATORY draw block expected
  await send(
    'sendReceiptApproved',
    'Seus códigos chegaram — Panini XP',
    () => sendReceiptApproved({ ...BASE, codes: CODES, amountBrl: 150 })
  )

  // 2. sendReceiptPleaseReupload — URGENT draw block expected
  await send(
    'sendReceiptPleaseReupload',
    'Não conseguimos ler seu recibo — Panini XP',
    () => sendReceiptPleaseReupload({ ...BASE })
  )

  // 3. sendReceiptReuploadRequest — URGENT draw block expected
  await send(
    'sendReceiptReuploadRequest',
    'Precisamos de uma foto melhor — Panini XP',
    () => sendReceiptReuploadRequest({ ...BASE })
  )

  // 4. sendReceiptManualReviewNotification — PATIENT draw block expected
  await send(
    'sendReceiptManualReviewNotification',
    'Estamos analisando seu recibo — Panini XP',
    () => sendReceiptManualReviewNotification({ ...BASE })
  )

  // 5. sendReceiptRejectedNotReceipt — NO draw block
  await send(
    'sendReceiptRejectedNotReceipt',
    'Não conseguimos processar seu envio — Panini XP',
    () => sendReceiptRejectedNotReceipt({ ...BASE })
  )

  // 6. sendReceiptRejectedInvalidCnpj — NO draw block
  await send(
    'sendReceiptRejectedInvalidCnpj',
    'Recibo não elegível — Panini XP',
    () => sendReceiptRejectedInvalidCnpj({ ...BASE })
  )

  // 7. sendReceiptRejectedAmountTooLow — NO draw block
  await send(
    'sendReceiptRejectedAmountTooLow',
    'Recibo recebido, mas abaixo do valor mínimo — Panini XP',
    () => sendReceiptRejectedAmountTooLow({ ...BASE, amountBrl: 30 })
  )

  // 8. sendReceiptRejectedDateOutOfWindow — NO draw block
  await send(
    'sendReceiptRejectedDateOutOfWindow',
    'Recibo fora do período da campanha — Panini XP',
    () => sendReceiptRejectedDateOutOfWindow({ ...BASE })
  )

  // 9. sendReceiptRejectedDuplicate — NO draw block
  await send(
    'sendReceiptRejectedDuplicate',
    'Recibo já registrado — Panini XP',
    () => sendReceiptRejectedDuplicate({ ...BASE })
  )

  // ── Summary ────────────────────────────────────────────────────────────────

  const ok = results.filter(r => r.status === 'ok').length
  const failed = results.filter(r => r.status === 'error').length

  console.log('========================================')
  console.log(`Summary: ${ok} sent, ${failed} failed`)
  console.log('========================================')
  for (const r of results) {
    const badge = r.status === 'ok' ? 'OK   ' : 'ERROR'
    console.log(`  [${badge}] ${r.fn}`)
    if (r.error) console.log(`         ${r.error}`)
  }
  console.log('')
  console.log('What to check in the inbox:')
  console.log('  1-4: draw block present (celebratory / urgent / urgent / patient)')
  console.log('  5-9: NO draw block')
  console.log('  All: Instagram CTA in footer (@paninixp · Equipe Panini XP · paninixp.com.br)')

  if (failed > 0) process.exit(1)
}

main().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
