/**
 * Generate signed URLs for receipt images stored in Supabase Storage.
 * Useful for auditing batches of receipts without navigating the Storage UI folder-by-folder.
 *
 * Usage (after "set -a; source .env.local; set +a"):
 *   npx tsx scripts/signed-urls.ts "receipts/abc123/photo.jpg" "receipts/def456/photo.jpg"
 *
 * With custom TTL (default is 8 hours = 28800 seconds):
 *   npx tsx scripts/signed-urls.ts --ttl=3600 \
 *     "receipts/abc123/photo.jpg" \
 *     "receipts/def456/photo.jpg" \
 *     "receipts/ghi789/photo.jpg"
 *
 * Paths must be bucket-relative (e.g. "receipts/folder/file.jpg"), not full HTTPS URLs.
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import { createAdminClient } from '../lib/supabase-admin'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const DEFAULT_TTL_SECONDS = 28800 // 8 hours

const USAGE = `
Usage: npx tsx scripts/signed-urls.ts [--ttl=<seconds>] "<path1>" "<path2>" ...

  Paths must be bucket-relative storage paths (contain "/", no leading "/").
  Example: "receipts/abc123/photo.jpg"

  --ttl=<seconds>   Signed URL TTL in seconds (default: ${DEFAULT_TTL_SECONDS} = 8h)

  Do NOT pass full HTTPS URLs or Supabase storage API paths.
`.trim()

// ── Arg parsing ────────────────────────────────────────────────────────────────

const rawArgs = process.argv.slice(2)
const flagArgs = rawArgs.filter(a => a.startsWith('--'))
const storagePaths = rawArgs.filter(a => !a.startsWith('--'))

if (storagePaths.length === 0) {
  console.error('ERROR: At least one storage path is required.\n')
  console.error(USAGE)
  process.exit(1)
}

// Parse --ttl
let ttlSeconds = DEFAULT_TTL_SECONDS
for (const f of flagArgs) {
  const m = f.match(/^--ttl=(\d+)$/)
  if (m) {
    const parsed = parseInt(m[1], 10)
    if (parsed <= 0) {
      console.error(`ERROR: --ttl must be a positive integer (got: ${m[1]})`)
      process.exit(1)
    }
    ttlSeconds = parsed
  } else if (f.startsWith('--ttl')) {
    console.error(`ERROR: Unrecognized flag "${f}". Use --ttl=<seconds>.`)
    process.exit(1)
  }
}

// ── Path validation ────────────────────────────────────────────────────────────

function validatePath(p: string): string | null {
  // Reject full URLs
  if (p.startsWith('https://') || p.startsWith('http://')) {
    return `Looks like a full URL. Pass the bucket-relative path only (e.g. "receipts/folder/file.jpg"), not the full HTTPS URL.`
  }
  // Reject Supabase storage API paths
  if (p.includes('/storage/')) {
    return `Looks like a Supabase API path. Pass the bucket-relative path only (e.g. "receipts/folder/file.jpg").`
  }
  // Reject leading slash
  if (p.startsWith('/')) {
    return `Path must not start with "/" — use a bucket-relative path like "receipts/folder/file.jpg".`
  }
  // Reject path traversal
  if (p.includes('..')) {
    return `Path must not contain "..".`
  }
  // Must look like folder/filename
  if (!p.includes('/')) {
    return `Path must contain "/" (expected folder/filename shape, e.g. "receipts/folder/file.jpg").`
  }
  return null
}

let validationFailed = false
for (const p of storagePaths) {
  const err = validatePath(p)
  if (err) {
    console.error(`ERROR: Invalid path "${p}": ${err}`)
    validationFailed = true
  }
}
if (validationFailed) process.exit(1)

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const supabase = createAdminClient()

  const ttlDisplay = ttlSeconds === DEFAULT_TTL_SECONDS
    ? `${ttlSeconds}s (8h)`
    : `${ttlSeconds}s`

  console.log(`Generating ${storagePaths.length} signed URL(s) — TTL: ${ttlDisplay}\n`)

  let successCount = 0
  let failCount = 0

  for (let i = 0; i < storagePaths.length; i++) {
    const storagePath = storagePaths[i]

    console.log(`[${i + 1}] ${storagePath}`)

    const { data, error } = await supabase
      .storage
      .from('receipts')
      .createSignedUrl(storagePath, ttlSeconds)

    if (error || !data?.signedUrl) {
      const msg = error?.message ?? 'No URL returned'
      console.log(`    ERROR: ${msg}`)
      failCount++
    } else {
      console.log(`    ${data.signedUrl}`)
      successCount++
    }

    // Blank line between entries for readability
    if (i < storagePaths.length - 1) console.log('')
  }

  console.log('')
  console.log(`Generated ${successCount}/${storagePaths.length} signed URLs (TTL: ${ttlDisplay})`)

  if (failCount > 0) process.exit(1)
}

main().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
