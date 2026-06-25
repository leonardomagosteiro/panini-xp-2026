import * as dotenv from 'dotenv'
import * as path from 'path'
import { createAdminClient } from '../lib/supabase-admin'
import { fetchAllRows } from '../lib/paginate-query'
import { extractReceiptTextract } from '../lib/extract-receipt-textract'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const SAMPLE_SIZE = 50

interface ReceiptRow {
  id: string
  storage_path: string
}

interface SampleResult {
  id: string
  storage_path: string
  outcome: 'auto_approve' | 'needs_review' | 'awaiting_reupload' | 'error'
  amount: number | null
  cnpj: string | null
  receipt_date: string | null
  total_confidence_pct: string
  cnpj_confidence_pct: string
  date_confidence_pct: string
  confidence_class: string
  store_match: string | null
  computed_codes: number | null
  signed_url: string
}

async function main() {
  const supabase = createAdminClient()

  console.log('Fetching all needs_review receipts (sample source)...')
  const all = await fetchAllRows<ReceiptRow>((from, to) =>
    supabase
      .from('receipts')
      .select('id, storage_path')
      .eq('status', 'needs_review')
      .range(from, to)
  )
  console.log(`Found ${all.length} needs_review receipts. Sampling ${SAMPLE_SIZE}.\n`)

  const shuffled = [...all].sort(() => Math.random() - 0.5)
  const sample = shuffled.slice(0, SAMPLE_SIZE)

  const results: SampleResult[] = []
  for (let i = 0; i < sample.length; i++) {
    const r = sample[i]
    process.stdout.write(`[${i+1}/${sample.length}] ${r.id}  `)

    try {
      const { data: blob } = await supabase.storage.from('receipts').download(r.storage_path)
      if (!blob) {
        console.log('DOWNLOAD FAIL')
        continue
      }
      const imageBase64 = Buffer.from(await blob.arrayBuffer()).toString('base64')
      const extracted = await extractReceiptTextract(imageBase64, 'image/jpeg')

      const { data: signed } = await supabase.storage.from('receipts').createSignedUrl(r.storage_path, 3600)
      const url = signed?.signedUrl ?? ''

      const notes = extracted.notes ?? ''
      const totalConfMatch = notes.match(/total=[^|]*\(([\d.]+)%\)/)
      const cnpjConfMatch = notes.match(/cnpj=[^|]*\(([\d.]+)%\)/)
      const dateConfMatch = notes.match(/date=[^|]*\(([\d.]+)%\)/)
      const storeMatchMatch = notes.match(/store_match=(\S+)/)

      let outcome: SampleResult['outcome']
      if (extracted.confidence === 'high') outcome = 'auto_approve'
      else if (!extracted.is_receipt) outcome = 'awaiting_reupload'
      else outcome = 'needs_review'

      const computedCodes =
        extracted.amount_total_brl !== null && extracted.amount_total_brl >= 50
          ? Math.floor(extracted.amount_total_brl / 50)
          : null

      results.push({
        id: r.id,
        storage_path: r.storage_path,
        outcome,
        amount: extracted.amount_total_brl,
        cnpj: extracted.cnpj,
        receipt_date: extracted.receipt_date,
        total_confidence_pct: totalConfMatch?.[1] ?? '-',
        cnpj_confidence_pct: cnpjConfMatch?.[1] ?? '-',
        date_confidence_pct: dateConfMatch?.[1] ?? '-',
        confidence_class: extracted.confidence,
        store_match: storeMatchMatch?.[1] ?? null,
        computed_codes: computedCodes,
        signed_url: url,
      })

      console.log(`${outcome}  (R${extracted.amount_total_brl ?? '?'}, cnpj=${extracted.cnpj ?? 'null'}, conf=${extracted.confidence})`)
    } catch (err: any) {
      console.log(`ERROR: ${err.message}`)
    }
  }

  const buckets: Record<string, number> = {}
  for (const r of results) buckets[r.outcome] = (buckets[r.outcome] ?? 0) + 1

  console.log('\n=========================================')
  console.log('Predicted outcome distribution:')
  console.log('=========================================')
  for (const [k, v] of Object.entries(buckets).sort((a, b) => b[1] - a[1])) {
    const pct = (100 * v / results.length).toFixed(1)
    console.log(`  ${v.toString().padStart(4)}  ${k.padEnd(20)} ${pct}%`)
  }

  const autoApprove = results.filter(r => r.outcome === 'auto_approve')
  if (autoApprove.length > 0) {
    console.log('\n=========================================')
    console.log(`AUTO-APPROVE candidates (${autoApprove.length}) — spot-check 10:`)
    console.log('=========================================')
    const spotCheck = autoApprove.slice(0, 10)
    for (const r of spotCheck) {
      console.log('')
      console.log(`  ID:       ${r.id}`)
      console.log(`  Amount:   R${r.amount}  (Textract conf: ${r.total_confidence_pct}%)`)
      console.log(`  CNPJ:     ${r.cnpj}  (conf: ${r.cnpj_confidence_pct}%)`)
      console.log(`  Date:     ${r.receipt_date}  (conf: ${r.date_confidence_pct}%)`)
      console.log(`  Codes:    ${r.computed_codes}`)
      console.log(`  Store:    ${r.store_match ?? 'regex match'}`)
      console.log(`  Image:    ${r.signed_url}`)
    }
  }
}

main().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
