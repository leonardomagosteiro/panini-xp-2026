import * as dotenv from 'dotenv'
import * as path from 'path'
import { createAdminClient } from '../lib/supabase-admin'
import { fetchAllRows } from '../lib/paginate-query'
import { TextractClient, AnalyzeExpenseCommand } from '@aws-sdk/client-textract'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const SAMPLE_SIZE = 5

interface ReceiptRow {
  id: string
  storage_path: string
  cnpj_on_receipt: string | null
  amount_on_receipt: number | null
}

async function main() {
  const supabase = createAdminClient()

  console.log('Fetching needs_review receipts where Textract did NOT extract a CNPJ...')
  const all = await fetchAllRows<ReceiptRow>((from, to) =>
    supabase
      .from('receipts')
      .select('id, storage_path, cnpj_on_receipt, amount_on_receipt')
      .eq('status', 'needs_review')
      .is('cnpj_on_receipt', null)
      .range(from, to)
  )
  console.log(`Found ${all.length} needs_review receipts with no CNPJ extracted.`)

  const shuffled = [...all].sort(() => Math.random() - 0.5)
  const sample = shuffled.slice(0, SAMPLE_SIZE)
  console.log(`Sampling ${sample.length} of them.\n`)

  const textract = new TextractClient({
    region: process.env.AWS_REGION!,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  })

  for (let i = 0; i < sample.length; i++) {
    const r = sample[i]
    console.log(`============================================================`)
    console.log(`Receipt ${i + 1} of ${sample.length}: ${r.id}`)
    console.log(`============================================================`)

    const { data: signed } = await supabase.storage
      .from('receipts')
      .createSignedUrl(r.storage_path, 3600)
    if (signed) console.log(`URL: ${signed.signedUrl}\n`)

    const { data: blob, error: dlError } = await supabase.storage
      .from('receipts')
      .download(r.storage_path)
    if (dlError || !blob) {
      console.log(`Download failed: ${dlError?.message}\n`)
      continue
    }
    const bytes = new Uint8Array(await blob.arrayBuffer())

    try {
      const response = await textract.send(
        new AnalyzeExpenseCommand({ Document: { Bytes: bytes } })
      )
      const doc = response.ExpenseDocuments?.[0]
      if (!doc) {
        console.log('No ExpenseDocuments returned.\n')
        continue
      }

      console.log('--- SummaryFields ---')
      for (const f of doc.SummaryFields ?? []) {
        const type = f.Type?.Text ?? '?'
        const value = f.ValueDetection?.Text ?? '?'
        const conf = f.ValueDetection?.Confidence?.toFixed(1) ?? '?'
        const label = f.LabelDetection?.Text
        console.log(`  ${type.padEnd(22)} -> "${value}"   (${conf}%)${label ? `  [label: "${label}"]` : ''}`)
      }

      console.log('\n--- LineItemGroups ---')
      const groups = doc.LineItemGroups ?? []
      if (groups.length === 0) {
        console.log('  (none)')
      } else {
        for (let g = 0; g < groups.length; g++) {
          console.log(`  Group ${g + 1}:`)
          const items = groups[g].LineItems ?? []
          for (let li = 0; li < items.length; li++) {
            console.log(`    Item ${li + 1}:`)
            for (const f of items[li].LineItemExpenseFields ?? []) {
              const type = f.Type?.Text ?? '?'
              const value = f.ValueDetection?.Text ?? '?'
              console.log(`      ${type.padEnd(20)} -> "${value}"`)
            }
          }
        }
      }
      console.log('')
    } catch (err: any) {
      console.log(`Textract error: ${err.message}\n`)
    }
  }
}

main().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
