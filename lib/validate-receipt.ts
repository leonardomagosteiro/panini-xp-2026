import type { SupabaseClient } from '@supabase/supabase-js'
import type { ExtractedData } from './extract-receipt'

const CAMPAIGN_START = '2026-04-30'

const VALID_CNPJS = new Set([
  '54511074000111',
  '54511074000200',
  '07348198000148',
])

export type RejectionReason = 'duplicate' | 'not_a_receipt'

export type ReviewReason =
  | 'not_a_receipt'
  | 'invalid_cnpj'
  | 'amount_too_low'
  | 'date_out_of_window'
  | 'unreadable'
  | 'unreadable_image'
  | 'second_unreadable_upload'
  | 'low_confidence'
  | 'incomplete_extraction'

export type ValidationResult =
  | { status: 'approved'; codes_to_generate: number }
  | { status: 'rejected'; reason: RejectionReason }
  | { status: 'needs_review'; review_reason: ReviewReason }
  | { status: 'awaiting_reupload'; review_reason: 'unreadable_image' }

export function normalizeCnpj(cnpj: string | null): string | null {
  if (cnpj === null) return null
  const digits = cnpj.replace(/\D/g, '')
  return digits.length > 0 ? digits : null
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function validateReceipt(
  extracted: ExtractedData,
  receiptId: string,
  supabase: SupabaseClient
): Promise<ValidationResult> {
  // Pre-check 0 — Unreadable image: ask customer to re-upload
  // TODO(razao-social): when razão social cross-validation ships, the cnpj === null
  // branch should change to: cnpj === null AND razão social doesn't match a known store.
  // Currently fires unconditionally on null cnpj since we have no backup signal.
  const nullFieldCount = [extracted.cnpj, extracted.amount_total_brl, extracted.receipt_date]
    .filter(v => v === null).length
  if (
    extracted.is_readable === false ||
    (extracted.confidence === 'low' && nullFieldCount >= 2) ||
    extracted.cnpj === null
  ) {
    return { status: 'awaiting_reupload', review_reason: 'unreadable_image' }
  }

  // Pre-check A — low confidence: skip validation entirely, send to human review
  if (extracted.confidence === 'low') {
    return { status: 'needs_review', review_reason: 'low_confidence' }
  }

  // Pre-check B — incomplete extraction: one or more critical fields missing or not 14 digits
  const normalizedCnpjPre = normalizeCnpj(extracted.cnpj)
  if (
    normalizedCnpjPre === null ||
    normalizedCnpjPre.length !== 14 ||
    extracted.amount_total_brl === null ||
    extracted.receipt_date === null
  ) {
    return { status: 'needs_review', review_reason: 'incomplete_extraction' }
  }

  // Step 1 — not a receipt
  if (!extracted.is_receipt) {
    if (extracted.confidence === 'high') {
      return { status: 'rejected', reason: 'not_a_receipt' }
    }
    return { status: 'needs_review', review_reason: 'not_a_receipt' }
  }

  // Step 2 — unreadable
  if (!extracted.is_readable) {
    return { status: 'needs_review', review_reason: 'unreadable' }
  }

  // Step 3 — CNPJ must match a valid issuer
  const normalizedCnpj = normalizeCnpj(extracted.cnpj)
  if (normalizedCnpj === null || !VALID_CNPJS.has(normalizedCnpj)) {
    return { status: 'needs_review', review_reason: 'invalid_cnpj' }
  }

  // Step 4 — amount must be at least R$50
  if (extracted.amount_total_brl === null || extracted.amount_total_brl < 50) {
    return { status: 'needs_review', review_reason: 'amount_too_low' }
  }

  // Step 5 — receipt date must be within campaign window
  const receiptDate = extracted.receipt_date
  if (
    receiptDate === null ||
    receiptDate < CAMPAIGN_START ||
    receiptDate > todayIso()
  ) {
    return { status: 'needs_review', review_reason: 'date_out_of_window' }
  }

  // Step 6 — duplicate detection (skip if any key field is null)
  if (
    extracted.receipt_number !== null &&
    extracted.receipt_date !== null &&
    normalizedCnpj !== null
  ) {
    const { data, error } = await supabase
      .from('receipts')
      .select('id')
      .eq('receipt_number', extracted.receipt_number)
      .eq('receipt_date', extracted.receipt_date)
      .eq('cnpj_on_receipt', normalizedCnpj)
      .neq('id', receiptId)
      .limit(1)

    if (error) {
      throw new Error(`Duplicate check query failed: ${error.message}`)
    }

    if (data.length > 0) {
      return { status: 'rejected', reason: 'duplicate' }
    }
  }

  // Step 7 — medium confidence: flag for human review
  if (extracted.confidence === 'medium') {
    return { status: 'needs_review', review_reason: 'low_confidence' }
  }

  // Step 8 — all checks passed, confidence is high
  const codes_to_generate = Math.floor(extracted.amount_total_brl / 50)
  return { status: 'approved', codes_to_generate }
}
