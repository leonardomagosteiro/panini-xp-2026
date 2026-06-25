import { PostgrestFilterBuilder } from '@supabase/postgrest-js'

/**
 * Fetches all rows from a Supabase query, paginating past the PostgREST
 * max-rows cap (default 1000). Use this whenever a query might return
 * more than 1000 rows.
 *
 * Usage:
 *   const rows = await fetchAllRows((from, to) =>
 *     supabase.from('receipts').select('id, status').eq('status', 'needs_review').range(from, to)
 *   )
 *
 * The query factory must return a fresh query each call — Supabase query
 * builders are not reusable.
 */
export async function fetchAllRows<T>(
  queryFactory: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
  batchSize = 1000
): Promise<T[]> {
  const all: T[] = []
  let from = 0

  while (true) {
    const to = from + batchSize - 1
    const { data, error } = await queryFactory(from, to)

    if (error) {
      throw new Error(`Pagination failed at range ${from}-${to}: ${error.message ?? error}`)
    }

    if (!data || data.length === 0) {
      break
    }

    all.push(...data)

    if (data.length < batchSize) {
      break
    }

    from += batchSize
  }

  return all
}
