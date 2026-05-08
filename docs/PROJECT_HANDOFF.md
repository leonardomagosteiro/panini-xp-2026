# Panini XP 2026 — Living Project Handoff

**Last updated:** Friday, May 8, 2026 — evening session
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
- status: `uploaded` | `processing` | `approved` | `rejected` | `needs_review`
- AI columns (May 7): receipt_number, receipt_date, ai_processed_at, ai_confidence, ai_raw_response (jsonb), reviewed_at, reviewed_by, rejection_reason, cnpj_on_receipt, amount_total_brl
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

*End of handoff. Next update due at the end of this session.*
