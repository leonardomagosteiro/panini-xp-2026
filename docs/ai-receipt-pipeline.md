# AI Receipt Validation Pipeline — Design Document

**Project:** Panini XP 2026
**Status:** Spec finalized May 6, 2026 — ready to build
**Owner:** Leonardo Magosteiro
**Build target:** May 7, 2026 onwards

---

## 1. Purpose

Automate the validation of receipt photos uploaded by customers, generate codes for valid receipts, and notify customers — without manual review for the 90%+ of clear-cut cases. Reserve human review only for AI-flagged ambiguous cases.

## 2. Architecture decisions (locked)

| Decision | Choice | Rationale |
|---|---|---|
| AI provider | Claude (Anthropic API) | Stack consistency, structured outputs |
| Processing model | Async (background) | Customer doesn't wait, AI failures don't block uploads |
| Edge case handling | Hybrid — AI auto-decides clear cases, flags edge cases for human | Maximizes automation while preserving control |
| Code format | Random alphanumeric — `PXP-2026-XXXXX` | Unguessable, scales to millions |
| Amount tolerance | ±R$2 acceptable | Real-world OCR has small variance |
| Reupload allowed after rejection | Yes | Reduces customer friction |

## 3. Business rules (locked)

### Rule 1 — CNPJ must match one of three valid issuers
Valid CNPJs (digits only after normalization):
- `54511074000111`
- `54511074000200`
- `07348198000148`

Normalization: strip everything that isn't a digit, then compare 14-digit strings.

### Rule 2 — Codes calculation
- `codes = floor(amount_in_reais / 50)`
- Examples: R$ 49.99 → 0; R$ 50 → 1; R$ 99 → 1; R$ 100 → 2; R$ 137.50 → 2; R$ 250 → 5

### Rule 3 — One receipt = one approval
Once a receipt is processed (approved OR rejected), the receipt's `status` is locked. No reuse.

### Rule 4 — Receipt date must be in campaign window
- Receipt date ≥ April 30, 2026 AND ≤ today
- Future-dated receipts → reject
- Pre-launch receipts → reject

### Rule 5 — Detect duplicate receipts (cross-CPF fraud detection)
A receipt is a duplicate if any *other* receipt in the database has matching:
- `receipt_number` AND `receipt_date` AND `cnpj_on_receipt`
- Regardless of CPF

If duplicate → reject. Both receipts get flagged. Original keeps its codes; new one is rejected.

### Rule 6 — Amount minimum
- Amount < R$50 → reject (insufficient for any code)

### Rule 7 — AI confidence threshold
- If AI confidence is "high" on all extracted fields → auto-process
- If AI confidence is "medium" or any field is uncertain → flag for human review at `/admin/recibos-revisao`
- If AI cannot extract any meaningful data (blurry, unreadable) → send "please reupload" email

## 4. Database schema changes

### Table: `receipts` — ADD columns
```sql
ALTER TABLE receipts ADD COLUMN receipt_number text;
ALTER TABLE receipts ADD COLUMN receipt_date date;
ALTER TABLE receipts ADD COLUMN ai_processed_at timestamptz;
ALTER TABLE receipts ADD COLUMN ai_confidence text; -- 'high' | 'medium' | 'low' | 'unreadable'
ALTER TABLE receipts ADD COLUMN ai_raw_response jsonb; -- store full AI response for debugging
ALTER TABLE receipts ADD COLUMN reviewed_at timestamptz;
ALTER TABLE receipts ADD COLUMN reviewed_by text; -- email of human reviewer if applicable
ALTER TABLE receipts ADD COLUMN rejection_reason text; -- 'invalid_cnpj' | 'amount_too_low' | 'duplicate' | 'date_out_of_window' | 'unreadable' | 'not_a_receipt' | etc.
```

### Table: `receipts.status` — UPDATE allowed values
- `uploaded` (initial state)
- `processing` (AI is currently working on it)
- `approved` (codes generated)
- `rejected` (with `rejection_reason` populated)
- `needs_review` (AI uncertain, awaiting human)

### Table: `codes` — ENSURE columns exist
```sql
-- These should already exist; verify before building
codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null, -- format: PXP-2026-XXXXX
  participant_id uuid not null references participants(id),
  receipt_id uuid not null references receipts(id),
  created_at timestamptz default now()
);
```

### Index for duplicate detection
```sql
CREATE INDEX receipts_dedupe_idx ON receipts(receipt_number, receipt_date, cnpj_on_receipt);
```

## 5. AI extraction — the prompt design

### Input to Claude
- The receipt image (from Supabase Storage signed URL or base64)
- A system prompt instructing Claude to extract specific fields

### Output format (must be strict JSON)
```json
{
  "is_receipt": true | false,
  "is_readable": true | false,
  "cnpj": "12345678000199" | null,
  "amount_total_brl": 137.50 | null,
  "receipt_number": "012345" | null,
  "receipt_date": "2026-05-03" | null,
  "confidence": "high" | "medium" | "low",
  "notes": "string with any clarifications"
}
```

### Prompt template
```
You are a receipt data extraction system for a Brazilian retail campaign.

Analyze the attached image and extract the following information from the Brazilian fiscal receipt (cupom fiscal / nota fiscal):

1. is_receipt: Is this image actually a Brazilian retail receipt? (true/false)
2. is_readable: Can you read enough of the receipt to extract data? (true/false)
3. cnpj: The merchant's CNPJ as a string of digits only (no dots, slashes, or dashes). Return null if not visible.
4. amount_total_brl: The TOTAL amount paid, as a decimal number (e.g., 137.50). Return null if not visible.
5. receipt_number: The receipt or coupon number (often labeled "COO", "CCF", "NF", or similar). Return null if not visible.
6. receipt_date: The date the receipt was issued, in ISO format YYYY-MM-DD. Return null if not visible.
7. confidence: Your confidence in the extraction:
   - "high": all fields clearly visible and unambiguous
   - "medium": some fields unclear or partially obscured
   - "low": significant uncertainty in one or more fields
8. notes: Any observations about quality, readability, or anomalies

Respond ONLY with a valid JSON object matching the schema above. Do not include any other text, explanation, or markdown formatting.
```

### Claude API call configuration
- Model: `claude-sonnet-4-5-20250929` (or current Sonnet — Sonnet is cost-effective for vision OCR)
- Max tokens: 1024
- Temperature: 0 (deterministic output for structured extraction)

## 6. Validation logic flow

After AI extracts the data, run these checks in order:

```
1. is_receipt === false
   → status: rejected, reason: 'not_a_receipt'
   → email: rejection-not-a-receipt

2. is_readable === false OR confidence === 'low'
   → status: needs_review (flag for human)
   → email: please-reupload

3. cnpj NOT IN [54511074000111, 54511074000200, 07348198000148]
   → status: rejected, reason: 'invalid_cnpj'
   → email: rejection-wrong-store

4. amount_total_brl IS NULL OR amount_total_brl < 50
   → status: rejected, reason: 'amount_too_low'
   → email: rejection-amount-too-low

5. receipt_date < '2026-04-30' OR receipt_date > today
   → status: rejected, reason: 'date_out_of_window'
   → email: rejection-date

6. duplicate detected (matching receipt_number + receipt_date + cnpj in DB)
   → status: rejected, reason: 'duplicate'
   → email: rejection-duplicate

7. confidence === 'medium'
   → status: needs_review (flag for human)
   → email: NONE (wait for human review)

8. All checks pass and confidence === 'high'
   → status: approved
   → calculate codes = floor(amount_total_brl / 50)
   → generate N unique codes, insert into codes table
   → email: approved-with-codes
```

## 7. Code generation

### Format
`PXP-2026-XXXXX` where XXXXX = 5 random alphanumeric uppercase characters

### Character set
Full alphanumeric: `ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789` (36 chars)

### Uniqueness strategy
- Generate code → query `codes` table for existence → if exists, regenerate
- Loop until unique (collision probability is astronomically low at 36^5 = 60 million combinations)
- Hard limit: 10 retries, then log error and abort that single code generation

### Insertion
All N codes for one receipt must be inserted in a single DB transaction. If insert fails partway, roll back and mark receipt as `needs_review`.

## 8. Email templates

### Email A — Approved with codes
**Subject:** `Seus códigos chegaram — Panini XP`

```
Olá, {nickname}!

Seu recibo enviado em {receipt_date} foi aprovado! Você ganhou {N} código(s) para o sorteio da Copa do Mundo 2026:

{LIST_OF_CODES}

Guarde este email com cuidado. Os códigos serão usados no sorteio dos prêmios.

Quer mais chances? Envie outro recibo:
👉 https://app.paninixp.com.br/enviar-recibo

Boa sorte!

Equipe Panini XP
```

### Email B — Rejection: not a receipt
**Subject:** `Não conseguimos processar seu envio — Panini XP`

```
Olá, {nickname}!

Recebemos seu envio, mas não conseguimos identificar uma nota fiscal válida na imagem.

Por favor, envie uma foto clara do seu cupom fiscal ou nota fiscal de compra:
👉 https://app.paninixp.com.br/enviar-recibo

Equipe Panini XP
```

### Email C — Rejection: wrong store / invalid CNPJ
**Subject:** `Recibo não elegível — Panini XP`

```
Olá, {nickname}!

Seu recibo foi recebido, mas o CNPJ da loja não está entre os participantes desta campanha.

A campanha Panini XP é válida apenas para compras realizadas nas Unidades Panini XP Participantes.

Você pode enviar um novo recibo de uma loja participante:
👉 https://app.paninixp.com.br/enviar-recibo

Equipe Panini XP
```

### Email D — Rejection: amount too low
**Subject:** `Recibo recebido, mas abaixo do valor mínimo — Panini XP`

```
Olá, {nickname}!

Seu recibo foi recebido, mas o valor total está abaixo de R$50, que é o mínimo para gerar um código.

A regra é: a cada R$50 em compras, você ganha 1 código no sorteio.

Continue acumulando! Você pode enviar mais recibos a qualquer momento:
👉 https://app.paninixp.com.br/enviar-recibo

Equipe Panini XP
```

### Email E — Rejection: date out of window
**Subject:** `Recibo fora do período da campanha — Panini XP`

```
Olá, {nickname}!

Seu recibo foi recebido, mas a data não está dentro do período válido da campanha.

A campanha Panini XP é válida para compras realizadas a partir de 30/04/2026.

Envie um recibo dentro do período:
👉 https://app.paninixp.com.br/enviar-recibo

Equipe Panini XP
```

### Email F — Rejection: duplicate
**Subject:** `Recibo já registrado — Panini XP`

```
Olá, {nickname}!

Recebemos seu envio, mas este recibo já foi registrado anteriormente em nossa campanha. Cada recibo só pode ser usado uma única vez.

Envie um novo recibo de outra compra:
👉 https://app.paninixp.com.br/enviar-recibo

Equipe Panini XP
```

### Email G — Please reupload (unreadable)
**Subject:** `Não conseguimos ler seu recibo — Panini XP`

```
Olá, {nickname}!

Recebemos seu recibo, mas a imagem não está clara o suficiente para identificarmos as informações.

Por favor, tire uma nova foto do recibo com:
- Boa iluminação
- Recibo plano (sem dobras)
- Foco nítido
- Enquadramento completo (todo o recibo na foto)

Envie a nova foto aqui:
👉 https://app.paninixp.com.br/enviar-recibo

Equipe Panini XP
```

### Email common settings (all)
- From: `Panini XP <copa2026@paninixp.com.br>`
- Reply-To: `campinas@paninixp.com.br`
- All sent via existing Resend integration

## 9. Components to build (the build order)

### Component 1 — Schema migration
- Add columns to `receipts` table
- Update allowed `status` values
- Add duplicate detection index
- Update `schema.sql` and commit

### Component 2 — Anthropic API setup
- Sign up for Anthropic API (or confirm Leonardo's existing account)
- Create API key
- Add `ANTHROPIC_API_KEY` to `.env.local` and Vercel
- Install `@anthropic-ai/sdk` package

### Component 3 — Library: AI receipt extractor
**File:** `lib/extract-receipt.ts`
- Function `extractReceipt(imageUrl_or_base64): Promise<ExtractedData>`
- Internally: signed URL from Storage → API call to Claude → JSON parse → validation
- Returns the strict JSON schema or throws on malformed AI response

### Component 4 — Library: Validation engine
**File:** `lib/validate-receipt.ts`
- Function `validateReceipt(extracted, db): Promise<ValidationResult>`
- Runs the 8-step validation flow
- Returns `{ status: 'approved' | 'rejected' | 'needs_review', reason?, codes_to_generate? }`

### Component 5 — Library: Code generation
**File:** `lib/generate-codes.ts`
- Function `generateCodesForReceipt(receipt_id, participant_id, count): Promise<string[]>`
- Atomic insert of N unique codes
- Returns array of generated code strings

### Component 6 — Library: Email senders for receipt outcomes
**File:** `lib/send-receipt-emails.ts`
- One function per template (A through G)
- Uses existing Resend client pattern
- Logs failures via `logError`

### Component 7 — Backlog processor script
**File:** `scripts/process-receipts-backlog.ts`
- Fetches all receipts where `status = 'uploaded'`
- For each, runs the full pipeline (extract → validate → generate codes if approved → send email)
- Throttled to respect API rate limits (Anthropic + Resend)
- Logs progress, supports `--dry-run`, supports `--limit N` for batch testing
- This is what processes the 320 backlog

### Component 8 — Admin review page (for `needs_review` receipts only)
**File:** `app/admin/recibos-revisao/page.tsx`
- Password-protected (env var `ADMIN_PASSWORD`)
- Shows only receipts with `status = 'needs_review'`
- Displays photo + AI's extracted data + reason for flagging
- Buttons: Approve (with editable amount), Reject (with reason dropdown), Skip
- On approve/reject: triggers same code generation + email pipeline

### Component 9 — Auto-trigger for new uploads (last)
**File:** Modify `app/api/upload-recibo/route.ts`
- After successful receipt insert, **enqueue** processing
- Simplest implementation today: fire-and-forget call to a processing function (no queue infrastructure)
- Future-proof: could be replaced with a real queue (Vercel Cron, Inngest, etc.)

## 10. Build order priority (for tomorrow)

**Day 1 (tomorrow):**
1. Component 1 — Schema migration
2. Component 2 — Anthropic API setup
3. Component 3 — AI extractor (test on 5 sample receipts manually)
4. Component 4 — Validation engine (unit-testable, build with care)
5. Component 5 — Code generation
6. Component 6 — Email senders

**Day 2 (or end of day 1 if going strong):**
7. Component 7 — Backlog processor → run on 5 receipts → review → run on 320
8. Component 8 — Admin review page (for whatever the backlog flagged)
9. Component 9 — Wire into upload API for ongoing automation

## 11. Risk register

| Risk | Mitigation |
|---|---|
| AI hallucinates fields not on receipt | Strict JSON schema, low temperature, validation engine double-checks ranges |
| AI misreads CNPJ digit (e.g., 0 vs O) | CNPJ normalization strips non-digits; only matches against the 3 known valid CNPJs |
| AI returns malformed JSON | Wrap parse in try/catch, mark receipt as `needs_review` on parse failure |
| Duplicate code generated (collision) | Retry up to 10x with new random; log + abort if all 10 collide |
| Anthropic API down/slow | Backlog script retries with backoff; ongoing trigger queues for retry |
| Rate limit hit | Throttle backlog processor; Anthropic handles per-account limits |
| Customer disputes a rejection | `ai_raw_response` jsonb field preserves full AI output for audit |
| Bad receipt photo causes loop | If AI returns same outcome 2x for same receipt, don't keep trying — flag |

## 12. Testing strategy

### Before processing the 320 backlog
- Pick 5 representative receipts from production manually (good photo, blurry, wrong store, low amount, suspicious)
- Run the AI extractor on each in isolation
- Verify the JSON output matches your visual inspection
- Adjust prompt if needed

### Limited backlog test
- Run processor with `--limit 10`
- Inspect results: which approved, which rejected, which flagged?
- Spot-check 2-3 emails customers received

### Full backlog
- Run on all 320
- Monitor in real-time
- Be ready to pause if patterns of bad results emerge

## 13. Out of scope (for now)

- WhatsApp notifications for email-less customers
- Retroactive email for the 38 customers with no email on file
- Public ranking integration of new codes (already in place via `code_count` column?)
- Sweepstakes draw mechanism
- Code redemption tracking
- The CPF bypass (`123.456.789-09`) cleanup — still pending from May 2

---

## Appendix A — Decisions log

| # | Decision | Choice | Date |
|---|---|---|---|
| 1 | AI provider | Claude (Anthropic API) | 2026-05-06 |
| 2 | Processing model | Async background | 2026-05-06 |
| 3 | Edge case handling | Hybrid AI+human | 2026-05-06 |
| 4 | Amount tolerance | ±R$2 | 2026-05-06 |
| 5 | Reupload after rejection | Allowed | 2026-05-06 |
| 6 | Code format | Random alphanumeric `PXP-2026-XXXXX` | 2026-05-06 |

## Appendix B — Pre-build checklist

Before starting Component 1 tomorrow, confirm:

- [ ] Anthropic API account created
- [ ] Claude Code is on Sonnet 4.6
- [ ] CLAUDE.md updated to reflect AI receipt pipeline as the active build
- [ ] Working tree clean (`git status`)
- [ ] This document committed to repo at `docs/ai-receipt-pipeline.md`
- [ ] You're rested and have 4-6 hours of focused time available

---

*End of spec.*
