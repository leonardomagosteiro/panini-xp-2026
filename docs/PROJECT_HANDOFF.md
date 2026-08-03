# Panini XP 2026 — Living Project Handoff

**Last updated:** Monday, August 3, 2026
**Status:** Live. Draw #2 completed July 31 (winner verified legitimate; notification pending). draw_phase = 'completed'. HEAD at 2d80dcf plus this bookkeeping commit.

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

### June 25 — AWS Textract integration + DMCAMP signature matcher + bucketed manual review UI

**Context:** Full-day session driving toward the June 26 announcement deadline. Started with the 30-min reality check: 5/5 randomly sampled needs_review JPEGs were readable. Textract fork locked.

**Shipped (seven commits, all on `main`, pushed):**

- `74dcce1` — **AWS Textract integration.** `lib/extract-receipt-textract.ts` (Textract AnalyzeExpense adapter with strict CNPJ regex, Brazilian amount + Portuguese date parsing, three-field combined confidence over TOTAL + CNPJ + INVOICE_RECEIPT_DATE). Initial confidence CLAMPED to 'medium' max — auto-approve disabled. `lib/process-receipt.ts` adds Textract as third provider in the `AI_EXTRACTION_PROVIDER` env switch + `SUPPRESS_MANUAL_REVIEW_EMAIL` flag for batch reprocessing. `lib/validate-receipt.ts` Pre-check 0 tightened to require ALL three fields null (was: `cnpj === null` alone, which was over-aggressive). Admin page shows extracted amount/CNPJ/date inline.
- `2012251` — **Full-width receipt image + reprocess pipeline.** Receipt image card goes from `maxHeight: 180` (tiny thumbnail) to `width: 100%, maxHeight: 800` (readable end-to-end without opening in new tab). Signed URL TTL from 1h to 8h for long review sessions. `lib/reprocess-receipt-textract.ts` (idempotent reprocess on any receipt status, unlike the original `processReceipt` which short-circuits on `status !== 'uploaded'`). `scripts/reprocess-backlog.ts` (full-backlog driver with per-receipt timeout, resumable JSON state, progress logging).
- `aeda648` — **DMCAMP store-signature matcher rescues 86% of CNPJ-null receipts.** `lib/store-signatures.ts` uses three rules: (1) bare CNPJ scan in OTHER fields — no label requirement, handles "CHPJ"/"CNDJ"/"C NPJ" OCR misreads — (2) "DMCAMP"/"DM CAMP" name substring in VENDOR_NAME/VENDOR_ADDRESS/NAME fields, (3) address signature: "RIBEIRAO BONITO" + "430" OR CEP "13030120" anywhere in any address field. Synthetic 90% confidence when matched. Verified across two 30-receipt samples: 83.3% then 86.7% rescue rate; 0 false positives in 60 image-verified receipts.
- `98103c7` — **Narrow auto-approve for DMCAMP.** Replaces the blanket confidence clamp. Auto-approve ('high') requires: CNPJ is DMCAMP + amount in [R$50, R$200] + amount confidence ≥80% + date confidence ≥80%. Defense-in-depth: validator's per-field checks (null date, duplicate, etc.) still apply after extractor returns 'high'. Verified by spot-checking 8 candidates from a 50-sample: 7/7 image-matched, 8th would route to needs_review via validator's null-date check.
- `7d66aec` — **Bucket-filter tabs for manual review.** 5 buckets (Todos, Verificar valor, Verificar CNPJ, EBANCAS, Sem dados) collapse the reviewer's mental context-switch load. Server-side filter via `?bucket=` query param. Discovered post-deploy that the 5 buckets did not sum to Todos — leading to:
- `e1169cb` — **'Pronto p/ aprovar' bucket added.** Caught ~314 uncategorized receipts: CNPJ set + amount in [50,200] + date set + CNPJ not EBANCAS. These are the fastest reviews (everything's correct, just click) so positioned as first tab after 'Todos'. Math still didn't reconcile — leading to:
- `87c29ef` — **'Outros' catch-all bucket added.** Diagnostic counted 7 edge-case patterns totaling ~150 receipts (missing date, amount <R$50, big amount no CNPJ, etc.). None individually big enough to deserve its own bucket. 'Outros' is in-memory negation (fetch all, drop anything matching specific bucket predicates). Math now reconciles: Pronto + Verificar valor + Verificar CNPJ + EBANCAS + Sem dados + Outros = Todos.

**Operational runs performed:**

- **Reality check** (`scripts/reality-check-sample.ts`): 5/5 receipts human-readable. Textract fork chosen.
- **Smoke test** (`scripts/textract-smoke-test.ts`): 5 receipts. Findings: Textract correctly extracts amounts where OpenAI returned null. Textract's `VENDOR_NAME` is often the payment processor (PagBank, pagvendas), not the merchant — CNPJ in OTHER fields is the load-bearing field. Textract reports >95% confidence on digit misreads (R$84 read as R$884 at 99.8%).
- **Backlog predict run** (`scripts/predict-backlog.ts`): full-backlog dry-run with caching. After validator fix, projection on a 337-receipt sample: 86% needs_review, 5% awaiting_reupload, 3% approved, 3% timeout, 1.8% invalid_cnpj.
- **Full reprocess** (`scripts/reprocess-backlog.ts`) on 1,232 needs_review receipts. Outcome: 1,096 → needs_review (Textract data now stored on each row), 113 → awaiting_reupload (reupload emails fired), 18 → timeout errors, 5 → rejected. ~$60 in Textract cost. ~2 hours.
- **Store-signature inspection** (`scripts/inspect-textract-full.ts`): full Textract response dump for 5 random needs_review receipts where Textract didn't extract a CNPJ. Goldmine — drove the three signature rules.
- **Store-signature tests** (`scripts/test-store-signatures.ts` + `scripts/sample-store-signatures.ts`): 5 hand-picked + two 30-receipt samples. Iterations: dropped the "label must include CNPJ" requirement after seeing "CHPJ" misreads; added CEP rule after seeing the FORCARD-mangled-vendor-name case (Receipt 3).
- **Auto-approve sample** (`scripts/predict-auto-approve-sample.ts`): 50 receipts. 8 candidates spot-checked manually — 7/7 image-matched.
- **Second reprocess** on all 1,070 needs_review (post-store-signature, post-auto-approve). Outcome: 85 approved (auto-approve fired), 185 rejected (duplicates now detectable via store-signature CNPJ), 34 timeout errors, 766 → needs_review with Textract data populated.

**Key learnings:**

1. **Textract returns high confidence on digit misreads.** R$84 read as R$884 at 99.8%. Raw confidence is not a sufficient auto-approve gate. The R$50-R$200 amount range + 80% per-field confidence threshold is the actual protection.
2. **Store-signature matching is high-precision.** Across 60 image-verified receipts, 0 false positives. Bare CNPJ exact match + name substring + CEP signature are each sufficient evidence on their own.
3. **PostgREST 1,000-row cap is permanent.** Caught during reality check when 1,229 expected returned exactly 1000. `lib/paginate-query.ts` (`fetchAllRows()`) added; CLAUDE.md updated with pagination discipline.
4. **`processReceipt` is the upload pipeline, not the reprocess pipeline.** Status guard at the top short-circuits on `status !== 'uploaded'`. Reprocessing needs a different entry point — `reprocessReceiptWithTextract` is that primitive.
5. **Bucketing the review queue removes context-switching cost**, not just visual clutter. Mental load drops when the reviewer processes one bucket's "what am I checking" question at a time.
6. **The reviewer's verification still matters.** Pre-fill is a suggestion, not a fact. The 884-vs-84 misread case repeats. Glance at the image; confirm pre-filled amount matches; only then click approve.
7. **No-email customers approved anyway, WhatsApp as fallback.** Codes are generated regardless of email. Post-deadline: build admin export flagging no-email approved customers.

**Post-day DB state at close:**

- uploaded: 3
- processing: 0
- approved: **891** (+117 from June 24 close)
- rejected: **297** (+215 — store-signature unlocked dedupe)
- needs_review: **791** (–438 from June 24)
- awaiting_reupload: **117** (+114 — true unreadables routed correctly, reupload emails sent)
- Total: 2,099

The 791 needs_review queue is the queue to clear tomorrow via bucketed manual review.

---

### June 28 — Final queue clearance, draw announcement system shipped, blast delivered

**Context:** Second active session since June 25. Started with the system at 791 needs_review receipts and the June 26 announcement-email deadline already 2 days slipped. Goal: clear the queue and ship the draw announcement end-to-end.

**Two operational customer corrections caught and fixed during manual review:**

- **Takeda case** (takeda.alex@gmail.com): a R$105 receipt had been approved with only 1 code instead of the correct 2. Fix: SQL transaction added 1 code, updated participant.code_count 1->2 and receipts.codes_generated 1->2, backfilled receipts.amount_on_receipt to 105.00. Sent a transparent correction email via Resend (id `934c5ccd-b2e3-4870-9078-a23f0ec64c5b`). The fix script was then generalized in the same session as `scripts/send-correction-email.ts` — a CLI tool with `--email`, `--nickname`, `--original-code`, `--new-code`, and `--amount` flags with input validation, reusable for any future undercount case.
- **Andrea case** (deiaoandrade@hotmail.com / RB2026): the same physical receipt had been approved twice during manual review — once at 14:18 and again at 16:38 — generating 1 fraudulent extra code. Fix: SQL transaction deleted orphan code PXP-2026-KXQVU, decremented participant.code_count 8->7, marked the duplicate receipt status=rejected with rejection_reason=duplicate. Sent a transparent revocation email via Resend (id `704e276a-d89c-4892-b942-ba8be07deaa4`) listing the revoked code in strikethrough and confirming all 7 original codes remain valid.

**Three same-customer duplicate uploads** (Lizarb, Rodrigo, Daiane) caught visually during manual review and properly rejected with rejection_reason=duplicate before approval — no codes were generated.

**One suspicious customer flagged and resolved:** Juliano (julianodefreitasmoreira@hotmail.com) had 3 approved receipts with anomalies including 2 with null reviewed_by/reviewed_at and one stored receipt_date of 2006-06-08 (20 years pre-campaign). Case was raised with the team mid-session and resolved. Case closed.

**Final queue clearance:** Started at 791 needs_review, ended at 0. 374 approved + 106 rejected via manual review (480 total decisions). Day-over-day deltas: approved 891->1,576 (+685, including auto-approvals during the day), rejected 297->493 (+196), needs_review 791->0, awaiting_reupload 117->41 (-76, customers re-uploaded after May/June reminders).

**Part B shipped — draw block injection into customer-facing emails:**
- `buildDrawBlock()` injected into 4 email functions: `sendReceiptApproved` (celebratory variant), `sendReceiptPleaseReupload` (urgent), `sendReceiptReuploadRequest` (urgent), `sendReceiptManualReviewNotification` (patient).
- 5 rejection email functions deliberately left untouched — mentioning a draw to someone just told they are ineligible reads as taunting.
- Architecture: env var feature flag (`DRAW_ANNOUNCEMENT_ACTIVE`, `DRAW_DATE_DISPLAY`, `DRAW_INSTAGRAM_HANDLE`). All three env vars added to Vercel for production (All Environments).
- Persistent Instagram CTA (icon + @paninixp link) added to `buildEmailHtml` footer — applies to all 9 emails including rejections (this is branding, not promotion).
- Two image assets shipped to `public/`: `instagram-icon.png` (48px, 3KB) and `prize-camiseta-brasil.png` (500px, 300KB).

**Part A shipped — announcement blast:**
- `scripts/send-draw-announcement.ts` blasted to 1,297 customers across two segments.
- Approved segment: 1,273 received the celebratory variant ("you have codes, good luck").
- Awaiting-reupload segment: 24 received the urgent variant ("re-upload before the draw").
- 1 send failed due to a malformed email address (gnail.com typo — expected and acceptable).
- Audience queries re-run at send time for fresh classification; participants with both approved and awaiting_reupload receipts deduped into the approved segment only.

**Process discipline note:** The override-flag log bug — log lines printed the audience email (`p.email`) instead of the actual recipient (`to`), which briefly suggested the smoke test was sending to real customers despite the `--to` override. Resend dashboard verification confirmed both smoke-test sends correctly landed at leonardomagosteiro@gmail.com. Behavior was correct; the log was cosmetically wrong. Reinforced the "verify against the dashboard, never trust the log line" reflex.

**Operational reminder:** After June 30 prize draw, flip `DRAW_ANNOUNCEMENT_ACTIVE=false` in Vercel to revert all draw blocks from the 4 customer-facing emails — no deploy required.

---

### June 29 — Live-draw system built end-to-end

**Context:** Full-day build session. Goal: give the team a way to run the June 30 prize draw live on Instagram, provably legit, without touching production data destructively.

**Shipped (6 commits past c2fe920):**
- ca8b371 — read-only snapshot script scripts/generate-draw-snapshot.ts (txt/csv/xlsx/pdf to ./draw-exports/, gitignored). Adds pdfkit + xlsx deps.
- c5818e2 — snapshot API route GET /api/admin/draw-snapshot (txt/csv/xlsx; pdf dropped due to serverless pdfkit font-bundling — local script covers pdf). Auth-gated, inline-paginated, in-memory streaming (no disk writes), binary returned as Uint8Array.
- cb1ae4f — /admin/sorteio page (live count + export buttons) + draw-phase email switching. Emails read draw_phase via new getDrawPhase() helper (safe fallback 'announced' on any DB error). buildDrawBlock(variant, phase): 'announced' = pre-draw block (unchanged), 'completed' = post-draw "codes still valid, next draw coming" message. Wired into the 4 customer-facing emails; 5 rejection emails untouched; send-draw-announcement.ts pinned to 'announced'.
- 2b9e8cd — "Começar sorteio" trigger + POST /api/admin/draw-start (flips draw_phase to 'completed'). Neutral broadcast-safe confirm modal (no email/internal wording); page reads phase on load so a refresh shows the true state; button hidden after start so it can't double-fire.
- e934634 — winner verification: GET /api/admin/draw-winner + /admin/sorteio/vencedor page. Code input normalized (uppercase, strip non-alphanumerics, rebuild canonical PXP-2026-XXXXX) so missing dashes / spaces / lowercase all match. Two-zone UI: public "Resultado" (code, VALIDO/INVALIDO, nickname) + red "DADOS INTERNOS — NAO EXIBIR AO VIVO" block (full name, CPF, receipt fields, signed-URL image) — broadcast privacy guard.
- 574ad95 — subtle yellow "Verificar vencedor" link on /admin/sorteio (one-click nav to the winner page).

**Schema change (approved by Leonardo):** new table campaign_state — single row (id=1, enforced by a check constraint), draw_phase text check IN ('announced','completed'), updated_at, RLS enabled with NO public policy (service-role only). Seeded 'announced'. Backup confirmed (Supabase auto-backup 9h old) and DB health "Healthy" before creating. CURRENTLY 'announced' — draw is June 30.

**Verified:** snapshot exports correct at 2,998 then 3,002 codes (live count grew during the day as customers uploaded); email phase switching tested in BOTH states against the Resend dashboard (announced -> pre-draw block, completed -> post-draw block, then reset to announced); winner lookup against a real approved code (Debora, PXP-2026-8TPQO) and malformed/no-dash inputs; all pages deployed to production and tested on app.paninixp.com.br, not just localhost.

**Deliverable:** one-page Portuguese team runbook (PDF, generated in chat — NOT in repo). Covers off-camera login, export-then-trigger order, the never-show-the-red-zone rule, winner lookup, and "avise o Leonardo" for reversal.

**Process notes:** Recurring snag — dev-server and verification commands kept landing in the same terminal tab, killing the server (ERR_CONNECTION_REFUSED); fix is a dedicated server tab that nothing else is typed into. Accidental Confirmac on the trigger during testing flipped live draw_phase to 'completed' — reset to 'announced' within minutes, no customer impact; it doubled as a full end-to-end proof of the trigger. campaign_state state persists across server restarts (it's in the DB), which is correct behavior.

### June 30 — Draw day: PII toggle shipped, Option C rehearsal, draw-mechanics verified against code

**Context:** Draw day (live tonight on Instagram @paninixp). Operational support + one shipped feature, not a build day. Team self-operates via Option B (rehearse all except Confirmar).

**Verified the draw mechanics against the actual handler code (not handoff prose):**
- Read app/api/admin/draw-start/route.ts directly. Confirmed "Comecar sorteio" does ONE thing: UPDATE campaign_state SET draw_phase='completed'. It does NOT snapshot and does NOT read the codes table. The exported TXT is the freeze; the button is only the start signal. Runbook order confirmed correct: export first, then click.
- Read app/api/admin/draw-winner/route.ts directly. Confirmed pure-read: four .select() calls plus a signed-URL generation, zero writes. Validity is computed live as receipt.status === 'approved', never persisted. No winners table. Marking a winner during testing changes no rows.

**Option C rehearsal performed (controlled production, immediate reset):** Ran the full flow on production for the team — login, export, confirm modal — then clicked Confirmar (flipping draw_phase to 'completed') and immediately fired a pre-loaded reset SQL. Window held to seconds. Verified draw_phase back to 'announced' at 12:28:38. Undo was pre-loaded in a parked Supabase tab before the trigger was clicked.

**Shipped — winner-page PII toggle (commit b059931):** The red DADOS INTERNOS zone (full name, CPF, receipt fields, image) now starts HIDDEN by default, revealed only by a deliberate "Mostrar dados internos" click, and re-hides automatically on every new lookup. Motivation: the team screen-shares the full desktop during the live draw, so "don't scroll to it" was not a sufficient guard. One file changed (app/admin/sorteio/vencedor/page.tsx), +21 lines. Tested locally on all four behaviors, then verified live on production. No API or schema change.

**Test-residue check:** The winning code used in testing, PXP-2026-SNJI2 (participant: Karina), confirmed via DB query to be a real, approved, draw-eligible code, untouched by testing because the winner page only reads. The only field today's testing wrote was draw_phase, now verified 'announced'.

**Draw-day close state:** draw_phase='announced' (verified, 12:28:38). PII toggle live in production. Runbook shipped to team (PDF, in chat, not in repo). Password handoff via separate channel. Sandbox decision: went with Option B plus the Option C rehearsal above; no separate sandbox built.

---

### July 1 — Post-draw cleanup, schema reconciliation, winner notification

**Context:** First post-draw session. The June 30 draw ran live on Instagram the night before. Goal: verify post-draw state, run the cleanup checklist, then reach the winner.

**Draw outcome (verified, not assumed):** draw_phase read as 'completed' in campaign_state, updated_at 2026-07-01 00:36:18 UTC (21:36 BRT) — a clean flip during the live window. Winning code PXP-2026-UF3EV resolves to participant Rodrigo (full_name JEFERSON RODRIGO GERALDO). Validity confirmed by SQL: blocked=false, receipt_status=approved, is_burned=0. Contact on file: whatsapp (19) 99301-3498, email rgeraldo813@gmail.com.

**Post-draw cleanup checklist (all three verified):**
1. draw_phase = 'completed' — confirmed via Supabase SQL read of campaign_state.
2. DRAW_ANNOUNCEMENT_ACTIVE — was still 'true' in Vercel; flipped to 'false' (All Environments) and redeployed (rebuild of HEAD 8af579e, Ready on Production). Note: env-var change required a redeploy to take effect — Vercel bakes the value into the running deployment, so "no deploy needed" was wrong; the redeploy is the step that makes it live.
3. Winning code PXP-2026-UF3EV recorded for next-draw exclusion (see Section 13 / decision #52).

**Shipped:**
- 16e620c — docs(schema): reconciled schema.sql with the live DB. Added participants.blocked; added awaiting_reupload to the receipts.status CHECK; added receipts.reupload_request_sent_at and manual_review_email_sent_at; added the campaign_state and burned_codes tables (both RLS-enabled, no policy, service-role only). Every value verified against the live DB via information_schema + pg_constraint + pg_policy queries before editing — NOT from handoff prose (which was wrong on two column names; see the Section 11 correction).
- 93866be — feat(scripts): scripts/send-winner-email.ts, a one-off winner-notification email sent via the Resend API. Takes a required --to flag (no hardcoded recipient), sends branded HTML + plain-text with the prize image, jersey-size question, July 6 deadline, and re-draw clause. Dry-run tested to Leonardo's own inbox twice before the live send. Reusable if the July 6 deadline triggers a re-draw.

**Winner notification sent:** live send to rgeraldo813@gmail.com confirmed Delivered on the Resend dashboard (id 8581b893-c455-431c-95ec-522ad58cb0d4). Email asks for jersey size (P/M/G/GG/XG) and sets a July 6 2026 23h59 reply deadline; if no reply by then, a new draw will be held. Reply channels: diretoria@paninixp.com.br and Instagram @paninixp.

### June 30 (evening) — Fraud account remediation + permanent block mechanism

**Context:** Pre-draw, a social-media reminder drove a wave of receipt re-uploads. A duplicate check on two flagged accounts surfaced one account (participant_id b7557cbc-8bbb-4562-b023-bad6ba920600) with a burst of ~28 uploads in a 7-minute window, including receipts dated 2020/2022/2023 (years before the campaign window) and a confirmed structural duplicate (same receipt number + date approved twice, once auto, once manually during the burst). Leonardo identified the account as fraudulent. None of the pre-campaign-dated receipts had been auto-approved — the pipeline held.

**Remediation performed (all targeting only that participant_id):**
- Full state backed up to a local JSON file before any change (PII; gitignored, never committed).
- Deleted all 15 codes; set code_count to 0; marked all 33 receipts status=rejected, rejection_reason=fraud. Verified: code_count 0, codes_remaining 0, receipts_rejected 33. Account removed from the draw pool.
- 15 code strings copied into the new burned_codes table so they can never be reissued.

**Shipped (2 commits, both Ready on Vercel Production):**
- 94d1e09 — feat(codes): two guards in lib/generate-codes.ts. Blocked-participant guard (returns no codes when participants.blocked is true, before any insert, at the single generation chokepoint). Burned-code guard (generateUniqueCode now rejects any string present in burned_codes, in addition to the codes table). Verified live: blocked user requesting 3 codes returned [] with nothing inserted.
- 29fb1c0 — feat(emails): introduced a single sendEmail() chokepoint in lib/send-receipt-emails.ts and routed all 9 senders through it. Suppresses email to any blocked participant; fails open (sends + logs if the blocked-status lookup errors, so a transient DB error never swallows a legitimate email). Verified end-to-end with an invalid Resend key (no real sends): blocked user suppressed, non-blocked user passed through to the send attempt.

**Schema changes (approved by Leonardo):** participants.blocked boolean not null default false; new burned_codes table (code text primary key, reason text, burned_at timestamptz default now()) with RLS enabled and no public policy (service-role only), matching the campaign_state pattern.

**Pre-draw production verification (after the fraud commits):** Vercel top deploy 29fb1c0 Ready/Production. /admin/sorteio loads, live count 3.008 (reflects the 15 removed). /admin/sorteio/vencedor loads; lookup of PXP-2026-8TPQO returns VALIDO/Debora; PII toggle defaults hidden and reveals only on deliberate click. The two fraud commits did not disturb draw mechanics.

---

### July 31 (pre-dawn) — Draw #2 prep: exclusion system built, over-approval corrected, environment rebuilt

**Context:** Preparation session for draw #2 (scheduled late-day July 31). Rodrigo (draw #1 winner, PXP-2026-UF3EV) had replied within the deadline confirming jersey size; his thread was closed.

**Operational work:**
- draw_phase manually reset 'completed' -> 'announced' via SQL so draw #2 announcement emails would fire correctly.
- Approval queue cleared (~60 receipts, manual review).
- Over-approval caught and corrected: participant Jessyaguiare (participant_id 9f44f4be..., receipt d620142b...) had been approved with 10 codes on a R$239.80 receipt; correct is 4 (floor 239.80/50). Fix: 6 excess codes deleted AND inserted into burned_codes (reason 'over-approval correction 2026-07-31'); code_count and codes_generated set to 4; amount_on_receipt backfilled to 239.80. Verified 4/4/4/239.80 in DB. Transparent correction email sent via new scripts/send-overapproval-correction.ts — dry-run to Leonardo's inbox first, then live to jessica_aguiar@live.com (Resend id 79dff0e2..., dashboard-confirmed Delivered).
- Root cause note: the manual-approval path stores NULL in amount_on_receipt (the entire July 31 manual batch has null amounts). This is what hid the over-approval. Added to deferred list.

**Shipped (commit 2d80dcf):** Decision #52 (winning-code exclusion) was discovered NEVER IMPLEMENTED — the June 29 handoff claimed the snapshot script accepted an exclusion list, but grep proved no exclusion code existed anywhere. Built it properly: lib/draw-exclusions.ts as single source of truth (currently containing PXP-2026-UF3EV), with the filter applied in BOTH scripts/generate-draw-snapshot.ts and app/api/admin/draw-snapshot/route.ts. Deployed Ready, verified against the PRODUCTION export: UF3EV appears 0 times, 3,201 eligible lines. Known cosmetic divergence: /admin/sorteio live count exceeds the export by exactly 1 (the excluded past winner) — expected behavior, not a bug.

**Environment incident:** .env.local and node_modules were found wiped (cause unknown). Both rebuilt. All 6 env keys restored — Supabase trio from the Supabase dashboard (legacy API keys tab), Resend key from Vercel env vars. CORRECTION to Section 14: keys do NOT live in Apple Notes as previously claimed; the real recovery sources are Vercel env vars and the Supabase dashboard.

### July 31 (draw day) — Draw #2 executed by the team

The team ran draw #2 self-service via the runbook. campaign_state shows draw_phase flipped to 'completed' at 2026-07-31 17:03:39 UTC (14:03 Brazil time) — the trigger fired as designed and post-draw emails have been active since.

**Winning code: PXP-2026-R6LTS — participant Minicraque (participant_id d04a696c-2051-4c99-89d7-544b8ad4c1bc).** Verified legitimate on August 3 via SQL: single code row (created May 26), receipt b4e4d7c2... status approved, participant blocked = false, code absent from burned_codes. Winner notification email and addition to lib/draw-exclusions.ts are the next session tasks.

---

## 6. Phase 2 commits

| Hash | Date | Subject |
|---|---|---|
| 839145a | 2026-06-28 | docs(handoff): June 28 session update |
| e4ae800 | 2026-06-28 | feat(scripts): one-time draw announcement blast |
| 763d7ce | 2026-06-28 | feat(emails): draw announcement injection + persistent Instagram footer |
| 1d8ae31 | 2026-06-28 | chore(public): add Brazilian National Team jersey image for draw block (500px, 300KB) |
| db97fa4 | 2026-06-28 | chore(public): add Instagram icon for email footer (48px, 3KB) |
| 9fb725c | 2026-06-28 | feat(scripts): one-off revocation email for duplicate receipt |
| 5a8f8d6 | 2026-06-28 | feat(scripts): signed-urls helper for batch receipt audits |
| 2a287ec | 2026-06-28 | fix(scripts): isolate module scope in send-correction-email.ts |
| c75365b | 2026-06-28 | feat(scripts): generalize correction email into reusable CLI tool |
| 87c29ef | 2026-06-25 | feat(admin): add 'Outros' catch-all bucket |
| e1169cb | 2026-06-25 | feat(admin): add 'Pronto p/ aprovar' bucket (default DMCAMP, all data present) |
| 7d66aec | 2026-06-25 | feat(admin): bucket-filter tabs for faster manual review |
| 98103c7 | 2026-06-25 | feat(ocr): enable narrow auto-approve for DMCAMP receipts |
| aeda648 | 2026-06-25 | feat(ocr): DMCAMP store-signature matcher rescues 86% of CNPJ-null receipts |
| 2012251 | 2026-06-25 | feat(admin): full-width receipt image + reprocess pipeline |
| 74dcce1 | 2026-06-25 | feat(ocr): AWS Textract integration for receipt extraction |
| 2fb2cd5 | 2026-06-25 | feat(scripts): reality check + Textract dry-run scripts (paginate-query helper) |
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
- AWS Textract AnalyzeExpense as the active OCR extractor (`AI_EXTRACTION_PROVIDER=textract`)
- DMCAMP store-signature matcher rescues receipts where Textract's strict CNPJ regex fails (vendor name, CEP, or bare CNPJ in any OTHER field)
- Narrow auto-approve for DMCAMP: CNPJ matched + amount R$50–R$200 + amount/date confidence ≥80% → 'high' confidence → validator auto-approves and generates codes
- Bucketed admin review UI at `/admin/recibos-revisao`: Todos / Pronto p/ aprovar / Verificar valor / Verificar CNPJ / EBANCAS / Sem dados / Outros (each tab filters server-side; pre-fills codes_count from extracted amount; full-width receipt image)
- Reprocess pipeline (`lib/reprocess-receipt-textract.ts` + `scripts/reprocess-backlog.ts`): idempotent, resumable, per-receipt timeout, `SUPPRESS_MANUAL_REVIEW_EMAIL` flag for batch operations
- `lib/paginate-query.ts` (`fetchAllRows`) — discipline for working around PostgREST's 1000-row cap
- Three exported helpers from `lib/send-receipt-emails.ts` (`buildEmailHtml`, `ctaButton`, `buildDrawBlock`) so scripts can render emails consistent with the in-pipeline design language
- Feature-flagged draw announcement block (env var `DRAW_ANNOUNCEMENT_ACTIVE`) injected into 4 customer-facing emails with 3 variants (celebratory/urgent/patient) tailored to recipient state
- Persistent Instagram CTA (icon + @paninixp link) in the footer of every email via `buildEmailHtml` wrapper
- Generalized `scripts/send-correction-email.ts` CLI tool for future undercount cases (`--email`, `--nickname`, `--original-code`, `--new-code`, `--amount` flags with validation)
- `scripts/signed-urls.ts` batch helper for receipt-image audits (generates time-limited signed URLs for any list of storage paths)
- `scripts/send-draw-announcement.ts` blast tool with `--dry-run`, `--segment`, `--limit`, `--to` flags (audience query re-runs at send time, supports smoke testing without spamming real customers)
- Two static image assets in `public/`: `instagram-icon.png` and `prize-camiseta-brasil.png`

---

## 8. What's broken or fragile

### Active production issue (reduced, not eliminated)

**AI extraction reliability remains the structural bottleneck even with AWS Textract live.** The June 25 reprocess auto-approved only 85 of 1,070 receipts (~8%) — far from the goal of clearing the queue without manual review. Textract is more accurate on structured field extraction than Anthropic or OpenAI (it returns amounts where they returned null, and parses TOTAL/CNPJ/DATE into typed fields), but **it still produces digit misreads at high confidence** (R$84 → R$884 at 99.8%). That single failure mode is why auto-approve had to be narrowed to a R$50-R$200 amount range + ≥80% per-field confidence + DMCAMP CNPJ.

**Observed Textract failure modes:**
- Digit misreads at >95% confidence on the amount field (the core risk; the R$50-R$200 range is the only practical guard).
- Mislabeled OTHER fields (`CNPJ` OCR'd as `CHPJ`, `CNDJ`, `C NPJ`) — caught by the store-signature matcher which scans values regardless of label.
- VENDOR_NAME often returns the payment processor (PagBank, pagvendas) instead of the merchant — store-signature matcher reaches into VENDOR_ADDRESS and OTHER fields.
- Date parse failures: Textract returns the date string at high confidence, but parser cannot decode it (e.g., Portuguese month abbreviations Textract didn't normalize). Validator's null-date check catches these as the second line of defense.
- ~3% of reprocess attempts timed out (>45s/receipt). Those receipts kept their previous state and have no Textract data populated.

**Mitigations in place (not fixes):**
- May 8 — OCR-dependent rejections route to `needs_review` (commit `42c672f`)
- May 8 — photo guidance on upload page (commit `319515e`)
- June 24 — fuzzy CNPJ matching at distance ≤ 2 in the validator (commit `3523557`)
- June 25 — AWS Textract with three-field combined confidence (commit `74dcce1`)
- June 25 — DMCAMP store-signature matcher (commit `aeda648`)
- June 25 — narrow auto-approve gate, confidence ≥80% + amount R$50–R$200 (commit `98103c7`)
- June 25 — bucketed manual review UI (commits `7d66aec` + `e1169cb` + `87c29ef`)

**Real residual issues (June 25 finding):**
- EBANCAS receipts (~117 in queue) have no store-signature matcher yet; they are routed to a dedicated bucket for visual confirmation but cannot auto-approve.
- 34 timeout-error receipts from the June 25 reprocess have no Textract data; they live in needs_review without bucketing-friendly metadata.
- ~158 "Outros" receipts (mixed edge cases: missing date, amount <R$50, big amount + no CNPJ, etc.) require full manual review.

**June 28 additions:**
- `scripts/send-draw-announcement.ts` log lines print the audience-record email (`p.email`) instead of the actual recipient. Cosmetic only; the Resend call correctly uses the `--to` override when set. Verified against the Resend dashboard during smoke testing. Fix queued for post-June 30.
- Customers with no email on file received no announcement (missing from both segments). After June 30, build admin export listing approved customers with no email so the team can WhatsApp them with their draw status.

### Outstanding customer commitments

- **needs_review queue: 791 receipts** (down from 1,229 at June 24 close, 1,320 pre-rescue). Bucketed manual review is the path to clear this. June 26 is the hard deadline (announcement email requires the queue substantially cleared).
- **awaiting_reupload queue: 117 receipts** — 7-day cron sends re-upload requests; customers can re-submit. These are true unreadables confirmed by Textract; reupload emails were fired during the June 25 reprocess run.
- **166-customer recovery promise from May 7** — substantially fulfilled. Recipients whose receipts were approved got approval emails; the remainder are somewhere in the 791 needs_review or 117 awaiting_reupload queue.
- **38 customers** without email on file — still unreachable, still queued for WhatsApp integration.
- **Manual-approval path stores NULL in amount_on_receipt** (whole July 31 batch affected). This hid the Jessyaguiare over-approval. Fix: admin approval flow should require/store the amount.

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
| 33 | OCR provider (active) | Switch from OpenAI to AWS Textract AnalyzeExpense | 2026-06-25 | Reality check: 5/5 random needs_review JPEGs were human-readable — photos are not the bottleneck, OCR provider is. Textract is purpose-built for structured receipt extraction (typed TOTAL/DATE/VENDOR fields, OTHER fields for CNPJ). Env switch via `AI_EXTRACTION_PROVIDER=textract`, kill-switch preserved. |
| 34 | Auto-approve scope: narrow | DMCAMP CNPJ + amount R\$50–R\$200 + amount confidence ≥80% + date confidence ≥80% | 2026-06-25 | Textract reported >95% confidence on R\$84 misread as R\$884. Raw confidence is not a sufficient gate. The R\$50–R\$200 range is the only practical protection against digit misreads. EBANCAS excluded: no store-signature matcher yet. |
| 35 | CNPJ rescue: store-signature matcher | Three-rule fallback when strict CNPJ regex fails: (1) bare 14-digit scan in all OTHER field values, (2) "DMCAMP"/"DM CAMP" vendor name substring, (3) CEP 13030-120 or "RIBEIRAO BONITO"+"430" in any address field | 2026-06-25 | Textract often misreads the CNPJ label as "CHPJ"/"CNDJ"/"C NPJ" — dropping the label requirement and scanning values alone rescues those. Across 60 image-verified receipts: 86% rescue rate, 0 false positives. |
| 36 | Pre-check 0 tightened | Fire only when ALL THREE of cnpj + amount + date are null (was: cnpj alone) | 2026-06-25 | The original rule was over-aggressive: a receipt where Textract extracted amount and date correctly but missed CNPJ was being immediately re-routed to awaiting_reupload before the store-signature matcher could help. |
| 37 | Bucketed review UI | 7 tabs (Todos / Pronto p/ aprovar / Verificar valor / Verificar CNPJ / EBANCAS / Sem dados / Outros) with server-side filter | 2026-06-25 | Single-queue review requires constant context switching ("what am I checking?"). Buckets let the reviewer batch by verification type. 'Pronto p/ aprovar' bucket caught ~314 receipts the other buckets would have buried. 'Outros' in-memory negation reconciles the math. |
| 38 | Batch reprocess flag: SUPPRESS_MANUAL_REVIEW_EMAIL | Env var guards `sendManualReviewEmailOnce` — set to 1 during batch reprocess runs | 2026-06-25 | Without suppression, every reprocessed receipt that lands in needs_review would fire Email I (manual review notice) to the customer — 1,000+ redundant emails during a batch run. |
| 39 | How to handle the over-approval correction for Andrea (revoke code + transparent email vs silent fix) | Full transparency: revocation email listing the revoked code in strikethrough, confirming all valid codes still active | 2026-06-28 | Customers will notice if a code stops working in the prize system; better to explain proactively than to handle support tickets after the draw. |
| 40 | Architecture for the draw announcement injection | Env var feature flag (`DRAW_ANNOUNCEMENT_ACTIVE`/`DRAW_DATE_DISPLAY`/`DRAW_INSTAGRAM_HANDLE`) rather than date-check in code or permanent infrastructure | 2026-06-28 | Instant on/off without a deploy; timezone-safe; auditable via Vercel env-var history. The right time to design generalized "promotion injection" infrastructure is after this draw, with real-world learnings. |
| 41 | Which email functions get the draw block | 4 functions only (approval, please-reupload, reupload-request, manual-review). 5 rejection emails deliberately unchanged. | 2026-06-28 | Mentioning a draw to someone you just told is ineligible reads as taunting. Rejection emails get the Instagram footer for brand presence but no promotional draw mention. |
| 42 | How to share the draw block design between in-pipeline emails and the standalone announcement | Promote `buildDrawBlock`, `buildEmailHtml`, `ctaButton` from file-private to exported so the announcement blast renders the identical card | 2026-06-28 | Single source of truth prevents future drift; matches the lib/ pattern used by cnpj-match.ts, store-signatures.ts, paginate-query.ts. Copy-paste alternatives breed inconsistency. |
| 43 | Copy volume around the draw card in announcement emails | 1 line of personalized intro + the draw card + 1 line of signoff | 2026-06-28 | The card was specifically designed to communicate everything (date, prize, disclaimer, CTA); adding paragraphs is either redundant or distracting. A save-the-date should read like a save-the-date. |
| 44 | Audience query timing for the announcement blast | Re-run at send time, NOT cached | 2026-06-28 | Customers whose status changed during the day (queue clearance pushed many to approved between dry-run and real send) need to be correctly classified at the moment they're emailed. A static-snapshot audience would systematically miss late-day approvals. |
| 45 | Audience deduplication rule for the announcement | A customer with both an approved receipt AND an awaiting_reupload receipt is in the APPROVED segment only | 2026-06-28 | The celebratory variant is more accurate for these customers than the urgent variant. We don't want to make them anxious about an unreadable receipt when they already have codes from another receipt. |
| 46 | Override-flag verification protocol when smoke-testing customer-facing email scripts | Always check Resend dashboard for recipient ground truth; never trust the script's log line | 2026-06-28 | This session's near-miss: log line printed audience email even when the --to override was respected by the Resend call. Scripts can correctly send while reporting incorrectly. The dashboard is the source of truth. |
| 47 | Snapshot-as-freeze instead of a destructive lock | The team clicks "Começar sorteio"; the exported file IS the freeze | 2026-06-29 | Read-only, no schema mutation, timestamped file is itself the legitimacy proof; uploads keep flowing into the NEXT draw |
| 48 | draw_phase stored in DB (campaign_state), not an env var | New single-row table read by the email pipeline | 2026-06-29 | Post-draw email phase must persist indefinitely until the NEXT draw is announced; an env var/browser state can't do that and a button can't flip a Vercel env var |
| 49 | The "Começar sorteio" button flips draw_phase to 'completed' | One action does both: marks the draw moment AND switches the emails | 2026-06-29 | Fixes the case where a customer uploading right after the draw would otherwise get a "draw is coming" email about a draw that already happened |
| 50 | Separate /admin/sorteio/vencedor page for winner lookup | Not on the main draw page | 2026-06-29 | The winner panel shows CPF + full name; the main page may be on the live broadcast. Separation reduces accidental exposure |
| 51 | No reverse button on the draw page | Reversal is a manual SQL command via Leonardo only | 2026-06-29 | A reverse button on a live-broadcast page is a foot-gun; intentional friction is safer. Reversal = UPDATE campaign_state SET draw_phase='announced' |
| 52 | Winning-code exclusion deferred to next draw | Snapshot script accepts an exclusion list, seeded empty for this draw | 2026-06-29 | The winning code shouldn't re-enter future draws; recorded as a fact + applied at the next snapshot, no machinery built now |
| 53 | How to neutralize the fraud account before the draw | Delete its codes + zero code_count + reject all its receipts, after a local PII backup | 2026-06-30 | Removes it from the draw pool immediately; backup keeps the action reversible/auditable if the identification is later disputed. Deleting rows (vs marking) required burning the code strings separately — see #55. |
| 54 | Permanent block mechanism for flagged accounts | participants.blocked boolean, checked at the single code-generation chokepoint and a new single email chokepoint | 2026-06-30 | "Forever" must be enforced in code, not vigilance. One guarded chokepoint per concern (generation, email) means every path — pipeline, manual approval, future scripts — inherits the block automatically. |
| 55 | Prevent revoked codes from ever being reissued | New burned_codes table; generateUniqueCode rejects any string present in it | 2026-06-30 | Deleting the fraud codes removed them from the codes table, so the unique constraint no longer protected those strings — the generator could theoretically reissue one to a legitimate customer. The burned list is the permanent guard. |
| 56 | Over-approval correction protocol | Excess codes are deleted AND burned in burned_codes (never merely deleted), counts corrected, amount backfilled, transparent correction email sent (dry-run first) | 2026-07-31 | Deleting without burning would let the generator reissue those strings (same reasoning as decision #55). Established as the standard for any future over-approval. |
| 57 | Winning-code exclusion implemented in code, not process | lib/draw-exclusions.ts is the single source of truth; both snapshot surfaces (script + API route) apply the same filter | 2026-07-31 | Decision #52 had been recorded as done but never implemented — the handoff lied. A single shared module means the two export paths can never drift apart. |
| 58 | Live count vs export divergence is expected | /admin/sorteio live count = export line count + number of excluded past winners | 2026-07-31 | The live count reads the codes table unfiltered; the export applies exclusions. Documented so nobody "fixes" it. |

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
- **Smoke-test override flag appeared broken (June 28).** Log lines showed real customer addresses as recipients despite the `--to` flag being set. Investigation: log statement printed `p.email` (the audience record) instead of `to` (the actual recipient passed to Resend). Resend dashboard confirmed both sends correctly went to the override address. Behavior is correct; log is cosmetically wrong. Fix queued for post-June 30.
- **Draw block missing on first smoke test of Part B (June 28).** `DRAW_ANNOUNCEMENT_ACTIVE` env var was missing from `.env.local` — only 2 of the 3 vars had been appended. Fixed by `echo "DRAW_ANNOUNCEMENT_ACTIVE=true" >> .env.local`. Reinforced the verify-on-disk reflex even when the agent reports the change was made.
- **`source .env.local` produces `command not found` errors (June 28).** Shell treats malformed `.env.local` lines AND the unquoted space in `DRAW_DATE_DISPLAY=30 de junho` (shell reads `de` as a command) as errors. Harmless because `tsx`/dotenv reads `.env.local` directly without going through the shell. No fix needed; documented as expected noise when sourcing.

---

## 11. Current database structure

**Table: `participants`** — customer registrations
id, nickname, full_name, cpf, whatsapp, email (mandatory), amount_spent, code_count, store_origin, lgpd_consent, created_at

**Table: `receipts`** — uploaded receipt records
id, participant_id (FK), cpf, storage_path, status (uploaded | processing | approved | rejected | needs_review | awaiting_reupload), receipt_number, receipt_date, ai_processed_at, ai_confidence, ai_raw_response (jsonb), reviewed_at, reviewed_by, rejection_reason, cnpj_on_receipt, amount_on_receipt, reupload_request_sent_at, manual_review_email_sent_at. (Corrected July 1: the real column names are storage_path and amount_on_receipt, verified against the live DB — earlier prose listed image_path and amount_total_brl, which do not exist.)
Dedupe index on (receipt_number, receipt_date, cnpj_on_receipt).

**Table: `codes`** — generated sweepstakes codes
id, code (unique, PXP-2026-XXXXX), participant_id (FK), receipt_id (FK), created_at

**Table: `error_logs`** — operational error monitoring
id, source, error_message, error_details (jsonb), created_at

All tables have RLS enabled. **Storage bucket:** `receipts` (private).

**Schema drift note:** RECONCILED July 1 (commit 16e620c). schema.sql now matches the live DB — awaiting_reupload in the receipts.status CHECK, the reupload_request_sent_at + manual_review_email_sent_at columns, participants.blocked, and the campaign_state + burned_codes tables are all documented. Verified against information_schema/pg_constraint/pg_policy before editing.

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
- Winning code (June 30 draw): PXP-2026-UF3EV (winner Rodrigo). MUST be added to the snapshot exclusion list at the next draw (decision #52). Currently the exclusion list is seeded empty.
- Three env vars added June 28 for the draw announcement system: `DRAW_ANNOUNCEMENT_ACTIVE` (string `'true'`/`'false'`), `DRAW_DATE_DISPLAY` (string e.g. `'30 de junho'`), `DRAW_INSTAGRAM_HANDLE` (string e.g. `'paninixp'`). Set in Vercel Environment Variables (All Environments). After June 30 draw: flip `DRAW_ANNOUNCEMENT_ACTIVE=false` to deactivate all draw blocks without a deploy.

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
- `DRAW_ANNOUNCEMENT_ACTIVE` (string `'true'`/`'false'` — feature flag for draw block injection in customer emails)
- `DRAW_DATE_DISPLAY` (string e.g. `'30 de junho'` — human-readable draw date shown in draw block)
- `DRAW_INSTAGRAM_HANDLE` (string e.g. `'paninixp'` — Instagram handle shown in draw block CTA)

Key recovery sources: Vercel env vars (dashboard) and Supabase dashboard (legacy API keys tab). The previous Apple Notes claim was incorrect — verified July 31 when .env.local had to be rebuilt from scratch.

---

## 15. Last commit and branch state

- **Last commit:** b059931 — feat(admin): hide winner internal-data zone by default behind a toggle
- **Working tree:** clean (after this handoff commit lands)
- **Vercel deploy:** b059931 deployed and verified live at app.paninixp.com.br/admin/sorteio/vencedor
- **Prior HEAD before today:** 9866cc6 (June 29 handoff commit)

---

## 16. The exact next step

**Task A — draw #2 winner thread:** notify Minicraque (PXP-2026-R6LTS) via the send-winner-email.ts pattern (dry-run to Leonardo's inbox first, Resend dashboard confirmation before live send). Then add PXP-2026-R6LTS to lib/draw-exclusions.ts for draw #3, commit, deploy, verify on production export.
**Task B (deferred list, recommended next pick):** ADMIN_PASSWORD migration from hardcoded 'panini2026' in lib/admin-auth.ts to a Vercel env var.
**Also deferred:** send-draw-announcement.ts log-line fix, EBANCAS store-signature matcher, 34 timeout receipts, no-email export, API key rotation, manual-approval amount capture (new, see Section 8).

---

## 17. Suggested checkpoint

**June 26 morning, before opening the admin review page:** Estimate how many receipts you realistically expect to clear today and by when. If "all 791 by 4pm" feels unrealistic given the day's commitments, commit upfront to the announcement email going out with the queue at, say, 400 — and accept that the remaining 400 customers will get their outcome email in the days following the announcement rather than holding the entire batch hostage to a perfect queue clear.

**June 29 morning, before opening the queue:** Post-blast morning. Open Resend's delivery dashboard first. The 1,297-customer blast had a 0.08% failure rate at send time (1 of 1,297); see what the actual delivery rate looks like and whether any new patterns surfaced overnight (Gmail/Outlook/Yahoo bounces, spam-folder reports via complaints). The Resend dashboard tells you what the smoke test could not.
