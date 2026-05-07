import type { SupabaseClient } from '@supabase/supabase-js'
import { extractReceipt, type ImageMimeType } from './extract-receipt'
import { validateReceipt, normalizeCnpj, type RejectionReason } from './validate-receipt'
import { generateCodesForReceipt } from './generate-codes'
import { logError } from './log-error'
import {
  sendReceiptApproved,
  sendReceiptRejectedNotReceipt,
  sendReceiptRejectedInvalidCnpj,
  sendReceiptRejectedAmountTooLow,
  sendReceiptRejectedDateOutOfWindow,
  sendReceiptRejectedDuplicate,
  sendReceiptPleaseReupload,
} from './send-receipt-emails'

export type ProcessResult =
  | { status: 'approved';     codes: string[] }
  | { status: 'rejected';     reason: RejectionReason }
  | { status: 'needs_review' }
  | { status: 'skipped';      previousStatus: string }
  | { status: 'error';        message: string }

function getMimeType(storagePath: string): ImageMimeType | null {
  const ext = storagePath.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'jpg':
    case 'jpeg': return 'image/jpeg'
    case 'png':  return 'image/png'
    case 'webp': return 'image/webp'
    case 'gif':  return 'image/gif'
    default:     return null
  }
}

async function revertToUploaded(receiptId: string, supabase: SupabaseClient): Promise<void> {
  await supabase
    .from('receipts')
    .update({ status: 'uploaded' })
    .eq('id', receiptId)
}

export async function processReceipt(
  receiptId: string,
  supabase: SupabaseClient
): Promise<ProcessResult> {
  // Step 1 — Read receipt row
  const { data: receipt, error: receiptError } = await supabase
    .from('receipts')
    .select('id, storage_path, status, participant_id, created_at')
    .eq('id', receiptId)
    .single()

  if (receiptError || receipt === null) {
    return { status: 'error', message: `Receipt not found: ${receiptId}` }
  }

  if (receipt.status !== 'uploaded') {
    return { status: 'skipped', previousStatus: receipt.status }
  }

  // Step 2 — Mark as processing to prevent double-processing
  const { error: markError } = await supabase
    .from('receipts')
    .update({ status: 'processing' })
    .eq('id', receiptId)

  if (markError) {
    return { status: 'error', message: 'Failed to mark processing' }
  }

  // Step 3 — Read participant row
  const { data: participant, error: participantError } = await supabase
    .from('participants')
    .select('email, nickname')
    .eq('id', receipt.participant_id)
    .single()

  if (participantError || participant === null) {
    await revertToUploaded(receiptId, supabase)
    await logError('process-receipt', 'Participant not found', { receiptId, participant_id: receipt.participant_id })
    return { status: 'error', message: 'Participant not found' }
  }

  if (!participant.email) {
    // Condition 1 — No email on file: route to needs_review for admin follow-up.
    // Not an error — this is expected for participants who registered without email.
    // Admin UI (Component 8) will show the _system_note to explain why it's here.
    await supabase
      .from('receipts')
      .update({
        status: 'needs_review',
        ai_raw_response: { _system_note: 'no_email_on_file', skipped_at: new Date().toISOString() },
      })
      .eq('id', receiptId)
    return { status: 'needs_review' }
  }

  const email: string = participant.email
  const nickname: string = participant.nickname
  const uploadDate: string = receipt.created_at
  const participantId: string = receipt.participant_id

  // Step 4 — Download image and encode as base64
  const mimeType = getMimeType(receipt.storage_path)
  if (mimeType === null) {
    await revertToUploaded(receiptId, supabase)
    return { status: 'error', message: `Unknown image type: ${receipt.storage_path}` }
  }

  const { data: imageData, error: downloadError } = await supabase.storage
    .from('receipts')
    .download(receipt.storage_path)

  if (downloadError || imageData === null) {
    await revertToUploaded(receiptId, supabase)
    await logError('process-receipt', 'Failed to download receipt image', {
      receiptId,
      storage_path: receipt.storage_path,
      error: downloadError?.message,
    })
    return { status: 'error', message: `Image download failed: ${downloadError?.message ?? 'no data'}` }
  }

  const arrayBuffer = await imageData.arrayBuffer()
  const imageBase64 = Buffer.from(arrayBuffer).toString('base64')

  // Condition 2 — Image too large for Anthropic API (5MB hard limit measured on base64 string length
  // itself, NOT raw image bytes — verified empirically 2026-05-07).
  // Check before calling extractReceipt to avoid a guaranteed API error and save cost.
  const BASE64_SIZE_LIMIT = 5 * 1024 * 1024
  if (imageBase64.length > BASE64_SIZE_LIMIT) {
    await supabase
      .from('receipts')
      .update({
        status: 'needs_review',
        ai_raw_response: {
          _system_note: 'image_too_large',
          size_bytes_base64: imageBase64.length,
          skipped_at: new Date().toISOString(),
        },
      })
      .eq('id', receiptId)
    return { status: 'needs_review' }
  }

  // Step 5 — Extract data via AI
  let extracted: Awaited<ReturnType<typeof extractReceipt>>
  try {
    extracted = await extractReceipt(imageBase64, mimeType)
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : String(err)

    // Condition 3 — Image unprocessable by Claude (corrupt, unsupported format, etc.).
    // These are permanent failures — retrying won't help. Route to needs_review
    // so admin can inspect the image manually. Other errors (network, timeout)
    // keep the existing behavior: revert to uploaded so the receipt can be retried.
    if (/could not process image|invalid image|unsupported image format|exceeds.*maximum|image too large/i.test(errMessage)) {
      await supabase
        .from('receipts')
        .update({
          status: 'needs_review',
          ai_raw_response: {
            _system_note: 'image_unprocessable',
            error: errMessage,
            skipped_at: new Date().toISOString(),
          },
        })
        .eq('id', receiptId)
      return { status: 'needs_review' }
    }

    await revertToUploaded(receiptId, supabase)
    await logError('process-receipt', 'AI extraction failed', {
      receiptId,
      error: errMessage,
    })
    return { status: 'error', message: `Extraction failed: ${errMessage}` }
  }

  // Step 6 — Save AI metadata to receipt row (log failure but continue)
  const { error: metaError } = await supabase
    .from('receipts')
    .update({
      ai_raw_response: extracted,
      ai_confidence: extracted.confidence,
      ai_processed_at: new Date().toISOString(),
      receipt_number: extracted.receipt_number,
      receipt_date: extracted.receipt_date,
      cnpj_on_receipt: normalizeCnpj(extracted.cnpj),
    })
    .eq('id', receiptId)

  if (metaError) {
    await logError('process-receipt', 'Failed to save AI metadata (continuing)', {
      receiptId,
      error: metaError.message,
    })
  }

  // Step 7 — Validate
  let validation: Awaited<ReturnType<typeof validateReceipt>>
  try {
    validation = await validateReceipt(extracted, receiptId, supabase)
  } catch (err) {
    await revertToUploaded(receiptId, supabase)
    await logError('process-receipt', 'Validation failed', {
      receiptId,
      error: String(err),
    })
    return { status: 'error', message: `Validation failed: ${err instanceof Error ? err.message : String(err)}` }
  }

  // Step 8 — Branch on validation result
  if (validation.status === 'approved') {
    let codes: string[]

    try {
      codes = await generateCodesForReceipt(
        receiptId,
        participantId,
        validation.codes_to_generate,
        supabase
      )
    } catch (err) {
      // Detect whether codes were actually inserted despite the throw
      const { data: existingCodes } = await supabase
        .from('codes')
        .select('code')
        .eq('receipt_id', receiptId)

      if (existingCodes && existingCodes.length > 0) {
        // Partial success — codes are in the DB, recover gracefully
        await logError('process-receipt-recovery', 'Recovered from partial code generation', {
          receiptId,
          codeCount: existingCodes.length,
          error: String(err),
        })
        codes = existingCodes.map((r: { code: string }) => r.code)
      } else {
        // Nothing inserted — safe to revert and retry
        await revertToUploaded(receiptId, supabase)
        await logError('process-receipt', 'Code generation failed, no codes inserted', {
          receiptId,
          error: String(err),
        })
        return { status: 'error', message: `Code generation failed: ${err instanceof Error ? err.message : String(err)}` }
      }
    }

    await supabase
      .from('receipts')
      .update({ status: 'approved', codes_generated: codes.length })
      .eq('id', receiptId)

    await sendReceiptApproved({
      participantId,
      email,
      nickname,
      uploadDate,
      codes,
      amountBrl: extracted.amount_total_brl ?? 0,
    })

    return { status: 'approved', codes }
  }

  if (validation.status === 'rejected') {
    await supabase
      .from('receipts')
      .update({ status: 'rejected', rejection_reason: validation.reason })
      .eq('id', receiptId)

    const baseParams = { participantId, email, nickname, uploadDate }

    switch (validation.reason) {
      case 'not_a_receipt':
        await sendReceiptRejectedNotReceipt(baseParams)
        break
      case 'invalid_cnpj':
        await sendReceiptRejectedInvalidCnpj(baseParams)
        break
      case 'amount_too_low':
        await sendReceiptRejectedAmountTooLow({
          ...baseParams,
          amountBrl: extracted.amount_total_brl ?? 0,
        })
        break
      case 'date_out_of_window':
        await sendReceiptRejectedDateOutOfWindow(baseParams)
        break
      case 'duplicate':
        await sendReceiptRejectedDuplicate(baseParams)
        break
      case 'unreadable':
        await sendReceiptPleaseReupload(baseParams)
        break
    }

    return { status: 'rejected', reason: validation.reason }
  }

  // needs_review
  await supabase
    .from('receipts')
    .update({ status: 'needs_review' })
    .eq('id', receiptId)

  return { status: 'needs_review' }
}
