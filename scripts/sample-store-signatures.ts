import * as dotenv from 'dotenv'
import * as path from 'path'
import { createAdminClient } from '../lib/supabase-admin'
import { fetchAllRows } from '../lib/paginate-query'
import { extractReceiptTextract } from '../lib/extract-receipt-textract'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const SAMPLE_SIZE = 30

interface ReceiptRow {
  id: string
  storage_path: string
}

async function main() {
  const supabase = createAdminClient()

  console.log('Fetching needs_review receipts with no CNPJ extracted...')
  const all = await fetchAllRows<ReceiptRow>((from, to) =>
    supabase
      .from('receipts')
      .select('id, storage_path')
      .eq('status', 'needs_review')
      .is('cnpj_on_receipt', null)
      .range(from, to)
  )

  console.log(`Found ${all.length} candidates. Sampling ${SAMPLE_SIZE}.\n`)
  const shuffled = [...all].sort(() => Math.random() - 0.5)
  const sample = shuffled.slice(0, SAMPLE_SIZE)

  const results = {
    rescued_bare_cnpj: 0,
    rescued_vendor_name: 0,
    rescued_address: 0,
    not_rescued: 0,
    errors: 0,
  }
  const rescuedIds: { id: string; matchSource: string }[] = []
  const notRescuedIds: { id: string; vendor: string; url: string }[] = []

  for (let i = 0; i < sample.length; i++) {
    const r = sample[i]

    try {
      const { data: blob } = await supabase.storage
        .from('receipts')
        .download(r.storage_path)
      if (!blob) {
        results.errors++
        console.log(`[${i+1}/${sample.length}] ${r.id}  DOWNLOAD FAIL`)
        continue
      }
      const imageBase64 = Buffer.from(await blob.arrayBuffer()).toString('base64')
      const extracted = await extractReceiptTextract(imageBase64, 'image/jpeg')

      const storeMatchMatch = extracted.notes?.match(/store_match=DMCAMP:(\w+)/)
      const matchSource = storeMatchMatch?.[1] ?? null

      if (matchSource === 'bare_cnpj') results.rescued_bare_cnpj++
      else if (matchSource === 'vendor_name') results.rescued_vendor_name++
      else if (matchSource === 'address') results.rescued_address++
      else results.not_rescued++

      if (matchSource) {
        rescuedIds.push({ id: r.id, matchSource })
        console.log(`[${i+1}/${sample.length}] ${r.id}  RESCUED via ${matchSource}`)
      } else {
        const vendorMatch = extracted.notes?.match(/vendor=([^|]+)/)
        const vendor = vendorMatch?.[1]?.trim().substring(0, 50) ?? 'unknown'

        const { data: signed } = await supabase.storage
          .from('receipts')
          .createSignedUrl(r.storage_path, 3600)
        const url = signed?.signedUrl ?? '(no url)'

        notRescuedIds.push({ id: r.id, vendor, url })
        console.log(`[${i+1}/${sample.length}] ${r.id}  not rescued  (vendor: ${vendor})`)
      }
    } catch (err: any) {
      results.errors++
      console.log(`[${i+1}/${sample.length}] ${r.id}  ERROR: ${err.message}`)
    }
  }

  const total = sample.length
  const rescuedTotal = results.rescued_bare_cnpj + results.rescued_vendor_name + results.rescued_address

  console.log('\n========================================')
  console.log('Sample results:')
  console.log('========================================')
  console.log(`  Total sampled:            ${total}`)
  console.log(`  Rescued (bare_cnpj):      ${results.rescued_bare_cnpj}`)
  console.log(`  Rescued (vendor_name):    ${results.rescued_vendor_name}`)
  console.log(`  Rescued (address/CEP):    ${results.rescued_address}`)
  console.log(`  Total rescued:            ${rescuedTotal}  (${(100*rescuedTotal/total).toFixed(1)}%)`)
  console.log(`  Not rescued:              ${results.not_rescued}`)
  console.log(`  Errors:                   ${results.errors}`)
  console.log('')

  if (notRescuedIds.length > 0) {
    console.log('Spot-check URLs for NOT-rescued receipts (verify these are correctly excluded — not DMCAMP):')
    for (const r of notRescuedIds.slice(0, 8)) {
      console.log(`  vendor="${r.vendor}"`)
      console.log(`  ${r.url}`)
      console.log('')
    }
  }
}

main().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
