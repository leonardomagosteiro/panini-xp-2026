import * as dotenv from 'dotenv'
import * as path from 'path'
import { createAdminClient } from '../lib/supabase-admin'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

async function main() {
  const supabase = createAdminClient()

  const { data: all, error: fetchError } = await supabase
    .from('receipts')
    .select('id, storage_path, rejection_reason, ai_confidence, amount_on_receipt, cnpj_on_receipt, created_at')
    .eq('status', 'needs_review')
    .range(0, 1499)

  if (fetchError) {
    console.error('Fetch failed:', fetchError)
    process.exit(1)
  }

  if (!all || all.length === 0) {
    console.error('No needs_review receipts found.')
    process.exit(1)
  }

  console.log(`Total needs_review receipts in DB: ${all.length}`)

  const shuffled = [...all].sort(() => Math.random() - 0.5)
  const sample = shuffled.slice(0, 5)

  console.log('\n=== Reality check sample (5 random receipts) ===\n')

  for (let i = 0; i < sample.length; i++) {
    const r = sample[i]
    const { data: signed, error: urlError } = await supabase
      .storage
      .from('receipts')
      .createSignedUrl(r.storage_path, 3600)

    console.log(`--- Receipt ${i + 1} of 5 ---`)
    console.log(`  id:                  ${r.id}`)
    console.log(`  created_at:          ${r.created_at}`)
    console.log(`  rejection_reason:    ${r.rejection_reason ?? '(none)'}`)
    console.log(`  ai_confidence:       ${r.ai_confidence ?? '(none)'}`)
    console.log(`  AI extracted CNPJ:   ${r.cnpj_on_receipt ?? '(null)'}`)
    console.log(`  AI extracted amount: ${r.amount_on_receipt ?? '(null)'}`)
    if (urlError || !signed) {
      console.log(`  URL: ERROR -> ${urlError?.message ?? 'no URL returned'}`)
    } else {
      console.log(`  URL: ${signed.signedUrl}`)
    }
    console.log('')
  }
}

main().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
