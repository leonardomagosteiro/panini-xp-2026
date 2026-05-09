import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'OPENAI_API_KEY',
] as const

const missing = REQUIRED_ENV_VARS.filter(v => !process.env[v])
if (missing.length > 0) {
  console.error(`Missing required env vars: ${missing.join(', ')}. Check your .env.local file.`)
  process.exit(1)
}

import type { ImageMimeType } from '../lib/extract-receipt'

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

async function main(): Promise<void> {
  const { createAdminClient } = await import('../lib/supabase-admin')
  const { extractReceiptOpenAI } = await import('../lib/extract-receipt-openai')

  const supabase = createAdminClient()

  console.log('========== OpenAI Extractor Test ==========')
  console.log('Mode: READ-ONLY — no database writes')
  console.log('Finding most recent uploaded receipt...\n')

  // Step 1 — Find most recent uploaded receipt
  const { data: receipt, error: fetchError } = await supabase
    .from('receipts')
    .select('id, storage_path, participant_id, created_at')
    .eq('status', 'uploaded')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (fetchError || receipt === null) {
    console.error('No uploaded receipt found or fetch failed:', fetchError?.message ?? 'no data')
    process.exit(1)
  }

  console.log(`Receipt ID:    ${receipt.id}`)
  console.log(`Storage path:  ${receipt.storage_path}`)
  console.log(`Created at:    ${receipt.created_at}`)
  console.log('')

  // Step 2 — Detect mime type from file extension
  const mimeType = getMimeType(receipt.storage_path)
  if (mimeType === null) {
    console.error(`Cannot determine mime type for: ${receipt.storage_path}`)
    process.exit(1)
  }
  console.log(`Mime type:     ${mimeType}`)

  // Step 3 — Download image from Supabase Storage
  console.log('Downloading image from Supabase Storage...')
  const { data: imageData, error: downloadError } = await supabase.storage
    .from('receipts')
    .download(receipt.storage_path)

  if (downloadError || imageData === null) {
    console.error('Image download failed:', downloadError?.message ?? 'no data')
    process.exit(1)
  }

  const arrayBuffer = await imageData.arrayBuffer()
  const imageBase64 = Buffer.from(arrayBuffer).toString('base64')

  console.log(`Image size:    ${(imageBase64.length / 1024).toFixed(1)} KB (base64)`)
  console.log('')

  // Step 4 — Call OpenAI extractor directly
  console.log('Calling extractReceiptOpenAI...')
  const extracted = await extractReceiptOpenAI(imageBase64, mimeType)

  console.log('\n========== Extraction Result ==========')
  console.log(JSON.stringify(extracted, null, 2))
  console.log('=======================================')
  console.log('\nDone. Nothing written to the database.')
}

main().catch(err => {
  console.error('\nUnexpected error:')
  console.error(err instanceof Error ? err.stack : String(err))
  process.exit(1)
})
