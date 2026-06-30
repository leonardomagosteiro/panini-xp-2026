import type { SupabaseClient } from '@supabase/supabase-js'

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const CODE_PREFIX = 'PXP-2026-'
const SUFFIX_LENGTH = 5
const MAX_RETRIES = 10

function generateCode(): string {
  let suffix = ''
  for (let i = 0; i < SUFFIX_LENGTH; i++) {
    suffix += CHARSET[Math.floor(Math.random() * CHARSET.length)]
  }
  return `${CODE_PREFIX}${suffix}`
}

async function generateUniqueCode(supabase: SupabaseClient): Promise<string> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const code = generateCode()

    const { data, error } = await supabase
      .from('codes')
      .select('id')
      .eq('code', code)
      .limit(1)

    if (error) {
      throw new Error(`Code uniqueness check failed: ${error.message}`)
    }

    const { data: burned, error: burnedError } = await supabase
      .from('burned_codes')
      .select('code')
      .eq('code', code)
      .limit(1)

    if (burnedError) {
      throw new Error(`Burned-code check failed: ${burnedError.message}`)
    }

    if (data.length === 0 && burned.length === 0) {
      return code
    }
  }

  throw new Error(
    `Failed to generate a unique code after ${MAX_RETRIES} attempts — possible collision saturation`
  )
}

export async function generateCodesForReceipt(
  receiptId: string,
  participantId: string,
  count: number,
  supabase: SupabaseClient
): Promise<string[]> {
  if (count === 0) return []

  // Guard: never generate codes for a blocked participant
  const { data: participant, error: blockedError } = await supabase
    .from('participants')
    .select('blocked')
    .eq('id', participantId)
    .single()

  if (blockedError || participant === null) {
    throw new Error(
      `Blocked-status check failed: ${blockedError?.message ?? 'participant not found'}`
    )
  }

  if (participant.blocked === true) {
    return []
  }

  // Phase 1: generate all N unique codes sequentially
  // (sequential is required — parallel checks could confirm the same code as unique twice)
  const codes: string[] = []
  for (let i = 0; i < count; i++) {
    codes.push(await generateUniqueCode(supabase))
  }

  // Phase 2: single atomic insert of all N rows
  const rows = codes.map(code => ({
    code,
    participant_id: participantId,
    receipt_id: receiptId,
  }))

  const { error: insertError } = await supabase.from('codes').insert(rows)
  if (insertError) {
    throw new Error(`Code insertion failed: ${insertError.message}`)
  }

  // Phase 3: increment participants.code_count by count
  // Note: SELECT + UPDATE is not race-safe under concurrent calls for the same participant,
  // but is acceptable given the low likelihood and the acknowledged trade-off.
  const { data: participantData, error: selectError } = await supabase
    .from('participants')
    .select('code_count')
    .eq('id', participantId)
    .single()

  if (selectError || participantData === null) {
    throw new Error(
      `code_count increment failed — could not read current value: ${selectError?.message ?? 'no data'}`
    )
  }

  const { error: updateError } = await supabase
    .from('participants')
    .update({ code_count: participantData.code_count + count })
    .eq('id', participantId)

  if (updateError) {
    throw new Error(`code_count increment failed — update rejected: ${updateError.message}`)
  }

  return codes
}
