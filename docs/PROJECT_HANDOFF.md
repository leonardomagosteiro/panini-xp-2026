# Panini XP 2026 — Living Project Handoff

**Last updated:** Saturday, May 9, 2026, late evening Brazil time
**Status:** Rebuilt after Claude.ai chat context limit hit. Supersedes all prior handoffs.

---

## 1. How to use this document

This is a **living document**. It is the single source of truth for project state across sessions.

**Rules:**
- At the start of every Claude.ai or Claude Code session: read this file first.
- At the end of every working session: update this file with progress, decisions, errors solved, and new outstanding items.
- After any meaningful decision (architectural, business, or process): update the relevant section immediately.
- Never let it go stale. A stale handoff is worse than none — it lies.

**Why this exists:** Claude.ai chats hit context window limits and become unusable. When that happens, all conversational memory is lost. This file is what makes recovery possible — it carries state across sessions, machines, and tools.

---

## 2. Who I am and how I work

**Leonardo Magosteiro** — Brazilian entrepreneur in Santa Rosa de Viterbo, São Paulo, Brazil. Not a developer. Learning vibe coding as a business tool.

**How I want to be worked with:**
- All conversations in English
- I want a coach, not just an executor — push back, hold me to discipline, don't let me skip steps
- Operating principles I've adopted (enforce them with me):
  - One step at a time
  - Test before commit, commit before moving on
  - Verify, never assume
  - Use the cheapest tool for the task (Terminal for inspection, Claude Code for code, Claude.ai for thinking)
  - Plan before build — write specs before opening Claude Code
  - Update this handoff at session end, always

---

## 3. What this project is

**Panini XP 2026** — a promotional campaign platform for Panini Point Experience. They sell official FIFA World Cup 2026 sticker albums and packs across **2 permanent stores and 8 kiosks** in Brazilian shopping malls.

**Customer flow:** Register at point of sale via QR code → upload nota fiscal → receive sweepstakes codes (1 code per R$50 spent, format `PXP-2026-XXXXX`).

**Sales went live:** April 30, 2026. Platform is in production, processing receipts in real time.

*Note: prior brief said 5 kiosks; actual is 8.*

---

## 4. Current architecture (live in production)

- **Lovable** → `paninixp.com.br` — public landing page (migrated from Unicorn Platform on April 30)
- **Next.js on Vercel** → `app.paninixp.com.br` — application
  - `/cadastro` — customer registration
  - `/enviar-recibo` — receipt upload
  - `/admin/recibos-revisao` — password-protected admin review queue
  - `/ranking`, `/confirmacao`, `/privacidade` — supporting pages
- **Supabase** (São Paulo region) — database, storage, RLS-enabled
- **Anthropic API (Claude Sonnet)** — current AI extraction provider
- **Resend** — transactional email (paid tier as of May 7)
- **OpenAI API** — decided next AI provider, integration paused (their service is down today)

QR codes printed at kiosks point to `paninixp.com.br`.

---

## 5. Full project history

### Pre-launch (March – April 30)
- **March:** Phase 1 build — registration, ranking, code generation logic. Initial landing page on Unicorn Platform.
- **April 30 (launch day):** Migrated landing page from Unicorn Platform to Lovable. Set up `app.paninixp.com.br` subdomain on Vercel. Fixed "Erro ao buscar CPF" caused by paused Supabase project (upgraded plan). Replaced logo with transparent-background version. Updated CLAUDE.md to Phase 2 scope. Created `receipts` table and Storage bucket. Created `error_logs` table.

### May 1 — Phase 2 receipt upload base
Heading polish (PRE-CADASTRO → CADASTRO). Sales had launched the day before. Receipt upload page live but no AI yet.

### May 2 — Operational scripts
Email blast reminder for receipt upload. Email confirmation after upload.

### May 6 — AI pipeline spec written
Wrote `docs/ai-receipt-pipeline.md` — full design with locked decisions, 8-rule validation, prompt design, email templates, build order, risk register, testing strategy. Wrote one-time catch-up script for pre-launch receipts.

### May 7 — AI pipeline foundation built (~36 hours of work)
In order: schema migration → Claude extractor → 8-rule validator → atomic code generator → 7 email senders → orchestrator → backlog processor → admin review page (888 lines, 4 API routes) → auto-trigger on upload via Vercel `waitUntil` → mandatory email at signup. Bug fixes: 5MB base64 threshold, no-email/oversized/unprocessable routing, PostgREST embedded join shape. Wrote `docs/post-launch-improvements.md`.

### May 8 (today) — Production response
- Sent rejection-recovery emails to **166 customers** (script committed today)
- Routed more OCR-dependent rejection categories to `needs_review` (AI accuracy patch)
- Added photo guidance section on upload page with good/bad example images (discovered via manual review that customers were photographing only the QR code)

---

## 6. Phase 2 commits (May 1 onward)

| Hash | Date | Subject |
|---|---|---|
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
- Client-side image resize before upload: files >= 2MB compressed to max 4MB JPEG at 1920px — handles oversized photos and HEIC (iPhone format) transparently. Built with `browser-image-compression`.
- Auto-triggered AI processing on upload (Vercel `waitUntil`)
- 8-rule validation (CNPJ match, amount min, date window, duplicate detection)
- Code generation in `PXP-2026-XXXXX` format, atomic with uniqueness retry
- 7 outcome emails (1 approval + 6 rejection variants)
- Admin review queue at `/admin/recibos-revisao` (password-protected)
- Backlog processor available for catch-up runs

---

## 8. What's broken or fragile

### Critical — active production issue

**AI extraction unreliable on CNPJ.** 60% false-rejection rate observed May 7 in `invalid_cnpj` category. AI misreading digits on receipts where CNPJ is clearly visible (example: receipt id `e1dff659` — Tata's receipt).

**Mitigations in place (not fixes):**
- Commit `42c672f` (May 8) routes OCR-dependent rejections to `needs_review` instead of auto-rejecting
- Commit `319515e` (May 8) added photo guidance after manual review revealed QR-code-only photos

**Real fix:** Switch to OpenAI (decided May 8, paused awaiting their service stability)

### Discovered and fixed (May 8)

**Customer photos exceeding 5MB base64 threshold.** Fixed by client-side resize before upload (commits `c0da895`, `7dafe11`, `df8133f`). Photos >= 2MB are now compressed to max 4MB JPEG at 1920px before leaving the device. HEIC handled transparently.

### Outstanding customer commitments

- **166 customers** received recovery emails May 7 promising manual review — receipts not yet reprocessed
- **198 rejected receipts** may have been false-rejected (CNPJ accuracy issue) — awaiting reprocessing once OpenAI is wired up
- **122 receipts** in `needs_review` queue — Leonardo is manually reviewing right now in parallel
- **38 customers** without email on file (pre-mandatory-email signups) — can't be reached until WhatsApp integration is built

---

## 9. Decisions made and why

| # | Decision | Choice | Date | Rationale |
|---|---|---|---|---|
| 1 | AI provider (initial) | Claude (Anthropic) | 2026-05-06 | Stack consistency, structured outputs |
| 2 | Processing model | Async background via Vercel `waitUntil` | 2026-05-06 | Customer doesn't wait |
| 3 | Edge case handling | Hybrid AI + human review queue | 2026-05-06 | Maximize automation, preserve control |
| 4 | Amount tolerance | ±R$2 | 2026-05-06 | Real-world OCR variance |
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
| 15 | OpenAI integration timing | Paused | 2026-05-08 | OpenAI service issues today |
| 16 | Image size handling | Build client-side resize before upload | 2026-05-08 | Active session work |
| 17 | Living handoff document | Update PROJECT_HANDOFF.md every session | 2026-05-08 | Prevent context-loss recovery problems |
| 18 | OpenAI integration shipped to production | Live with gpt-4o + Structured Outputs, kill-switch via env var | 2026-05-09 | Verified end-to-end with real receipt before launch |
| 19 | Phase 2 — re-upload flow + customer communication shipped | Email H + Email I + 7-day cron + first/second strike detection live in production | 2026-05-09 | Cuts down manual review load + customer transparency |
| 20 | Pre-check 0 expanded to fire on null CNPJ | Customers get Email H asking for re-upload when CNPJ is unreadable, instead of silent manual review | 2026-05-09 | Real test showed medium-confidence + null CNPJ wasn't reaching the re-upload branch |
| 21 | Upload confirmation email removed entirely | No email at upload time — only state-change emails fire | 2026-05-09 | Audit revealed it contradicted downstream emails. Principle: email = real news. |
| 22 | Three Phase 1 blast scripts archived | scripts/_archived/ with README; tsconfig.json excludes the directory | 2026-05-09 | Landmines (no idempotency, contradictions); preserved git history |
| 23 | Email communication audit completed | docs/email-communication-audit.md is the single source of truth on email touchpoints | 2026-05-09 | Surfaced 10 issues; addressed HIGH severity today; rest queued |
| 24 | Schema changes require explicit DB constraint verification | When adding a new enum-like status value, always inspect CHECK constraints in Supabase before shipping. Claude Code earlier said "no migration needed" for awaiting_reupload — wrong. The CHECK constraint blocked every write silently. Future process: ALTER TABLE + verify in Supabase SQL editor before code ships. | 2026-05-09 | Production incident: 5 receipts stuck, 3 customers got Email H but no DB update |
| 25 | Resolve scripts use cached ai_raw_response (no fresh OpenAI calls) | resolve-stuck-receipts.ts and apply-not-a-receipt-rejection.ts both replay validation logic against stored ai_raw_response rather than re-calling OpenAI. Ensures deterministic, reproducible outcomes; avoids cost and variance on recovery operations. | 2026-05-09 | Principle: recovery operations should be cheap and predictable |
| 26 | Email I duplicate prevention via manual_review_email_sent_at | Added receipts.manual_review_email_sent_at TIMESTAMPTZ. sendManualReviewEmailOnce() helper in process-receipt.ts checks the column before sending and writes it after. Pattern: fire-once emails use a dedicated timestamp column as an idempotency guard. | 2026-05-09 | Without the guard, every reanalysis run re-sent Email I to already-notified customers |
| 27 | Auto-reject scope: only is_receipt=false at confidence=high | Other rejection reasons (invalid_cnpj, amount_too_low, date_out_of_window) still route to needs_review. Each requires individual safety analysis before auto-rejection can be trusted. Only is_receipt=false at high confidence is unambiguous enough to act on without human review. | 2026-05-09 | Safety-first: wrong auto-rejection hurts real customers |
| 28 | Email B copy: single message for both auto-rejection and admin manual rejection | Rewritten with full receipt field list, QR-only warning, finality tone. Works for both contexts because it focuses on what the customer must do next, not what decision was made. Finality tone (Nao foi possivel processar) distinguishes from Email H (hopeful, same receipt). | 2026-05-09 | Audit finding: same email fired from two paths, must work for both |

---

## 10. Errors encountered and how solved

- **AI 5MB limit error.** Anthropic vision limit is 5MB on the base64-encoded string, not raw bytes. Fix: corrected threshold and broadened error regex (`5da1fbd`).
- **Backlog processor join shape mismatch.** PostgREST returns object, not array, for many-to-one embedded relations. TypeScript inference unreliable. Fix: corrected type, verified with curl (`fc24f20`). **Lesson:** verify Supabase JS embedded relation shapes empirically.
- **Resend rate limit hit.** Free tier capped at 100/day. Fix: upgraded mid-day.
- **AI errors on no-email/oversized/unprocessable.** Pipeline treated as fatal. Fix: routed all three to `needs_review` (`05df9e3`).
- **CNPJ misread (the big one).** Claude vision misreading digits. Fix in progress: switching to OpenAI. Mitigation: route to `needs_review` (`42c672f`).
- **Supabase project paused (April 30).** Caused "Erro ao buscar CPF". Fix: upgraded plan, restored service.

---

## 11. Current database structure

**Table: `participants`** — customer registrations
- id, nickname, full_name, cpf, whatsapp, email (mandatory as of May 7), amount_spent, code_count, store_origin, lgpd_consent, created_at

**Table: `receipts`** — uploaded receipt records
- id, participant_id (FK), cpf, image_path
- status: `uploaded` | `processing` | `approved` | `rejected` | `needs_review` | `awaiting_reupload`
- `receipts_status_check` CHECK constraint includes all 6 values above (constraint fix applied May 9 evening — `awaiting_reupload` was missing, causing a silent production incident)
- AI columns (May 7): receipt_number, receipt_date, ai_processed_at, ai_confidence, ai_raw_response (jsonb), reviewed_at, reviewed_by, rejection_reason, cnpj_on_receipt, amount_total_brl
- reupload_request_sent_at TIMESTAMPTZ (May 9) — tracks first/second strike detection
- manual_review_email_sent_at TIMESTAMPTZ (May 9) — guards Email I against duplicate sends
- Dedupe index on (receipt_number, receipt_date, cnpj_on_receipt)

**Table: `codes`** — generated sweepstakes codes
- id, code (unique, format `PXP-2026-XXXXX`), participant_id (FK), receipt_id (FK), created_at

**Table: `error_logs`** — operational error monitoring
- id, source, error_message, error_details (jsonb), created_at

All tables have RLS enabled. **Storage bucket:** `receipts` (private, image MIME types only).

---

## 12. Public vs private data (LGPD)

- **PUBLIC** (visible in `/ranking`): nickname, code_count
- **PRIVATE** (never exposed in any public query or API): full_name, cpf, whatsapp, email, amount_spent

---

## 13. Business constants

- Valid CNPJs (digits only): `54511074000111`, `54511074000200`, `07348198000148`
- DMCAMP CNPJ: `07.348.198/0001-48`
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
- `ANTHROPIC_API_KEY`
- `RESEND_API_KEY`
- `ADMIN_PASSWORD` (currently hardcoded as `panini2026` — flagged for env var migration)
- *Future:* `OPENAI_API_KEY` (not yet added)

Values stored in Apple Notes "Panini XP — Project Keys".

---

## 15. Last commit and branch state

- **Last commit:** `df8133f` — feat(upload): mention auto-resize in photo guidance section (May 8)
- **Working tree:** clean (handoff update pending commit), all feature commits pushed to `origin/main`
- **No uncommitted work** (except this handoff)

---

## 16. The exact next step (this session)

**Client-side image resize — DONE.** Spec written (`docs/image-resize-spec.md`), implemented, tested (pending Leonardo's manual test on real phone), and pushed.

**Next:** OpenAI integration. Resume when their API stabilizes. Decision is final; only timing depends on their service.

**In parallel:** Leonardo continues manual review of `needs_review` queue at `/admin/recibos-revisao`.

---

## 17. Suggested checkpoint

**Before handing the resize spec to Claude Code:** re-read it as if a stranger to the project. Confirm all failure modes covered. Confirm testing strategy section exists.

**After Claude Code implements:** test on real oversized image, HEIC iPhone image, and small image. Commit only after all three pass.

**At session end:** update this handoff. Mark image resize as done. Add new outstanding items. Push.

---

## 18. Open questions and outstanding items

- Reprocessing 198 rejected receipts: order — backlog first or new uploads first?
- 166 customers: bulk reprocess or personalized email?
- `CLAUDE.md` update: must reflect AI pipeline scope this session — currently describes pre-AI Phase 2 only
- `schema.sql` sync: confirm May 7 migrations captured everything in production
- Race condition in `code_count` increment — risk with concurrent uploads from same participant. Fix: Postgres atomic increment via RPC.
- CPF bypass `123.456.789-09` — DB row deleted but code path may still be hardcoded. Needs audit.
- 38 customers without email — blocked on WhatsApp integration
- No automated tests for validation engine — pure logic, perfect for unit testing. Add post-launch.
- No retry logic for transient AI failures — receipt sits in `processing` forever. Need exponential backoff.
- `ADMIN_PASSWORD` migration to env var
- Systemic missing accents across pages (Voce, ja, esta, nao, publico)
- `/confirmacao` page is now orphaned (works but nothing links to it)
- No registration confirmation email (separate from receipt confirmation)
- Phase 1 brief still says 5 kiosks — actual is 8
- Test 2 (second-strike detection) — built but never verified end-to-end
- Dead imports in process-receipt.ts (Issue 4 from audit) — cleanup (sendReceiptRejectedNotReceipt is now wired; remaining dead imports: sendReceiptRejectedInvalidCnpj, sendReceiptRejectedAmountTooLow, sendReceiptRejectedDateOutOfWindow, sendReceiptPleaseReupload)
- Issues 8-10 from audit — low severity, future cleanup
- Orchestrator silent error swallowing pattern — DB write errors in non-awaiting_reupload paths are still discarded (no error check on update result). Risk: any future schema mismatch, RLS policy change, or DB anomaly would cause silent failures identical to the May 9 constraint incident. Fix: add error handling to all DB writes in process-receipt.ts.
- 244 needs_review receipts still in queue — require manual processing or additional auto-reject rules. apply-not-a-receipt-rejection.ts dry-run found 0 matches — existing queue has no high-confidence is_receipt=false cases.
- 63 awaiting_reupload receipts will silently transition to needs_review after 7-day timeout cron if no customer re-upload — expected and by design, but worth monitoring.
- schema.sql sync verification — CHECK constraint fix (awaiting_reupload added) was applied directly in Supabase SQL editor; not captured in any migration file. Sync schema.sql if one is being maintained.
- CLAUDE.md still describes pre-Phase 2 scope — does not reflect awaiting_reupload, Email H/I, manual_review_email_sent_at, or auto-reject logic

---

## 19. Process learnings worth keeping

- TypeScript inference for Supabase JS embedded relations is unreliable — verify shape empirically with curl
- Anthropic vision API "5MB limit" is base64 string length, not raw bytes
- When reality contradicts your math, add observability before fixing
- Manual review queue is where you discover what's actually going wrong (e.g., the QR-code-only photo discovery)
- Rate limits matter — Resend free tier was 100/day, get on paid before launch
- Claude.ai chats hit context limits — handoffs make recovery possible
- Use the cheapest tool for the task: Terminal for inspection, Claude Code for code, Claude.ai for thinking
- Plan before build: a written spec saves hours in implementation

---

## 20. Session log

### Saturday May 9, 2026 — EVENING — production incident + Phase 2.6 cleanup (Claude Code)

**Context:** Followed directly after the afternoon session. Three areas of work: diagnosing and resolving a production incident (stuck receipts), adding an Email I duplicate guard, and shipping the auto-reject rule for clearly-invalid uploads.

**1. Production incident: stuck receipts root cause found and resolved**

Phase A diagnostic found 5 receipts stuck in `status='processing'` with `ai_processed_at` set — meaning AI ran successfully but the final DB write never committed. Root cause: `receipts_status_check` CHECK constraint did not include `awaiting_reupload` as an allowed value. When the orchestrator tried to write `status='awaiting_reupload'`, the DB silently rejected it (no error handling on the update call), Email H was sent anyway, and the receipt remained in `processing` forever.

**Process learning (important):** Claude Code earlier in the May 9 afternoon session said "no migration needed" when the `awaiting_reupload` status value was added — this was wrong. The CHECK constraint must be explicitly updated whenever a new enum-like status value is added. Future process: before shipping any new status value, run `SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'receipts_status_check'` in Supabase SQL editor and update the constraint explicitly.

**Constraint fix SQL (applied by Leonardo in Supabase SQL editor):**
```sql
ALTER TABLE receipts DROP CONSTRAINT receipts_status_check;
ALTER TABLE receipts ADD CONSTRAINT receipts_status_check
  CHECK (status IN ('uploaded','processing','approved','rejected','needs_review','awaiting_reupload'));
```

**resolve-stuck-receipts.ts execution outcome (commit 080d23e):**
- Ran `--dry-run` first → confirmed all 5 receipts would route to `awaiting_reupload` (Pre-check 0: cnpj=null)
- Ran `--apply` after constraint fix → 5 receipts resolved; 3 real customers (Victor, Denis, Davizim12) received Email H; 2 LeoQATester rows resolved silently (no email, no email on file)
- Second-strike detection verified working: all 5 were first strikes, no second-strike case triggered (expected)

**2. Email I duplicate guard**

Added `receipts.manual_review_email_sent_at TIMESTAMPTZ` column. Extracted `sendManualReviewEmailOnce()` helper in `lib/process-receipt.ts` — checks the column before sending Email I, writes the timestamp after. Covers all 4 Email I call sites: image_too_large, image_unprocessable, second_unreadable_upload, and main needs_review fallthrough. Commit `8b7c567`.

**Backfill SQL for previously-notified receipts (run by Leonardo in Supabase SQL editor before second reanalysis):**
```sql
UPDATE receipts
SET manual_review_email_sent_at = ai_processed_at
WHERE status = 'needs_review'
  AND ai_processed_at IS NOT NULL
  AND manual_review_email_sent_at IS NULL;
```
Applied to 246 needs_review receipts. Prevents Email I re-send on future reanalysis runs.

**3. Second reanalysis run**

Ran `npx tsx scripts/reanalyze-needs-review.ts --apply` against 255 needs_review receipts.
- 4 approved (codes sent, Email A fired)
- 59 routed to `awaiting_reupload` (Email H sent — these were the null-CNPJ cases now correctly reaching the awaiting_reupload branch after the constraint fix)
- 192 still in needs_review
- 0 errors
- Cost: ~$2.55, runtime: ~28 minutes

**4. Auto-reject for is_receipt=false at high confidence (commit 4c1c1b3)**

Modified `lib/validate-receipt.ts` Step 1: when `is_receipt=false AND confidence=high`, return `{ status: 'rejected', reason: 'not_a_receipt' }` instead of routing to needs_review. Medium/low confidence still goes to needs_review.
Added `'not_a_receipt'` to `RejectionReason` type.
Wired `sendReceiptRejectedNotReceipt` (Email B) in the orchestrator's rejected branch for this case.
Scope: only is_receipt=false at high confidence. Other rejection reasons (invalid_cnpj, amount_too_low, date_out_of_window) deferred — each needs individual safety analysis before auto-rejection.

**5. Email B copy rewrite (commit caba829)**

Updated `sendReceiptRejectedNotReceipt` body with: required fields list (CNPJ, razão social, date, total, cupom number), QR-only warning, photo quality guidance. Finality tone ("Não foi possível processar") distinguishes from Email H's hopeful tone ("Precisamos de uma foto melhor"). Single message works for both auto-rejection and admin manual rejection paths.

**6. apply-not-a-receipt-rejection.ts cleanup script (commit 1cda2c7)**

Created one-off script to apply the new auto-reject rule to the 192 existing needs_review receipts using cached ai_raw_response (no fresh OpenAI calls). Handles both flat and nested ai_raw_response shapes.

Dry-run result: **0 matches** — no existing needs_review receipt has `is_receipt=false AND confidence=high`. The queue's not_a_receipt cases are all medium/low confidence. Script is valid for future use but the immediate backfill is a no-op.

**Commits this session:**
- `080d23e` feat(ops): add resolve-stuck-receipts script for timeout recovery
- `8b7c567` feat(orchestrator): guard Email I against duplicates via manual_review_email_sent_at
- `4c1c1b3` feat(validator): auto-reject when is_receipt is false at high confidence
- `caba829` fix(emails): update Email B body with detailed guidance and finality tone
- `1cda2c7` feat(ops): add apply-not-a-receipt-rejection cleanup script

**Status at session end:** Production incident resolved. Email I deduplication live. Auto-reject for clear non-receipts live. 244 needs_review receipts remain for manual processing or future auto-reject expansion.

---

### Friday May 8, 2026 — morning session (Claude Code)

**Context:** Picked up from May 7 evening where AI pipeline components 1–9 were shipped. Top outstanding item was the 60% CNPJ false-rejection rate.

**Accomplished:**
- Rebuilt this handoff document (PROJECT_HANDOFF.md) from scratch after Claude.ai chat hit context limit — established it as the living single source of truth
- Added CLAUDE.md rule requiring handoff to be read at session start and updated at session end
- Decided to switch AI extraction provider from Claude (Anthropic) to OpenAI — based on empirical finding of ~60% false-rejection rate on `invalid_cnpj` category from May 7 backlog run. OpenAI integration is paused today due to their service instability.
- Routed all OCR-dependent rejection reasons (`not_a_receipt`, `invalid_cnpj`, `amount_too_low`, `date_out_of_window`) to `needs_review` instead of auto-rejecting — commit `42c672f`. Duplicate remains the only auto-rejection.
- Reset 178 false-rejected receipts back to `uploaded` and re-ran the backlog processor. Result: 183 `needs_review`, 6 `approved` (codes sent automatically), 3 `duplicate` rejected, 3 errors (same pre-existing `amount_total_brl` missing field issue).
- Added photo guidance section to `/enviar-recibo` — good/bad example images + checklist — after manual review revealed many customers were photographing only the QR code. Commit `319515e`.
- Identified next problem to solve: customer photos exceeding 5MB base64 threshold never reach AI. Client-side resize before upload is the fix — spec to be written in parallel Claude.ai chat.

**Decisions made this session:**
- Switch to OpenAI for AI extraction (decision #14 in section 9)
- OpenAI integration paused pending their service stability (decision #15)
- Route OCR-dependent rejections to needs_review (decision #12)
- Photo guidance on upload page (decision #13)
- Client-side image resize before upload as next build target (decision #16)
- Living handoff document as session protocol (decision #17)

**Outstanding at session end:**
- Client-side image resize spec: not yet written (next task in parallel Claude.ai chat)
- OpenAI integration: decided, not yet built
- 183 receipts in needs_review queue: Leonardo reviewing manually
- 3 error receipts (`amount_total_brl` missing): still stuck at `uploaded`, need investigation
- All items in section 18 remain open

---

### Friday May 8, 2026 — second session (Claude Code)

**Context:** Picked up immediately after morning session. Spec for client-side image resize had just been written and committed.

**Accomplished:**
- Built client-side image resize feature in full per `docs/image-resize-spec.md`:
  - Created `lib/resize-image.ts` — async helper using `browser-image-compression`, skips files < 2MB, targets 4MB/1920px JPEG at quality 0.85, retries at 0.7 if still over 4MB, throws Portuguese error otherwise
  - Modified `app/enviar-recibo/page.tsx` — async file-change handler, "Otimizando foto..." loading state during resize, error display on failure, submit button disabled during resize; removed old 4.5MB hard block
  - Added guidance bullet: "Nao se preocupe com o tamanho da foto — vamos otimizar automaticamente."
- Three commits pushed: `c0da895`, `7dafe11`, `df8133f`
- Updated this handoff

**NOT TESTED** — Leonardo to run manual test cases from spec section 6 on real phone.

**Outstanding at session end:**
- Manual testing of resize (5 test cases in spec section 6) — Leonardo to run
- OpenAI integration — decided, paused pending their service stability
- All items in section 18 remain open

---

### Saturday May 9, 2026 — Phase 2 + Email Audit (Claude.ai + Claude Code, afternoon)

**Context:** With OpenAI live in production and reanalysis run complete, Leonardo focused the afternoon on customer communication. Built and shipped Phase 2 (re-upload flow with first/second strike detection), then ran an email audit that surfaced systemic issues — addressed HIGH severity items same day.

**Phase 2 implementation (Tasks 1-7):**
- Database: added receipts.reupload_request_sent_at TIMESTAMPTZ + index on (status, reupload_request_sent_at) WHERE status='awaiting_reupload'
- New status value: 'awaiting_reupload'
- Email H (sendReceiptReuploadRequest, "Precisamos de uma foto melhor")
- Email I (sendReceiptManualReviewNotification, "Estamos analisando seu recibo")
- Validator Pre-check 0: routes is_readable=false OR (low confidence + 2+ null fields) OR null CNPJ to awaiting_reupload
- Orchestrator: first/second strike detection via .maybeSingle() query on participant's prior receipt
- Email I fires on every needs_review path (with one architectural exception: the !participant.email branch can't email someone with no email)
- Vercel cron at /api/cron/timeout-reuploads, daily at 6am UTC (3am Brazil), moves 7-day-stale awaiting_reupload to needs_review silently
- CRON_SECRET added to Vercel + .env.local
- Test 1 verified: Nanda's QR-only image triggered Email H correctly after Pre-check 0 was loosened. Test 2 (second strike) was scoped but not run — deferred.

**Email audit:**
- docs/email-communication-audit.md generated by Claude Code
- 10 issues identified across 5 categories (Duplicate / Contradiction / Gap / Obsolete / Edge case)
- HIGH severity (Issues 1+2): upload confirmation email contradicted downstream outcomes for ~200 customers in needs_review and any awaiting_reupload customer
- HIGH severity addressed today: upload confirmation email removed entirely (commit 12c96b1) — principle is "email only on state changes"

**Phase 1 script archive:**
- Three blast scripts (send-reminders, send-catchup, send-rejection-recovery) moved to scripts/_archived/
- README explains why they're archived
- tsconfig.json excludes scripts/_archived from TypeScript compilation (necessary fix — relative imports broke after move)

**Commits today (afternoon, in order):**
- 0d7f0b5 feat(emails): add isDelayedAnalysis variant for batch reanalysis rejections
- 0cfe5fc feat(orchestrator): pass isDelayedAnalysis flag through
- 396aae1 feat(ops): add reanalyze-needs-review script with dry-run safety
- 58205a8 feat(emails): add Email H + Email I
- cc8d782 feat(validator): add awaiting_reupload routing
- bffe358 feat(orchestrator): first/second strike detection
- 10e0890 feat(orchestrator): fire Email I on all needs_review routes
- 33559c5 feat(cron): daily 7-day timeout job for awaiting_reupload
- b281c49 feat(validator): expand Pre-check 0 to fire on null CNPJ
- 7b7f2ae fix(emails): rewrite upload confirmation outcome-neutral (superseded)
- 12c96b1 fix(emails): remove upload confirmation email entirely
- ad9427e chore(scripts): archive Phase 1 blast scripts

**Outstanding from today's work:**
- Test 2 (second-strike detection) was never run end-to-end. Code is built and reviewed but not verified by manual test. Risk: a real customer will be the first test.
- Reanalysis-script Email I duplicate guard (Issue 3 from audit) — needed before next reanalysis batch
- Dead imports in process-receipt.ts (Issue 4 from audit) — cleanup
- Issues 8-10 from audit (cron silent transition, admin double Email A, admin reject isDelayedAnalysis) — low severity, deferred
- LeoQATester test rows still in production database — cleanup eventually
- 4 leaked API keys still need rotation (deferred from morning)
- All items in section 18 still open

**Status at session end:** Phase 2 live in production. Email policy is now "state changes only." Email audit doc is the single source of truth for email touchpoints. Customer experience meaningfully improved.

---

### Saturday May 9, 2026 — OpenAI integration shipped (Claude.ai + Claude Code)

**Context:** Followed yesterday's plan — wrote OpenAI integration spec, implemented, tested locally, shipped to production, all before 10am launch.

**Accomplished:**
- Created OpenAI account and project (panini-xp-2026), set $50 monthly budget with 50% / 96% / 100% alerts, added payment method, generated API key
- Loaded $50 prepaid credit balance with auto-recharge enabled
- Added OPENAI_API_KEY to .env.local and Vercel (sensitive, all environments)
- Wrote spec at docs/openai-integration-spec.md
- Implemented lib/extract-receipt-openai.ts with OpenAI Structured Outputs (gpt-4o, temperature 0, json_schema strict mode)
- Added AI_EXTRACTION_PROVIDER env var toggle in lib/process-receipt.ts (default: claude)
- Added test script scripts/test-openai-extractor.ts for local testing without waitUntil
- Hardened OpenAI prompt to require exactly 14-digit CNPJ, return null if uncertain (commit 65c890e)
- Tightened validator with pre-check for incomplete/low-confidence extraction — routes to needs_review (commit a5aaa8b)
- Fixed unreachable code error caught by TypeScript (commit 53e2928)
- Flipped Vercel env var AI_EXTRACTION_PROVIDER from claude to openai
- Verified end-to-end in production: real receipt uploaded — OpenAI extracted CNPJ correctly — validator approved — code PXP-2026-SN98R generated — email "Seus codigos chegaram" delivered

**Decisions made this session:**
- AI provider in production: OpenAI (gpt-4o)
- Toggle architecture preserved: claude path still in code as kill-switch
- No silent fallback: if OpenAI fails, receipt routes to needs_review, never falls back to Claude

**Commits today:**
- 0888ac5 feat(ai): add openai sdk dependency
- 19333a5 feat(ai): add OpenAI-based receipt extractor with structured outputs
- d4eb9ad feat(ai): add provider toggle to process-receipt orchestrator
- aae54f1 test(ai): add one-off OpenAI extractor test script
- 65c890e feat(ai): harden OpenAI extraction prompt
- a5aaa8b feat(validator): route incomplete or low-confidence extractions to needs_review
- 53e2928 fix(validator): remove unreachable low-confidence check

**Outstanding (post-launch cleanup):**
- Test participant LeoQATester with code PXP-2026-SN98R is in production database — clean up or keep as real entry
- 4 API keys leaked into Claude.ai chat earlier this morning need rotation: SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, RESEND_API_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY (deferred for post-launch per Leonardo's call)
- Manual review queue from yesterday — count unknown
- Reprocess 198 historical false-rejected receipts now that OpenAI is live
- 166 customers from May 7 recovery emails still need re-processing
- All items in section 18 remain open

**Status at session end:** Production live on OpenAI. Launch in 6 minutes. Monitoring planned.

---

### Saturday May 9, 2026 — morning session start (Claude.ai)

**Context:** Resumed work after stopping yesterday evening. OpenAI service is now stable. Picking up where May 8 third session left off.

**In progress:**
- Complete OpenAI account setup: billing limits, payment method, API key
- Save key securely (.env.local + Vercel env vars)
- Write OpenAI integration spec at docs/openai-integration-spec.md

**Outstanding from yesterday (still open):**
- Manual testing of resize on real iPhone hardware — NOT YET DONE
- Manual review queue — count unknown, needs check
- All items in section 18 remain open

---

### Friday May 8, 2026 — third session (Claude Code)

**Context:** Picked up after second session. Client-side resize was built and pushed but untested on real devices. HEIC handling was assumed to work via `browser-image-compression` internals.

**Accomplished:**
- Discovered HEIC failure on Chrome: `browser-image-compression` fails to decode HEIC because Chrome has no native HEIC support — the library tried loading the file into an `<img>` element and got an `Event {type: 'error'}` back.
- Diagnosed via `console.error` debug log added to the catch block (`cedd72b`).
- Fixed by installing `heic2any` and adding an explicit HEIC-to-JPEG conversion step at the top of `resizeReceiptImage`, before passing to `browser-image-compression`. Detection checks both `file.type` and `file.name` extension to handle browsers that don't set MIME type on HEIC files. Commit `a29b7ee`.
- Verified end-to-end in Chrome iPhone 14 Pro Max responsive view: HEIC photo selects, converts, previews correctly, no errors.
- Removed debug `console.error` log after verification (`f809576`).

**Commits this session:** `cedd72b`, `a29b7ee`, `f809576`

**Outstanding at session end:**
- Manual testing on a real iPhone (physical device, not responsive view) — NOT YET DONE
- OpenAI integration — decided, paused pending their service stability
- All items in section 18 remain open

---

*End of session. Next update due at the start of the next session.*
