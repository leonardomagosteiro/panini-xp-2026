# Post-Launch Improvements — AI Receipt Pipeline

This is a running list of items we deliberately deferred during the foundation build (May 7, 2026). Each item was acknowledged and consciously parked to ship faster. None are blockers; all should be revisited within 30 days of going live.

## Validation engine (Component 4)

- **CNPJ null handling in Step 3** — if AI returns `cnpj: null`, validator rejects as `'invalid_cnpj'`. Customer email will say "the CNPJ from the store isn't part of our campaign," which sounds wrong if no CNPJ was extracted at all. In practice, null CNPJ usually means low confidence (already routed to `needs_review` in Step 2), so this rarely fires. Possible fixes: add `'cnpj_missing'` rejection reason, or route null-CNPJ to `needs_review` instead.

## AI extractor (Component 3)

- **Misleading inner error wrapping** — when `response.content[0].type !== 'text'`, the inner error "unexpected response content type from API" gets caught by the outer try/catch and wrapped as "AI extraction failed: unexpected response content type from API". Slightly misleading framing — this is an unexpected response shape, not an extraction failure. Rare edge case.

## Anthropic API setup (Component 2)

- **3 pre-existing npm vulnerabilities** — flagged during `npm install @anthropic-ai/sdk`. Not introduced by the package we added. Should be audited and resolved separately. Do NOT use `npm audit fix --force`.

## Code generation (Component 5)

- **Race condition in `code_count` increment** — Phase 3 of `generateCodesForReceipt` uses SELECT-then-UPDATE pattern, not race-safe under concurrent calls for the same participant. Low risk today (sequential backlog processing) but real risk once auto-processing on uploads goes live and the same participant uploads 2 receipts within seconds. Fix: use Postgres atomic increment via RPC or upsert pattern.

## Email senders (Component 6)

- **Email D doesn't show actual amount** — body says "your receipt is below R$50" without telling the customer their actual amount. Could improve to "your receipt of R${amount} was below R$50..." if customer service starts getting clarification questions.

- **Plain text emails (v1)** — all 7 templates are plain text. Could upgrade to HTML for better visual hierarchy, especially Email A's codes list. Plain text chosen for v1 reliability across email clients.

## Pre-existing items (still open from prior sessions)

- **CPF bypass `123.456.789-09`** — DB row deleted today during cleanup, but the code path that accepted this CPF without DB validation may still be hardcoded somewhere. Needs a code audit.
- **Systemic missing accents** — "Voce", "ja", "esta", "nao", "publico" across multiple pages.
- **Phase 1 brief still says 5 kiosks** — actual is 8.
- **`/confirmacao` page is now orphaned** — works but nothing links to it.
- **38 customers without email on file** — can't be reached until WhatsApp integration is built.
- **No registration confirmation email** — separate from receipt confirmation.

## From this session's process

- **No automated tests for the validation engine** — `validateReceipt` is pure logic, perfect for unit testing. We shipped without tests for speed; should add tests post-launch.
- **No retry logic for transient AI failures** — if Anthropic has a hiccup, the receipt sits in `processing` status forever. Need a retry policy with exponential backoff.
- **CLAUDE.md emoji rule needs clarification** — the "no emojis" rule was written for code/terminal output. Should be updated to allow emojis in customer-facing copy (email bodies, page UI strings) where they render correctly in modern clients.
