import * as dotenv from 'dotenv'
import * as path from 'path'
import { createAdminClient } from '../lib/supabase-admin'
import { extractReceiptTextract } from '../lib/extract-receipt-textract'
import { validateReceipt } from '../lib/validate-receipt'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const RECEIPT_ID = process.argv[2]

if (!RECEIPT_ID) {
  console.error('Usage: npx tsx scripts/predict-receipt.ts <receipt-id>')
  process.exit(1)
}

async function main() {
  const supabase = createAdminClient()

  // 1. Fetch the receipt
  const { data: receipt, error } = await supabase
    .from('receipts')
    .select('id, status, storage_path, cnpj_on_receipt, amount_on_receipt, receipt_date, ai_confidence, manual_review_email_sent_at, reupload_request_sent_at')
    .eq('id', RECEIPT_ID)
    .single()

  if (error || !receipt) {
    console.error('Receipt not found:', error)
    process.exit(1)
  }

  console.log('=== Current DB state ===')
  console.log(`  status:                       ${receipt.status}`)
  console.log(`  cnpj_on_receipt (OpenAI):     ${receipt.cnpj_on_receipt ?? '(null)'}`)
  console.log(`  amount_on_receipt (OpenAI):   ${receipt.amount_on_receipt ?? '(null)'}`)
  console.log(`  receipt_date (OpenAI):        ${receipt.receipt_date ?? '(null)'}`)
  console.log(`  ai_confidence (OpenAI):       ${receipt.ai_confidence ?? '(null)'}`)
  console.log(`  manual_review_email_sent_at:  ${receipt.manual_review_email_sent_at ?? '(null)'}`)
  console.log(`  reupload_request_sent_at:     ${receipt.reupload_request_sent_at ?? '(null)'}`)
  console.log('')

  // 2. Download the image
  const { data: blob, error: dlError } = await supabase
    .storage.from('receipts').download(receipt.storage_path)
  if (dlError || !blob) {
    console.error('Image download failed:', dlError)
    process.exit(1)
  }
  const base64 = Buffer.from(await blob.arrayBuffer()).toString('base64')

  // 3. Run Textract extraction
  console.log('=== Textract extraction ===')
  const extracted = await extractReceiptTextract(base64, 'image/jpeg')
  console.log(`  is_receipt:        ${extracted.is_receipt}`)
  console.log(`  is_readable:       ${extracted.is_readable}`)
  console.log(`  cnpj:              ${extracted.cnpj ?? '(null)'}`)
  console.log(`  amount_total_brl:  ${extracted.amount_total_brl ?? '(null)'}`)
  console.log(`  receipt_date:      ${extracted.receipt_date ?? '(null)'}`)
  console.log(`  receipt_number:    ${extracted.receipt_number ?? '(null)'}`)
  console.log(`  confidence:        ${extracted.confidence}`)
  console.log(`  notes:             ${extracted.notes}`)
  console.log('')

  // 4. Run validation (pure function — no side effects)
  console.log('=== Validator decision ===')
  const validation = await validateReceipt(extracted, RECEIPT_ID, supabase)
  console.log(`  status:            ${validation.status}`)
  if (validation.status === 'approved') {
    console.log(`  codes_to_generate: ${validation.codes_to_generate}`)
  } else if (validation.status === 'rejected') {
    console.log(`  reason:            ${validation.reason}`)
  } else if (validation.status === 'needs_review') {
    console.log(`  review_reason:     ${validation.review_reason}`)
  } else if (validation.status === 'awaiting_reupload') {
    console.log(`  review_reason:     ${validation.review_reason}`)
  }
  console.log('')

  // 5. Predict side effects (would-have-done)
  console.log('=== Predicted side effects (NOT executed) ===')
  if (validation.status === 'approved') {
    console.log(`  - Would update receipts row: status=approved, codes_generated=${validation.codes_to_generate}`)
    console.log(`  - Would call generateCodesForReceipt to insert ${validation.codes_to_generate} codes`)
    console.log(`  - Would send approval email`)
  } else if (validation.status === 'rejected') {
    console.log(`  - Would update receipts row: status=rejected, rejection_reason=${validation.reason}`)
    console.log(`  - Would send rejection email`)
  } else if (validation.status === 'needs_review') {
    console.log(`  - Would update receipts row: status=needs_review, review_reason=${validation.review_reason}`)
    if (!receipt.manual_review_email_sent_at) {
      console.log(`  - WOULD send manual-review email (manual_review_email_sent_at is null)`)
    } else {
      console.log(`  - Would NOT send email (already sent at ${receipt.manual_review_email_sent_at})`)
    }
  } else if (validation.status === 'awaiting_reupload') {
    console.log(`  - Would update receipts row: status=awaiting_reupload, review_reason=${validation.review_reason}`)
    if (!receipt.reupload_request_sent_at) {
      console.log(`  - WOULD send reupload-request email (reupload_request_sent_at is null)`)
    } else {
      console.log(`  - Would NOT send email (already sent at ${receipt.reupload_request_sent_at})`)
    }
  }
  console.log('')
  console.log('Done. No database writes, no emails, no codes generated.')
}

main().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
