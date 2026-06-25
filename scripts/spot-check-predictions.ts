import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'
import { createAdminClient } from '../lib/supabase-admin'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const RESULTS_FILE = path.resolve(__dirname, '../predict-backlog-results.json')
const TARGET_STATUS = process.argv[2] ?? 'awaiting_reupload'
const SAMPLE_SIZE = parseInt(process.argv[3] ?? '5', 10)

interface PerReceiptResult {
  id: string
  predicted_status: string
  predicted_reason: string | null
  textract_amount: number | null
  textract_cnpj: string | null
  textract_date: string | null
  textract_confidence: 'high' | 'medium' | 'low' | null
}

async function main() {
  if (!fs.existsSync(RESULTS_FILE)) {
    console.error(`Results file not found: ${RESULTS_FILE}`)
    process.exit(1)
  }

  const state = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf-8'))
  const allResults = Object.values(state.results) as PerReceiptResult[]

  const matching = allResults.filter(r => r.predicted_status === TARGET_STATUS)
  console.log(`Total processed in JSON: ${allResults.length}`)
  console.log(`Predicted ${TARGET_STATUS}: ${matching.length} (${((matching.length / allResults.length) * 100).toFixed(1)}%)`)
  console.log('')

  if (matching.length === 0) {
    console.log('No matching receipts. Exiting.')
    return
  }

  const shuffled = [...matching].sort(() => Math.random() - 0.5)
  const sample = shuffled.slice(0, SAMPLE_SIZE)

  const supabase = createAdminClient()

  for (let i = 0; i < sample.length; i++) {
    const r = sample[i]
    const { data: rec } = await supabase
      .from('receipts')
      .select('storage_path')
      .eq('id', r.id)
      .single()

    if (!rec) continue

    const { data: signed } = await supabase
      .storage.from('receipts').createSignedUrl(rec.storage_path, 3600)

    console.log(`--- Receipt ${i + 1} of ${sample.length} ---`)
    console.log(`  id:                ${r.id}`)
    console.log(`  predicted_status:  ${r.predicted_status}`)
    console.log(`  predicted_reason:  ${r.predicted_reason}`)
    console.log(`  textract_amount:   ${r.textract_amount ?? '(null)'}`)
    console.log(`  textract_cnpj:     ${r.textract_cnpj ?? '(null)'}`)
    console.log(`  textract_date:     ${r.textract_date ?? '(null)'}`)
    console.log(`  textract_conf:     ${r.textract_confidence ?? '(null)'}`)
    if (signed) console.log(`  URL: ${signed.signedUrl}`)
    console.log('')
  }
}

main().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
