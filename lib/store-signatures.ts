/**
 * Store signature matching for receipts where Textract's strict CNPJ regex
 * fails to find a CNPJ. We use known store-identifying signatures (vendor
 * names, addresses, bare CNPJs) to recover receipts that are clearly from
 * known stores but where OCR muddled the structured CNPJ extraction.
 *
 * Currently supports: DMCAMP.
 * EBANCAS signatures will be added later.
 *
 * Returns: { storeName, canonicalCnpj, matchSource } on match, null otherwise.
 */

export interface StoreMatch {
  storeName: 'DMCAMP'
  canonicalCnpj: string
  matchSource: 'bare_cnpj' | 'vendor_name' | 'address'
}

const DMCAMP = {
  storeName: 'DMCAMP' as const,
  canonicalCnpj: '07.348.198/0001-48',
  bareCnpj: '07348198000148',
  nameVariants: ['DMCAMP', 'DM CAMP'],
  addressTokens: { street: 'RIBEIRAO BONITO', number: '430' },
  cep: '13030120',
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function normalize(s: string): string {
  return stripAccents(s).toUpperCase()
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, '')
}

interface TextractField {
  Type?: { Text?: string }
  LabelDetection?: { Text?: string }
  ValueDetection?: { Text?: string; Confidence?: number }
}

interface TextractExpenseDoc {
  SummaryFields?: TextractField[]
}

interface TextractResponse {
  ExpenseDocuments?: TextractExpenseDoc[]
}

/**
 * Check 1: bare CNPJ in OTHER fields whose label contains "CNPJ".
 * Strips punctuation, compares to known CNPJ digit strings.
 */
function checkBareCnpj(fields: TextractField[]): StoreMatch | null {
  // We scan ALL OTHER fields' values for a digits-only match to DMCAMP's CNPJ.
  // We do NOT require the label to be "CNPJ" because Textract OCRs the label as
  // "CHPJ", "C NPJ", "CNPI", etc. on credit-card slips and tilted receipts.
  // Since DMCAMP's 14-digit CNPJ is unique, a digits-only exact match is
  // sufficient evidence regardless of what label Textract chose.
  for (const f of fields) {
    const type = f.Type?.Text ?? ''
    if (type !== 'OTHER') continue
    const value = f.ValueDetection?.Text ?? ''
    const digits = digitsOnly(value)
    // exact 14-digit match (digits == bareCnpj) handles "07348198000148",
    // "07 348.198/0001-48", "07.348.198/0001-48", and any other punctuation/
    // whitespace variant Textract emits.
    if (digits === DMCAMP.bareCnpj) {
      return {
        storeName: DMCAMP.storeName,
        canonicalCnpj: DMCAMP.canonicalCnpj,
        matchSource: 'bare_cnpj',
      }
    }
  }
  return null
}

/**
 * Check 2: store name substring in VENDOR_NAME or VENDOR_ADDRESS.
 * Accent-stripped, uppercased; substring match.
 */
function checkVendorName(fields: TextractField[]): StoreMatch | null {
  const nameTargets = new Set(['VENDOR_NAME', 'VENDOR_ADDRESS', 'NAME'])
  for (const f of fields) {
    const type = f.Type?.Text ?? ''
    if (!nameTargets.has(type)) continue
    const value = normalize(f.ValueDetection?.Text ?? '')
    for (const variant of DMCAMP.nameVariants) {
      if (value.includes(variant)) {
        return {
          storeName: DMCAMP.storeName,
          canonicalCnpj: DMCAMP.canonicalCnpj,
          matchSource: 'vendor_name',
        }
      }
    }
  }
  return null
}

/**
 * Check 3: address signature in ADDRESS-type fields.
 * Requires BOTH street ("RIBEIRAO BONITO", accent-stripped) AND
 * number ("430") in the same field. Rescues the OCR-mangled-vendor-name
 * cases where the address is the only reliable identifier.
 */
function checkAddress(fields: TextractField[]): StoreMatch | null {
  const addrTargets = new Set([
    'ADDRESS',
    'VENDOR_ADDRESS',
    'ADDRESS_BLOCK',
    'STREET',
  ])
  for (const f of fields) {
    const type = f.Type?.Text ?? ''
    if (!addrTargets.has(type)) continue
    const raw = f.ValueDetection?.Text ?? ''
    const value = normalize(raw)

    // Rule A: full street name + number
    if (
      value.includes(DMCAMP.addressTokens.street) &&
      value.includes(DMCAMP.addressTokens.number)
    ) {
      return {
        storeName: DMCAMP.storeName,
        canonicalCnpj: DMCAMP.canonicalCnpj,
        matchSource: 'address',
      }
    }

    // Rule B: CEP signature (OCR-resistant — pulls out 8 digits anywhere
    // in the address field, ignoring punctuation). Rescues addresses where
    // the OCR mangled the street name but the postal code is intact.
    const digitsInValue = digitsOnly(raw)
    if (digitsInValue.includes(DMCAMP.cep)) {
      return {
        storeName: DMCAMP.storeName,
        canonicalCnpj: DMCAMP.canonicalCnpj,
        matchSource: 'address',
      }
    }
  }
  return null
}

/**
 * Main matcher. Runs checks in order and returns the first match.
 * Order is: bare CNPJ (most precise) -> vendor name -> address.
 */
export function matchStoreSignature(response: TextractResponse): StoreMatch | null {
  const fields = response.ExpenseDocuments?.[0]?.SummaryFields ?? []
  if (fields.length === 0) return null

  return checkBareCnpj(fields) ?? checkVendorName(fields) ?? checkAddress(fields)
}
