import { TextractClient, AnalyzeExpenseCommand, type ExpenseField } from '@aws-sdk/client-textract'
import type { ExtractedData, ImageMimeType } from './extract-receipt'
import { matchStoreSignature } from './store-signatures'

const HIGH_CONFIDENCE_THRESHOLD = 95
const MEDIUM_CONFIDENCE_THRESHOLD = 70

// Portuguese month abbreviations used on Brazilian receipts (e.g., "23/MAI/2026")
const PT_MONTH_MAP: Record<string, string> = {
  JAN: '01', FEV: '02', MAR: '03', ABR: '04', MAI: '05', JUN: '06',
  JUL: '07', AGO: '08', SET: '09', OUT: '10', NOV: '11', DEZ: '12',
}

function getClient(): TextractClient {
  return new TextractClient({
    region: process.env.AWS_REGION!,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  })
}

function findField(fields: ExpenseField[], type: string): ExpenseField | null {
  return fields.find(f => f.Type?.Text === type) ?? null
}

function getOtherFields(fields: ExpenseField[]): ExpenseField[] {
  return fields.filter(f => f.Type?.Text === 'OTHER')
}

// Matches a properly formatted Brazilian CNPJ (XX.XXX.XXX/XXXX-XX) anywhere in the text.
// Returns the 14-digit form if matched, else null. This rejects 14-digit blobs that
// happen to have the right length but aren't actually CNPJs (e.g., concatenated dates).
function extractCnpjFromText(text: string): string | null {
  const match = text.match(/(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})-(\d{2})/)
  if (!match) return null
  return match[1] + match[2] + match[3] + match[4] + match[5]
}

// Looks for the first OTHER field that matches CNPJ shape and returns it with its confidence.
function findCnpjInOthers(fields: ExpenseField[]): { cnpj: string; confidence: number } | null {
  for (const f of getOtherFields(fields)) {
    const text = f.ValueDetection?.Text ?? ''
    const cnpj = extractCnpjFromText(text)
    if (cnpj) {
      return { cnpj, confidence: f.ValueDetection?.Confidence ?? 0 }
    }
  }
  return null
}

// Parses Brazilian amount strings like "184,90" or "1.234,56" into a number.
function parseBrazilianAmount(text: string): number | null {
  // Remove R$ prefix, spaces, and currency symbols
  const cleaned = text.replace(/[R$\s]/g, '')
  // Replace dot (thousands) with nothing, then comma (decimal) with dot
  const normalized = cleaned.replace(/\./g, '').replace(',', '.')
  const n = Number(normalized)
  return Number.isFinite(n) && n > 0 ? n : null
}

// Parses receipt dates in formats: "23/MAI/2026", "07/06/2026", "2026-05-23".
// Returns YYYY-MM-DD or null.
function parseReceiptDate(text: string): string | null {
  const trimmed = text.trim()

  // YYYY-MM-DD already
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
  }

  // dd/MMM/yyyy (Portuguese month abbreviation)
  const ptMatch = trimmed.match(/^(\d{1,2})\/([A-Za-zÇçÃãÉéÍíÓóÚú]{3,4})\/(\d{4})$/)
  if (ptMatch) {
    const day = ptMatch[1].padStart(2, '0')
    const monthKey = ptMatch[2].toUpperCase().slice(0, 3)
    const month = PT_MONTH_MAP[monthKey]
    if (!month) return null
    const year = ptMatch[3]
    return `${year}-${month}-${day}`
  }

  // dd/MM/yyyy
  const numMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (numMatch) {
    const day = numMatch[1].padStart(2, '0')
    const month = numMatch[2].padStart(2, '0')
    const year = numMatch[3]
    return `${year}-${month}-${day}`
  }

  return null
}

// Tries to find a receipt number in OTHER fields. Heuristic: a numeric string of 4-15 digits
// that is NOT a CNPJ (14 digits) and NOT a CPF (11 digits).
function findReceiptNumber(fields: ExpenseField[]): string | null {
  for (const f of getOtherFields(fields)) {
    const text = (f.ValueDetection?.Text ?? '').trim()
    if (/^\d{4,15}$/.test(text)) {
      if (text.length !== 14 && text.length !== 11) {
        return text
      }
    }
  }
  return null
}

// NOTE: Textract has been observed to report >=95% confidence on digit misreads
// (e.g., 84.00 returned as 884.00 with high confidence). We do not trust Textract's
// 'high' confidence as a basis for auto-approval. The classification logic below
// preserves the calibration math, but we CLAMP the output to a maximum of 'medium'.
// 'medium' routes to needs_review (human verification) via the existing validator.
//
// To re-enable auto-approve in the future, remove the clamp at the bottom of this
// function.
function computeConfidence(
  totalConfidence: number | null,
  cnpjConfidence: number | null,
  dateConfidence: number | null
): 'high' | 'medium' | 'low' {
  if (totalConfidence === null || cnpjConfidence === null || dateConfidence === null) {
    return 'low'
  }
  let classification: 'high' | 'medium' | 'low'
  if (
    totalConfidence >= HIGH_CONFIDENCE_THRESHOLD &&
    cnpjConfidence >= HIGH_CONFIDENCE_THRESHOLD &&
    dateConfidence >= HIGH_CONFIDENCE_THRESHOLD
  ) {
    classification = 'high'
  } else if (
    totalConfidence >= MEDIUM_CONFIDENCE_THRESHOLD &&
    cnpjConfidence >= MEDIUM_CONFIDENCE_THRESHOLD &&
    dateConfidence >= MEDIUM_CONFIDENCE_THRESHOLD
  ) {
    classification = 'medium'
  } else {
    classification = 'low'
  }

  // CLAMP: never return 'high' — Textract confidence is not yet trusted enough
  // for auto-approve. See note above.
  return classification === 'high' ? 'medium' : classification
}

export async function extractReceiptTextract(
  imageBase64: string,
  _mimeType: ImageMimeType
): Promise<ExtractedData> {
  const bytes = Uint8Array.from(Buffer.from(imageBase64, 'base64'))

  const client = getClient()
  let response
  try {
    response = await client.send(new AnalyzeExpenseCommand({ Document: { Bytes: bytes } }))
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    throw new Error(`Textract extraction failed: ${reason}`)
  }

  const docs = response.ExpenseDocuments ?? []
  if (docs.length === 0 || !docs[0].SummaryFields) {
    return {
      is_receipt: false,
      is_readable: false,
      cnpj: null,
      amount_total_brl: null,
      receipt_number: null,
      receipt_date: null,
      confidence: 'low',
      notes: 'Textract returned no ExpenseDocuments',
    }
  }

  const summary = docs[0].SummaryFields ?? []

  const totalField = findField(summary, 'TOTAL')
  const dateField = findField(summary, 'INVOICE_RECEIPT_DATE')
  const vendorField = findField(summary, 'VENDOR_NAME')
  const cnpjMatch = findCnpjInOthers(summary)

  const totalText = totalField?.ValueDetection?.Text ?? null
  const totalConfidence = totalField?.ValueDetection?.Confidence ?? null
  const amount = totalText ? parseBrazilianAmount(totalText) : null

  const dateText = dateField?.ValueDetection?.Text ?? null
  const dateConfidence = dateField?.ValueDetection?.Confidence ?? null
  const date = dateText ? parseReceiptDate(dateText) : null

  // Signature-match fallback: when the strict CNPJ regex fails, try matching
  // known store signatures (vendor name, address, bare CNPJ in any format).
  // See lib/store-signatures.ts for the rules.
  let cnpj = cnpjMatch?.cnpj ?? null
  let cnpjConfidence = cnpjMatch?.confidence ?? null
  let storeMatchSource: string | null = null
  if (cnpj === null) {
    const storeMatch = matchStoreSignature(response)
    if (storeMatch) {
      cnpj = storeMatch.canonicalCnpj
      // Synthetic confidence: high enough to clear the medium threshold so
      // the validator no longer routes the receipt as invalid_cnpj.
      // Not 'high' enough to risk auto-approve (which is clamped anyway).
      cnpjConfidence = 90
      storeMatchSource = `${storeMatch.storeName}:${storeMatch.matchSource}`
    }
  }

  const receiptNumber = findReceiptNumber(summary)

  const hasAnySignal = !!(totalField || vendorField || cnpjMatch)
  const confidence = computeConfidence(totalConfidence, cnpjConfidence, dateConfidence)

  const notes = [
    `Textract: total=${totalText ?? 'none'} (${totalConfidence?.toFixed(1) ?? '-'}%)`,
    `date=${dateText ?? 'none'} (${dateConfidence?.toFixed(1) ?? '-'}%)`,
    `cnpj=${cnpj ?? 'none'} (${cnpjConfidence?.toFixed(1) ?? '-'}%)`,
    `vendor=${vendorField?.ValueDetection?.Text ?? 'none'}`,
    `other_count=${getOtherFields(summary).length}`,
    storeMatchSource ? `store_match=${storeMatchSource}` : '',
  ].filter(Boolean).join(' | ')

  return {
    is_receipt: hasAnySignal,
    is_readable: hasAnySignal,
    cnpj,
    amount_total_brl: amount,
    receipt_number: receiptNumber,
    receipt_date: date,
    confidence,
    notes,
  }
}
