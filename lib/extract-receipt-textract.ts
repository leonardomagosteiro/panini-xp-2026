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

// AUTO-APPROVE GATING
// -------------------
// Textract has been observed to report >=95% confidence on digit misreads
// (e.g., R$84 read as R$884 at 99% confidence). Raw Textract confidence alone is
// NOT a sufficient gate for auto-approval.
//
// Auto-approve ('high' classification) requires ALL of the following:
//   1. CNPJ is DMCAMP (matched by store-signature or strict regex)
//   2. Amount is in [R$50, R$200] inclusive (covers typical purchase range;
//      excludes both "$5 misread of $50" and "$884 misread of $84")
//   3. Amount field confidence >= 80%
//   4. Date field confidence >= 80%
//
// Everything else routes to needs_review for human verification.
// EBANCAS receipts are intentionally NOT auto-approved today (signatures not yet added).
const AUTO_APPROVE_DMCAMP_CNPJ = '07.348.198/0001-48'
const AUTO_APPROVE_MIN_AMOUNT_BRL = 50
const AUTO_APPROVE_MAX_AMOUNT_BRL = 200
const AUTO_APPROVE_FIELD_CONFIDENCE_THRESHOLD = 80

interface AutoApproveInputs {
  cnpj: string | null
  amountBrl: number | null
  totalConfidence: number | null
  cnpjConfidence: number | null
  dateConfidence: number | null
}

function meetsAutoApproveCriteria(inputs: AutoApproveInputs): boolean {
  if (inputs.cnpj !== AUTO_APPROVE_DMCAMP_CNPJ) return false
  if (inputs.amountBrl === null) return false
  if (inputs.amountBrl < AUTO_APPROVE_MIN_AMOUNT_BRL) return false
  if (inputs.amountBrl > AUTO_APPROVE_MAX_AMOUNT_BRL) return false
  if (inputs.totalConfidence === null) return false
  if (inputs.totalConfidence < AUTO_APPROVE_FIELD_CONFIDENCE_THRESHOLD) return false
  if (inputs.dateConfidence === null) return false
  if (inputs.dateConfidence < AUTO_APPROVE_FIELD_CONFIDENCE_THRESHOLD) return false
  // cnpjConfidence is not strictly checked beyond the synthetic 90 from store-signature
  // match (which clears 80) or whatever Textract reported on regex match.
  return true
}

function computeConfidence(
  inputs: AutoApproveInputs
): 'high' | 'medium' | 'low' {
  const { totalConfidence, cnpjConfidence, dateConfidence } = inputs

  if (totalConfidence === null || cnpjConfidence === null || dateConfidence === null) {
    return 'low'
  }

  // Medium tier: all three fields above the medium threshold.
  const meetsMedium =
    totalConfidence >= MEDIUM_CONFIDENCE_THRESHOLD &&
    cnpjConfidence >= MEDIUM_CONFIDENCE_THRESHOLD &&
    dateConfidence >= MEDIUM_CONFIDENCE_THRESHOLD

  if (!meetsMedium) return 'low'

  // High tier: medium-tier AND auto-approve criteria met.
  if (meetsAutoApproveCriteria(inputs)) return 'high'
  return 'medium'
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
  const confidence = computeConfidence({
    cnpj,
    amountBrl: amount,
    totalConfidence,
    cnpjConfidence,
    dateConfidence,
  })

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
