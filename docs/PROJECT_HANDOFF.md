# Panini XP 2026 — Living Project Handoff

**Last updated:** Wednesday, June 24, 2026, end of day Brazil time
**Status:** Live. Production stable May 10 – June 23 (operational only, no shipped code). One feature shipped June 24 (fuzzy CNPJ match) — see Section 5.

---

## 1. How to use this document

This is a **living document**. It is the single source of truth for project state across sessions.

**Rules:**
- At the start of every Claude.ai or Claude Code session: read this file first.
- At the end of every working session: update this file with progress, decisions, errors solved, and new outstanding items.
- After any meaningful decision (architectural, business, or process): update the relevant section immediately.
- Never let it go stale. A stale handoff is worse than none — it lies.

---

## 2. Who I am and how I work

**Leonardo Magosteiro** — Brazilian entrepreneur in Santa Rosa de Viterbo, São Paulo, Brazil. Not a developer. Learning vibe coding as a business tool.

**How I want to be worked with:**
- All conversations in English
- I want a coach, not just an executor — push back, hold me to discipline, don't let me skip steps
- One step at a time
- Test before commit, commit before moving on
- Verify, never assume
- Use the cheapest tool for the task (Terminal for inspection, Claude Code for code, Claude.ai for thinking)
- Plan before build — write specs before opening Claude Code
- Update this handoff at session end, always

---

## 3. What this project is

**Panini XP 2026** — a promotional campaign platform for Panini Point Experience. They sell official FIFA World Cup 2026 sticker albums and packs across **2 permanent stores and 8 kiosks** in Brazilian shopping malls.

**Customer flow:** Register at point of sale via QR code → upload nota fiscal → receive sweepstakes codes (1 code per R\$50 spent, format `PXP-2026-XXXXX`).

**Sales went live:** April 30, 2026. Platform is in production, processing receipts in real time.

---

## 4. Current architecture (live in production)

- **Lovable** → `paninixp.com.br` — public landing page
- **Next.js on Vercel** → `app.paninixp.com.br` — application
  - `/cadastro` — customer registration
  - `/enviar-recibo` — receipt upload
  - `/admin/recibos-revisao` — password-protected admin review queue
  - `/ranking`, `/confirmacao`, `/privacidade` — supporting pages
- **Supabase** (São Paulo region) — database, storage, RLS-enabled
- **OpenAI API (gpt-4o)** — current AI extraction provider (live since May 9)
- **Resend** — transactional email (paid tier)

QR codes printed at kiosks point to `paninixp.com.br`.

---

## 5. Full project history

### Pre-launch (March – April 30)
Phase 1 build: registration, ranking, code generation logic. Landing page migrated from Unicorn Platform to Lovable on April 30. Subdomain `app.paninixp.com.br` set up on Vercel. Receipts table + Storage bucket + error_logs table created.

### May 1–2 — Phase 2 receipt upload base
Heading polish. Receipt upload page live, no AI yet. Email reminder + post-upload confirmation.

### May 6 — AI pipeline spec written
`docs/ai-receipt-pipeline.md` — full design with 8-rule validation, prompt design, email templates.

### May 7 — AI pipeline foundation built (~36 hours of work)
Schema migration → Claude extractor → 8-rule validator → atomic code generator → 7 email senders → orchestrator → backlog processor → admin review page (888 lines, 4 API routes) → auto-trigger on upload via Vercel `waitUntil` → mandatory email at signup. Bug fixes: 5MB base64 threshold, no-email/oversized/unprocessable routing, PostgREST embedded join shape.

### May 8 — Production response
- 166 customers got rejection-recovery emails (script committed)
- OCR-dependent rejections routed to `needs_review` (commit `42c672f`)
- Photo guidance section on upload page (commit `319515e`)
- Client-side image resize (browser-image-compression, ≥2MB → max 4MB JPEG at 1920px, HEIC handled)

### May 9 — OpenAI integration + customer communication shipped
- OpenAI gpt-4o + Structured Outputs went live in production
- Email H (re-upload request) + Email I (manual review notice) + 7-day cron + first/second strike detection
- Pre-check 0 expanded to fire on null CNPJ
- Upload confirmation email removed (audit revealed it contradicted downstream emails)
- 3 Phase 1 blast scripts archived to scripts/_archived/
- `awaiting_reupload` status added to receipts.status CHECK constraint (silent production incident: Claude Code said "no migration needed" — wrong, the CHECK blocked every write)
- `manual_review_email_sent_at` column added as idempotency guard for Email I
- Auto-reject scope reduced: only `is_receipt=false` at high confidence; other rejection reasons route to `needs_review`
- Branded HTML emails ship with Panini XP logo (table-based layout, inline styles, plain-text preserved)
- Lesson: files in `public/` must be both renamed AND git-add'ed before referencing in deployed code

### May 10 – June 23 — Operational only
No code shipped. Platform stable in production. Manual review of `needs_review` queue ongoing.

### June 24 — Fuzzy CNPJ rescue + OCR provider question raised

**Context:** First active session since May 9. Goal was a system health check before any new feature work. Health check surfaced a much larger needs_review queue than the May 9 handoff anticipated.

**System health check findings:**
- Receipts by status (true counts via `Prefer: count=exact`): approved 682, rejected 80, needs_review **1,320**, awaiting_reupload 1, uploaded 6, processing 0. Total 2,089.
- needs_review composition: invalid_cnpj 623 (47%), low_confidence 332 (25%), date_out_of_window 94 (7%), amount_too_low 14 (1%), not_a_receipt 4 (<1%), uncategorized/legacy 253 (19%).
- The OpenAI switch (May 9) did **not** resolve the OCR-on-thermal-receipt reliability problem — only changed the failure shape.

**Shipped: fuzzy CNPJ matcher.**
- `lib/cnpj-match.ts` — standalone helper, Levenshtein distance ≤ 2 against any of the 3 valid CNPJs (DMCAMP + EBANCAS matriz/filial). 21 unit tests in `lib/cnpj-match.test.ts`.
- `lib/validate-receipt.ts` — Step 3 changed from exact-match Set lookup to `isLikelyValidCnpj()`. Inline VALID_CNPJS Set removed.
- Commit `3523557`. Deploy `B7Aqgr6Jh` live at `app.paninixp.com.br`.

**Backlog rescue performed:**
- `scripts/filter-invalid-cnpj-rescuable.ts` (read-only) — computed Levenshtein for all 623 invalid_cnpj receipts. Output 273 rescue candidates (148 at distance 1, 125 at distance 2) to `/tmp/rescue-candidates-2026-06-24.json`.
- `scripts/reset-rescue-candidates.ts` — backed up state to `/tmp/pre-reset-backup-2026-06-24.json`, then reset 273 receipts to status=uploaded with AI fields nulled. Safety check: aborts if backup row count ≠ candidate count.
- `scripts/process-receipts-backlog.ts` ran twice: wave 1 (10 receipts) for verification, wave 2 (269 receipts) for the full pass.

**Backlog rescue results (combined waves 1+2, 279 receipts processed):**
- 91 approved → codes generated + approval emails sent
- 2 rejected (duplicates)
- 178 routed to other needs_review buckets (composition shifted from `invalid_cnpj` toward `low_confidence` and `incomplete_extraction`)
- 5 routed to awaiting_reupload (incl. Rissi — the backlog processor's switch statement does not print `awaiting_reupload` outcomes)
- 3 errors: 1 OpenAI 400 (unsupported image format — possibly HEIC slipping past resize), 1 missing participant row (referential integrity), 1 OpenAI malformed JSON
- ~33% approval rate

**Post-rescue DB state:** uploaded 3, processing 0, approved **774**, rejected 82, needs_review **1,229**, awaiting_reupload 3. Net: -91 from needs_review, +92 to approved.

**Strategic finding — the OCR provider is the bottleneck, not just CNPJ matching.** Even with the fuzzy matcher rescuing receipts past Step 3, ~67% still hit a different validator gate. The same receipt can produce different extraction outcomes on different runs. Switching from Anthropic to OpenAI did not solve this. A purpose-built receipt OCR (AWS Textract `AnalyzeExpense`) is the candidate fix.

**Deadline pressure:** June 30 prize draw announcement requires the participant base to be emailed June 26. needs_review queue of 1,229 must be cleared or substantially reduced before then.

---

## 6. Phase 2 commits

| Hash | Date | Subject |
|---|---|---|
| 3523557 | 2026-06-24 | feat(validator): fuzzy CNPJ match (distance <= 2) for receipt validation |
| df8133f | 2026-05-08 | feat(upload): mention auto-resize in photo guidance section |
| 7dafe11 | 2026-05-08 | feat(upload): integrate client-side resize into receipt upload flow |
| c0da895 | 2026-05-08 | feat(upload): add browser-image-compression dependency and resize helper |
| d018c7c | 2026-05-08 | docs: client-side image resize spec |
| 319515e | 2026-05-08 | feat(upload): add photo guidance section with good/bad example images |
| 42c672f | 2026-05-08 | feat(validator): route OCR-dependent rejections to needs_review while AI extraction is unreliable |
| 8ec31c3 | 2026-05-08 | feat(ops): add rejection-recovery email blast script (used May 7 for 166 customers) |
| b6010ea | 2026-05-07 | docs: capture May 7 outstanding items and learnings |
| 0090b92 | 2026-05-07 | feat(ai): auto-trigger processReceipt after upload using Vercel waitUntil |
| 96042ea | 2026-05-07 | feat(admin): add password-protected receipt review page for needs_review queue |
| 44ccd09 | 2026-05-07 | feat(cadastro): make email mandatory at signup |
| 5da1fbd | 2026-05-07 | fix(ai): correct base64 size threshold to 5MB and broaden error regex |
| 05df9e3 | 2026-05-07 | fix(ai): route no-email, oversized-image, and unprocessable-image to needs_review instead of error |
| fc24f20 | 2026-05-07 | fix(backlog): correct embedded join type — PostgREST returns object not array for many-to-one |
| f176ec4 | 2026-05-07 | feat(ai): add backlog processor script with dry-run, rate limiting, and auto-stop safeguards |
| 5bdadf3 | 2026-05-07 | feat(ai): add single-receipt orchestrator with end-to-end validation |
| a6eb825 | 2026-05-07 | docs: add post-launch improvements list from foundation build |
| 4d6151e | 2026-05-07 | feat(ai): add 7 receipt outcome email senders (approved + 6 rejection variants) |
| c2b45f7 | 2026-05-07 | feat(ai): add atomic code generation with uniqueness retry |
| 5d2f0c4 | 2026-05-07 | feat(ai): add receipt validation engine with 8-step rule flow |
| ac59298 | 2026-05-07 | feat(ai): add Claude-based receipt extractor |
| a9ae14e | 2026-05-07 | feat(db): add AI receipt validation columns and dedupe index |
| 876bca5 | 2026-05-06 | docs: add AI receipt pipeline spec |
| d4e5dca | 2026-05-06 | feat: add one-time catch-up script for pre-launch receipt uploads |
| 947afe6 | 2026-05-02 | feat: add one-time reminder blast script for receipt upload |
| e7b1b0a | 2026-05-02 | feat: send email confirmation after receipt upload |
| 43831ea | 2026-05-01 | fix: change PRE-CADASTRO heading to CADASTRO |

---

## 7. What's working in production

- Customer registration with mandatory email (LGPD-compliant, CPF-deduplicated)
- Receipt upload with photo guidance (good/bad example images)
- Client-side image resize before upload (handles oversized photos + HEIC transparently)
- Auto-triggered AI processing on upload (Vercel `waitUntil`)
- 8-rule validation (CNPJ match, amount min, date window, duplicate detection)
- Fuzzy CNPJ matching at distance ≤ 2 against the 3 valid CNPJs (handles OCR transposition / substitution errors)
- Code generation in `PXP-2026-XXXXX` format, atomic with uniqueness retry
- 7 outcome emails (1 approval + 6 rejection variants), branded HTML + plain text
- 7-day re-upload cron + first/second strike detection
- Admin review queue at `/admin/recibos-revisao` (password-protected)
- Backlog processor available for catch-up runs

---

## 8. What's broken or fragile

### Critical — active production issue

**AI extraction unreliable across both providers tried.** May 7 (Anthropic) showed 60% false-rejection rate on CNPJ. May 9 switched to OpenAI gpt-4o. June 24 health check confirms OpenAI has similar reliability problems — different failure shape, similar customer impact.

**Observed OpenAI failure modes:**
- Wrong CNPJ digits with high confidence (not low-conf, just wrong)
- Dropped digits — receipts coming back with 12-13 digit CNPJ strings
- Null amounts on legible receipts (high confidence, but `amount_total_brl` returned null)
- Inconsistency: same receipt produces different extractions on different runs

**Mitigations in place (not fixes):**
- May 8 — OCR-dependent rejections route to `needs_review` (commit `42c672f`)
- May 8 — photo guidance on upload page (commit `319515e`)
- June 24 — fuzzy CNPJ matching at distance ≤ 2 (commit `3523557`)

**Real fix candidates (June 24 analysis):**
- Purpose-built receipt OCR APIs (AWS Textract AnalyzeExpense, Google Document AI, Azure Document Intelligence) likely outperform general LLMs on structured field extraction from receipts.
- AWS Textract identified as primary candidate.
- Evaluation deferred to June 25 morning session — see Section 16.

### Outstanding customer commitments

- **needs_review queue: 1,229 receipts** (down from 1,320 pre-rescue). Must clear before June 26 to enable prize announcement email.
- **awaiting_reupload queue: 3 receipts** — 7-day cron sends re-upload requests; customers can re-submit.
- **166-customer recovery promise from May 7** — substantially fulfilled by June 24 rescue. Recipients whose receipts got rescued got an approval email; remainder are in the 1,229 needs_review queue.
- **38 customers** without email on file — still unreachable, still queued for WhatsApp integration.

---

## 9. Decisions made and why

| # | Decision | Choice | Date | Rationale |
|---|---|---|---|---|
| 1 | AI provider (initial) | Claude (Anthropic) | 2026-05-06 | Stack consistency, structured outputs |
| 2 | Processing model | Async background via Vercel `waitUntil` | 2026-05-06 | Customer doesn't wait |
| 3 | Edge case handling | Hybrid AI + human review queue | 2026-05-06 | Maximize automation, preserve control |
| 4 | Amount tolerance | ±R\$2 | 2026-05-06 | Real-world OCR variance |
| 5 | Reupload after rejection | Allowed | 2026-05-06 | Reduces customer friction |
| 6 | Code format | `PXP-2026-XXXXX` random alphanumeric | 2026-05-06 | Unguessable, scales |
| 7 | Email mandatory at signup | Yes | 2026-05-07 | Required for AI pipeline notifications |
| 8 | Base64 size threshold | 5MB on string length, not raw bytes | 2026-05-07 | Verified empirically |
| 9 | Resend tier | Upgraded free → paid | 2026-05-07 | Hit 100/day limit during heavy traffic |
| 10 | Email format | Plain text v1 | 2026-05-07 | Reliability across email clients |
| 11 | Code generation race-safety | SELECT-then-UPDATE for now | 2026-05-07 | Acceptable in low-concurrency mode |
| 12 | Route OCR-dependent rejections to needs_review | Yes | 2026-05-08 | While AI is unreliable |
| 13 | Photo guidance on upload | Yes | 2026-05-08 | Surfaced from manual review observations |
| 14 | AI provider going forward | Switch from Claude to OpenAI | 2026-05-08 | Based on 60% false-rejection finding |
| 15 | Image size handling | Client-side resize before upload | 2026-05-08 | Active session work |
| 16 | Living handoff document | Update PROJECT_HANDOFF.md every session | 2026-05-08 | Prevent context-loss recovery problems |
| 17 | OpenAI integration shipped to production | Live with gpt-4o + Structured Outputs, kill-switch via env var | 2026-05-09 | Verified end-to-end with real receipt before launch |
| 18 | Phase 2 re-upload flow + customer communication shipped | Email H + Email I + 7-day cron + first/second strike detection | 2026-05-09 | Cuts manual review load + customer transparency |
| 19 | Pre-check 0 expanded to fire on null CNPJ | Customers get Email H asking for re-upload when CNPJ is unreadable | 2026-05-09 | Real test showed null CNPJ wasn't reaching the re-upload branch |
| 20 | Upload confirmation email removed | Only state-change emails fire | 2026-05-09 | Audit revealed it contradicted downstream emails |
| 21 | Three Phase 1 blast scripts archived | scripts/_archived/ with README; tsconfig.json excludes the directory | 2026-05-09 | Landmines (no idempotency, contradictions); preserved git history |
| 22 | Schema changes require explicit DB constraint verification | When adding a new enum-like status value, always inspect CHECK constraints in Supabase before shipping | 2026-05-09 | Production incident: 5 receipts stuck, 3 customers got Email H but no DB update |
| 23 | Resolve scripts use cached ai_raw_response (no fresh OpenAI calls) | resolve-stuck-receipts.ts and apply-not-a-receipt-rejection.ts replay validation against stored ai_raw_response | 2026-05-09 | Recovery operations should be cheap and predictable |
| 24 | Email I duplicate prevention via manual_review_email_sent_at | Dedicated TIMESTAMPTZ column as idempotency guard | 2026-05-09 | Without the guard, every reanalysis re-sent Email I |
| 25 | Auto-reject scope: only is_receipt=false at confidence=high | Other rejection reasons still route to needs_review | 2026-05-09 | Safety-first: wrong auto-rejection hurts real customers |
| 26 | Email B copy: single message for both auto-rejection and admin manual rejection | Rewritten with full receipt field list, QR-only warning, finality tone | 2026-05-09 | Audit finding: same email fired from two paths, must work for both |
| 27 | Orchestrator hardening — error handling on all DB writes | All 10 call sites in process-receipt.ts now capture errors and return before downstream side effects | 2026-05-09 | Closes the loop on production incident class |
| 28 | All customer emails ship branded HTML versions with Panini XP logo | buildEmailHtml() + ctaButton() helpers; logo at https://app.paninixp.com.br/logo-panini-xp.png | 2026-05-09 | Brand consistency across customer touchpoints |
| 29 | Files in public/ must be both renamed AND git-add'ed before referencing | Always run git status after public/ changes | 2026-05-09 | Production briefly had broken logo references |
| 30 | Fuzzy CNPJ match at distance ≤ 2 | Levenshtein-based match against any of the 3 valid CNPJs. Helper isolated in lib/cnpj-match.ts with 21 unit tests. Step 7 (medium confidence gate) untouched | 2026-06-24 | Absorbs the most common OCR errors (single substitution, transposition) without admitting genuinely different CNPJs. Distance ≤ 3 considered but rejected as too permissive |
| 31 | Surgical-scope backlog reprocess | Reset only the 273 invalid_cnpj receipts at distance ≤ 2; did not reprocess the rest of needs_review or the rejected pile | 2026-06-24 | Reprocessing receipts the validator change can't help burns OpenAI tokens for no outcome change. AI inconsistency means reprocessing clean duplicates could produce different extractions |
| 32 | OCR provider evaluation: deferred to June 25 morning | 30-min reality check (open 5 random failed JPEGs) decides fork: if readable, AWS Textract; if not, manual review | 2026-06-24 | Switching providers costs 3-4h integration + risk; if photos are the bottleneck, switching doesn't help |

---

## 10. Errors encountered and how solved

- **AI 5MB limit error.** Anthropic vision limit is on base64 string length, not raw bytes. Fix: corrected threshold and broadened error regex (`5da1fbd`).
- **Backlog processor join shape mismatch.** PostgREST returns object, not array, for many-to-one. Fix: corrected type, verified with curl (`fc24f20`).
- **Resend rate limit hit.** Free tier capped at 100/day. Fix: upgraded mid-day.
- **AI errors on no-email/oversized/unprocessable.** Fix: routed all three to `needs_review` (`05df9e3`).
- **CNPJ misread (the big one).** Mitigated via routing to needs_review (`42c672f`) and fuzzy match (`3523557`). Not fully solved — OCR provider evaluation pending.
- **Supabase project paused (April 30).** Caused "Erro ao buscar CPF". Fix: upgraded plan.
- **awaiting_reupload CHECK constraint missing (May 9).** Production incident: receipts stuck, customers got Email H but no DB update. Fix: ALTER TABLE + verify in Supabase SQL editor before code ships.
- **June 24 batch processor errors (3 of 269):** 1 unsupported image format (HEIC slipping past resize?), 1 missing participant referential integrity, 1 OpenAI malformed JSON. Investigation queued.

---

## 11. Current database structure

**Table: `participants`** — customer registrations
id, nickname, full_name, cpf, whatsapp, email (mandatory), amount_spent, code_count, store_origin, lgpd_consent, created_at

**Table: `receipts`** — uploaded receipt records
id, participant_id (FK), cpf, image_path, status (uploaded | processing | approved | rejected | needs_review | awaiting_reupload), receipt_number, receipt_date, ai_processed_at, ai_confidence, ai_raw_response (jsonb), reviewed_at, reviewed_by, rejection_reason, cnpj_on_receipt, amount_total_brl, reupload_request_sent_at, manual_review_email_sent_at.
Dedupe index on (receipt_number, receipt_date, cnpj_on_receipt).

**Table: `codes`** — generated sweepstakes codes
id, code (unique, PXP-2026-XXXXX), participant_id (FK), receipt_id (FK), created_at

**Table: `error_logs`** — operational error monitoring
id, source, error_message, error_details (jsonb), created_at

All tables have RLS enabled. **Storage bucket:** `receipts` (private).

**Schema drift note:** schema.sql in repo is known to be out of sync with live DB (missing awaiting_reupload in CHECK, missing reupload_request_sent_at + manual_review_email_sent_at columns). Reconciliation queued.

---

## 12. Public vs private data (LGPD)

- **PUBLIC** (visible in `/ranking`): nickname, code_count
- **PRIVATE** (never exposed): full_name, cpf, whatsapp, email, amount_spent

---

## 13. Business constants

- Valid CNPJs: `07348198000148` (DMCAMP), `54511074000111` (EBANCAS matriz), `54511074000200` (EBANCAS filial)
- Code generation: `floor(amount_in_reais / 50)`
- Code format: `PXP-2026-XXXXX`
- Campaign window: April 30, 2026 onward

---

## 14. Environment and credentials

- **Supabase project:** `qtreydrmiiqomuatdtmx` (São Paulo region)
- **GitHub:** `github.com/leonardomagosteiro/panini-xp-2026`
- **Vercel:** `app.paninixp.com.br`
- **Lovable:** `paninixp.com.br`
- **Working directory:** `/Users/leonardomagosteiro/Desktop/Vibe Coding Projects/panini-xp-2026`
- **Machine:** MacBook Air M1, macOS 15.5
- **Claude Code:** 2.1.72 on Sonnet 4.6

**Environment variables in use:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY` (legacy — still required by some scripts, even though OpenAI is the live provider)
- `OPENAI_API_KEY`
- `RESEND_API_KEY`
- `ADMIN_PASSWORD` (currently hardcoded as `panini2026` — flagged for env var migration)

Values stored in Apple Notes "Panini XP — Project Keys".

---

## 15. Last commit and branch state

- **Last commit:** `3523557` — feat(validator): fuzzy CNPJ match (distance <= 2) for receipt validation (June 24)
- **Working tree:** clean (handoff update pending commit), all feature commits pushed to `origin/main`
- **Vercel deploy:** B7Aqgr6Jh — live, status Ready, 1m 1s build, 1 non-blocking warning (uuid@10 deprecation transitive dependency)

---

## 16. The exact next step (next session — June 25 morning)

**Goal:** clear the needs_review queue substantially before June 26 (deadline: participant email announcing the June 30 prize draw).

**30-minute reality check first:**
1. Pull 5 random failed receipts from the current needs_review queue (mix of low_confidence, incomplete_extraction, date_out_of_window, awaiting_reupload buckets).
2. Open each JPEG. Are they readable by a human in ~2 seconds?
3. Decide the fork:
   - **If 4/5 readable → Textract fork.** OpenAI is fumbling on legible receipts; purpose-built OCR will likely take approval rate from ~33% to ~70-80%. Worth integrating.
   - **If 3/5 unreadable → Manual fork.** Photos are the bottleneck; switching AI providers won't help. Go straight to manual review.

**Textract fork (if chosen):** AWS account setup → `@aws-sdk/client-textract` install → `lib/extract-receipt-textract.ts` mirrors the OpenAI extractor signature → swap import in `process-receipt.ts` → local tests → deploy → reprocess backlog through new extractor (~45 min) → manual review on the ~250-350 receipts Textract can't auto-approve.

**Manual fork (if chosen):** Sort `/admin/recibos-revisao` by review_reason for batching. Aim for 20-30 seconds per receipt. 1,229 receipts at 25s = ~8.5 hours.

**Hard cutoff:** if Textract integration isn't complete by lunch, abandon for the deadline and switch to manual review for the afternoon. No sunk-cost arguments.

**Deferred (out of scope until after June 30):**
- API key rotation (4 keys)
- ADMIN_PASSWORD env var migration
- schema.sql sync (drift confirmed)
- Old @anthropic-ai/sdk package removal
- uuid@10 deprecation warning
- Fix process-receipts-backlog.ts switch to print awaiting_reupload outcomes
- Co-Authored-By: Claude trailer in commit c9e0d56 (May 9) — pact violation, decision pending
- 3 OpenAI errors from June 24 wave 2: HEIC/unsupported image, missing participant row, malformed JSON

---

## 17. Suggested checkpoint

**June 25 morning, before any code work:** After the 30-minute reality check, write down the fork decision (Textract or Manual) and reasoning in one sentence. Forces a deliberate choice instead of drifting into Textract because it's interesting.

**If Textract fork — hard checkpoint at lunch:** Is integration complete and tested locally? If no, switch to manual review for the afternoon. No negotiation.

**If manual fork — soft checkpoint every 2 hours:** Review pace, quality consistency, fatigue level. Adjust batching or break before quality drops.
