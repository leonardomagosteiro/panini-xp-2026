import * as dotenv from 'dotenv'
import * as path from 'path'
import { createAdminClient } from '../lib/supabase-admin'
import { extractReceiptTextract } from '../lib/extract-receipt-textract'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const TEST_RECEIPTS = [
  { id: 'be32ad5a-32f5-4f98-a855-5567d28ae147', expected: 'DMCAMP', note: 'DMCAMP with bare CNPJ in OTHER field' },
  { id: 'ded87275-d7a4-4439-bab0-0f4b923c2218', expected: null, note: 'LOJAS RENNER (correctly excluded)' },
  { id: '6044b325-d0a1-40ee-bb13-d0a5a082d8d1', expected: 'DMCAMP', note: 'FORCARD-mislabeled DMCAMP, rescued by address' },
  { id: '75602f92-9139-4404-8746-79ad259d414a', expected: null, note: 'APRE PRODUTO, no DMCAMP signal' },
  { id: '38560e32-1520-4a1c-ab1e-9fd4d65c0197', expected: 'DMCAMP', note: 'DMCAMP, address + bare CNPJ both visible' },
]

async function main() {
  const supabase = createAdminClient()

  console.log('Testing store signature matcher on 5 inspected receipts.\n')

  for (const t of TEST_RECEIPTS) {
    console.log(`====================================================`)
    console.log(`Receipt: ${t.id}`)
    console.log(`Note:    ${t.note}`)
    console.log(`Expected: ${t.expected ?? 'no match'}`)

    // Get storage_path
    const { data: receipt } = await supabase
      .from('receipts')
      .select('storage_path')
      .eq('id', t.id)
      .single()
    if (!receipt) {
      console.log(`Result:  RECEIPT NOT FOUND\n`)
      continue
    }

    // Download image
    const { data: blob } = await supabase.storage
      .from('receipts')
      .download(receipt.storage_path)
    if (!blob) {
      console.log(`Result:  DOWNLOAD FAILED\n`)
      continue
    }
    const imageBase64 = Buffer.from(await blob.arrayBuffer()).toString('base64')

    // Run extractor
    const extracted = await extractReceiptTextract(imageBase64, 'image/jpeg')

    const cnpjMatched = extracted.cnpj !== null
    const passed = cnpjMatched === (t.expected !== null)

    console.log(`Got:     cnpj=${extracted.cnpj ?? 'null'}, confidence=${extracted.confidence}`)
    console.log(`Notes:   ${extracted.notes ?? '(none)'}`)
    console.log(`Result:  ${passed ? 'PASS' : 'FAIL'}`)
    console.log('')
  }
}

main().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
