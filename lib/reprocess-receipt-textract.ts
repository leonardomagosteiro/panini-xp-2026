import type { SupabaseClient } from '@supabase/supabase-js'
import { extractReceiptTextract } from './extract-receipt-textract'
import { validateReceipt, normalizeCnpj, type ValidationResult } from './validate-receipt'
import { generateCodesForReceipt } from './generate-codes'
import { logError } from './log-error'
import {
  sendReceiptApproved,
  sendReceiptRejectedDuplicate,
  sendReceiptRejectedNotReceipt,
  sendReceiptReuploadRequest,
  sendReceiptManualReviewNotification,
} from './send-receipt-emails'

export type ReprocessResult =
  | { status: 'approved'; codes: string[] }
  | { status: 'rejected'; reason: string }
  | { status: 'awaiting_reupload'; reuploadEmailSent: boolean }
  | { status: 'needs_review'; review_reason: string }
  | { status: 'error'; message: string }

/**
 * Reprocesses a receipt using Textract, regardless of its current status.
 * Unlike processReceipt (which only acts on 'uploaded' rows), this function
 * is designed for batch reprocessing of any receipt and is idempotent.
 *
 * Side effects (DB and email) match the original pipeline EXCEPT:
 *  - Image-size pre-check is skipped (these images were already accepted once)
 *  - The 'processing' status is not used (no concurrency in batch script)
 *  - SUPPRESS_MANUAL_REVIEW_EMAIL env var controls whether the manual-review
 *    email fires; the rejection and reupload emails fire as designed unless
 *    the gate fields (e.g., reupload_request_sent_at) indicate they already
 *    fired earlier.
 */
export async function reprocessReceiptWithTextract(
  receiptId: string,
  supabase: SupabaseClient
): Promise<ReprocessResult> {
  // Read receipt
  const { data: receipt, error: receiptError } = await supabase
    .from('receipts')
    .select('id, storage_path, participant_id, created_at, reupload_request_sent_at, manual_review_email_sent_at')
    .eq('id', receiptId)
    .single()

  if (receiptError || !receipt) {
    return { status: 'error', message: `Receipt not found: ${receiptId}` }
  }

  // Read participant
  const { data: participant, error: participantError } = await supabase
    .from('participants')
    .select('id, email, nickname')
    .eq('id', receipt.participant_id)
    .single()

  if (participantError || !participant) {
    return { status: 'error', message: `Participant not found for receipt ${receiptId}` }
  }

  const participantId = participant.id as string
  const email = participant.email as string | null
  const nickname = participant.nickname as string
  const uploadDate = receipt.created_at as string

  // Download image
  const { data: blob, error: downloadError } = await supabase
    .storage.from('receipts').download(receipt.storage_path)
  if (downloadError || !blob) {
    return { status: 'error', message: `Image download failed: ${downloadError?.message}` }
  }
  const imageBase64 = Buffer.from(await blob.arrayBuffer()).toString('base64')

  // Call Textract
  let extracted
  try {
    extracted = await extractReceiptTextract(imageBase64, 'image/jpeg')
  } catch (err) {
    return { status: 'error', message: `Textract failed: ${err instanceof Error ? err.message : String(err)}` }
  }

  // Save AI metadata
  const { error: metaError } = await supabase
    .from('receipts')
    .update({
      ai_raw_response: { ...extracted, _provider: 'textract', _reprocessed_at: new Date().toISOString() },
      ai_confidence: extracted.confidence,
      ai_processed_at: new Date().toISOString(),
      receipt_number: extracted.receipt_number,
      receipt_date: extracted.receipt_date,
      cnpj_on_receipt: normalizeCnpj(extracted.cnpj),
      amount_on_receipt: extracted.amount_total_brl,
    })
    .eq('id', receiptId)

  if (metaError) {
    await logError('reprocess-textract', 'Failed to save AI metadata (continuing)', {
      receiptId,
      error: metaError.message,
    })
  }

  // Validate
  let validation: ValidationResult
  try {
    validation = await validateReceipt(extracted, receiptId, supabase)
  } catch (err) {
    return { status: 'error', message: `Validation failed: ${err instanceof Error ? err.message : String(err)}` }
  }

  // Branch on outcome
  if (validation.status === 'approved') {
    let codes: string[]
    try {
      codes = await generateCodesForReceipt(receiptId, participantId, validation.codes_to_generate, supabase)
    } catch (err) {
      const { data: existingCodes } = await supabase
        .from('codes')
        .select('code')
        .eq('receipt_id', receiptId)
      if (existingCodes && existingCodes.length > 0) {
        codes = existingCodes.map((r: { code: string }) => r.code)
      } else {
        return { status: 'error', message: `Code generation failed: ${err instanceof Error ? err.message : String(err)}` }
      }
    }

    const { error: approvedUpdateErr } = await supabase
      .from('receipts')
      .update({ status: 'approved', codes_generated: codes.length })
      .eq('id', receiptId)
    if (approvedUpdateErr) {
      return { status: 'error', message: `DB update (approved) failed: ${approvedUpdateErr.message}` }
    }

    if (email) {
      await sendReceiptApproved({
        participantId, email, nickname, uploadDate, codes,
        amountBrl: extracted.amount_total_brl ?? 0,
      })
    }
    return { status: 'approved', codes }
  }

  if (validation.status === 'rejected') {
    const { error: rejectedUpdateErr } = await supabase
      .from('receipts')
      .update({ status: 'rejected', rejection_reason: validation.reason })
      .eq('id', receiptId)
    if (rejectedUpdateErr) {
      return { status: 'error', message: `DB update (rejected) failed: ${rejectedUpdateErr.message}` }
    }
    if (email) {
      switch (validation.reason) {
        case 'duplicate':
          await sendReceiptRejectedDuplicate({ participantId, email, nickname, uploadDate, isDelayedAnalysis: true })
          break
        case 'not_a_receipt':
          await sendReceiptRejectedNotReceipt({ participantId, email, nickname, uploadDate })
          break
      }
    }
    return { status: 'rejected', reason: validation.reason }
  }

  if (validation.status === 'awaiting_reupload') {
    const alreadySent = receipt.reupload_request_sent_at !== null
    const { error: updateErr } = await supabase
      .from('receipts')
      .update({
        status: 'awaiting_reupload',
        reupload_request_sent_at: alreadySent ? receipt.reupload_request_sent_at : new Date().toISOString(),
      })
      .eq('id', receiptId)
    if (updateErr) {
      return { status: 'error', message: `DB update (awaiting_reupload) failed: ${updateErr.message}` }
    }
    if (!alreadySent && email) {
      await sendReceiptReuploadRequest({ participantId, email, nickname, uploadDate })
    }
    return { status: 'awaiting_reupload', reuploadEmailSent: !alreadySent && !!email }
  }

  // needs_review
  const { error: needsReviewUpdateErr } = await supabase
    .from('receipts')
    .update({
      status: 'needs_review',
      ai_raw_response: {
        _system_note: `ai_extraction_review_${validation.review_reason}`,
        _reprocessed_at: new Date().toISOString(),
        extracted,
      },
    })
    .eq('id', receiptId)
  if (needsReviewUpdateErr) {
    return { status: 'error', message: `DB update (needs_review) failed: ${needsReviewUpdateErr.message}` }
  }

  // Suppressed by env var SUPPRESS_MANUAL_REVIEW_EMAIL in batch contexts.
  const suppress = process.env.SUPPRESS_MANUAL_REVIEW_EMAIL
  if (suppress !== '1' && suppress !== 'true' && email && !receipt.manual_review_email_sent_at) {
    await sendReceiptManualReviewNotification({ participantId, email, nickname, uploadDate })
    await supabase
      .from('receipts')
      .update({ manual_review_email_sent_at: new Date().toISOString() })
      .eq('id', receiptId)
  }

  return { status: 'needs_review', review_reason: validation.review_reason }
}
