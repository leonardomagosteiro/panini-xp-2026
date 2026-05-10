# Email Communication Audit
**Generated:** 2026-05-09
**Scope:** All customer-facing emails in the Panini XP system
**Status:** Read-only audit — no code changes made

---

## 1. Email Inventory

### 1a. Official email functions (lib/send-receipt-emails.ts)

| ID | Function | Subject | isDelayedAnalysis? | Notes |
|----|----------|---------|-------------------|-------|
| A | `sendReceiptApproved` | "Seus códigos chegaram — Panini XP" | No | Lists all generated codes. Unique — no delayed variant needed. |
| B | `sendReceiptRejectedNotReceipt` | "Não conseguimos processar seu envio — Panini XP" | Yes | Asks customer to resubmit a valid receipt image. |
| C | `sendReceiptRejectedInvalidCnpj` | "Recibo não elegível — Panini XP" | Yes | Informs customer the store CNPJ is not in the campaign. |
| D | `sendReceiptRejectedAmountTooLow` | "Recibo recebido, mas abaixo do valor mínimo — Panini XP" | Yes | Informs customer their total is below R$50. |
| E | `sendReceiptRejectedDateOutOfWindow` | "Recibo fora do período da campanha — Panini XP" | Yes | Informs customer the receipt date is outside campaign window. |
| F | `sendReceiptRejectedDuplicate` | "Recibo já registrado — Panini XP" | Yes | Informs customer the receipt was already submitted. |
| G | `sendReceiptPleaseReupload` | "Não conseguimos ler seu recibo — Panini XP" | Yes | Asks customer to retake photo with guidance (lighting, flatness, etc.). |
| H | `sendReceiptReuploadRequest` | "Precisamos de uma foto melhor — Panini XP" | No | New automated re-upload request path (awaiting_reupload). |
| I | `sendReceiptManualReviewNotification` | "Estamos analisando seu recibo — Panini XP" | No | Tells customer their receipt is under manual review (up to 48h). |

**Params common to all:** `participantId, email, nickname, uploadDate`
**Additional param:** Email A requires `codes` (string[]) and `amountBrl` (number). Email D requires `amountBrl`.

### 1b. Inline emails NOT in send-receipt-emails.ts

| Location | Subject | Trigger | Customer-facing? |
|----------|---------|---------|-----------------|
| `app/api/upload-recibo/route.ts:105` | "Recibo recebido — Panini XP" | On every successful file upload (if participant.email exists) | Yes |
| `scripts/send-catchup.ts` | "Recibo recebido — Panini XP" | One-time blast: participants who uploaded before 2026-05-02T13:00:00Z | Yes |
| `scripts/send-reminders.ts` | "Não perca o sorteio da Copa, {nickname}!" | Manual blast: participants registered but never uploaded a receipt | Yes |
| `scripts/send-rejection-recovery.ts` | "Vamos revisar seu recibo — Panini XP" | Manual blast: all participants with any rejected receipt | Yes |
| `lib/log-error.ts:22` | "[Panini XP] Error in {source}" | Every call to `logError()` — fires for every application error | No (internal, to leonardomagosteiro@gmail.com from onboarding@resend.dev) |

---

## 2. Call Site Map

### Email A — sendReceiptApproved

| Call site | File | Approx. line | Condition | Flags |
|-----------|------|-------------|-----------|-------|
| Auto-processing (AI approved) | `lib/process-receipt.ts` | ~265 | `validation.status === 'approved'` AND `participant.email` not null | none |
| Admin manual approve | `app/api/admin/receipts/[id]/approve/route.ts` | ~70 | Receipt `status === 'needs_review'` AND `participant.email` not null | none |

### Email B — sendReceiptRejectedNotReceipt

| Call site | File | Approx. line | Condition | Flags |
|-----------|------|-------------|-----------|-------|
| Admin manual reject | `app/api/admin/receipts/[id]/reject/route.ts` | ~84 | `reason === 'not_a_receipt'` AND `participant.email` not null | none (no isDelayedAnalysis passed) |
| **NOT called** | `lib/process-receipt.ts` | — | Imported but never called in orchestrator | — |

### Email C — sendReceiptRejectedInvalidCnpj

| Call site | File | Approx. line | Condition | Flags |
|-----------|------|-------------|-----------|-------|
| Admin manual reject | `app/api/admin/receipts/[id]/reject/route.ts` | ~87 | `reason === 'invalid_cnpj'` AND `participant.email` not null | none |
| **NOT called** | `lib/process-receipt.ts` | — | Imported but never called in orchestrator | — |

### Email D — sendReceiptRejectedAmountTooLow

| Call site | File | Approx. line | Condition | Flags |
|-----------|------|-------------|-----------|-------|
| Admin manual reject | `app/api/admin/receipts/[id]/reject/route.ts` | ~90 | `reason === 'amount_too_low'` AND `participant.email` not null | none |
| **NOT called** | `lib/process-receipt.ts` | — | Imported but never called in orchestrator | — |

### Email E — sendReceiptRejectedDateOutOfWindow

| Call site | File | Approx. line | Condition | Flags |
|-----------|------|-------------|-----------|-------|
| Admin manual reject | `app/api/admin/receipts/[id]/reject/route.ts` | ~93 | `reason === 'date_out_of_window'` AND `participant.email` not null | none |
| **NOT called** | `lib/process-receipt.ts` | — | Imported but never called in orchestrator | — |

### Email F — sendReceiptRejectedDuplicate

| Call site | File | Approx. line | Condition | Flags |
|-----------|------|-------------|-----------|-------|
| Auto-processing (duplicate detected) | `lib/process-receipt.ts` | ~287 | `validation.reason === 'duplicate'` AND `participant.email` not null | `isDelayedAnalysis: options?.isDelayedAnalysis ?? false` |
| Admin manual reject | `app/api/admin/receipts/[id]/reject/route.ts` | ~96 | `reason === 'duplicate'` AND `participant.email` not null | none (isDelayedAnalysis not passed) |

### Email G — sendReceiptPleaseReupload

| Call site | File | Approx. line | Condition | Flags |
|-----------|------|-------------|-----------|-------|
| Admin manual reject | `app/api/admin/receipts/[id]/reject/route.ts` | ~99 | `reason === 'unreadable'` AND `participant.email` not null | none |
| **NOT called** | `lib/process-receipt.ts` | — | Imported but never called in orchestrator | — |

### Email H — sendReceiptReuploadRequest

| Call site | File | Approx. line | Condition | Flags |
|-----------|------|-------------|-----------|-------|
| First unreadable upload (first strike) | `lib/process-receipt.ts` | ~326 | `validation.status === 'awaiting_reupload'` AND no prior receipt with `reupload_request_sent_at` set | none |

### Email I — sendReceiptManualReviewNotification

| Call site | File | Approx. line | Condition | Flags |
|-----------|------|-------------|-----------|-------|
| Image too large (>5MB base64) | `lib/process-receipt.ts` | ~148 | `imageBase64.length > BASE64_SIZE_LIMIT` AND `participant.email` set (after email check) | none |
| Image unprocessable by AI (corrupt/unsupported) | `lib/process-receipt.ts` | ~178 | AI throws error matching unprocessable pattern AND `participant.email` set | none |
| Second unreadable upload (second strike, Case A) | `lib/process-receipt.ts` | ~315 | `validation.status === 'awaiting_reupload'` AND prior receipt has `reupload_request_sent_at` not null | none |
| Validator needs_review fallthrough | `lib/process-receipt.ts` | ~344 | `validation.status === 'needs_review'` (covers: low_confidence, incomplete_extraction, not_a_receipt, invalid_cnpj, amount_too_low, date_out_of_window, unreadable, medium_confidence) | none |

**Note on reanalysis script:** `scripts/reanalyze-needs-review.ts` calls `processReceipt(..., { isDelayedAnalysis: true })`. If reprocessed receipts route to needs_review, Email I fires again with no delayed variant (Email I has no isDelayedAnalysis flag). Past backlog run is safe (no Email I existed then). Future reanalysis runs will re-fire Email I.

---

## 3. Customer Journey States

### Receipt status transitions and emails

| From | To | Trigger | Email fired |
|------|----|---------|------------|
| *(new)* | `uploaded` | Customer submits photo via `/enviar-recibo` | **Upload confirmation** ("Recibo recebido") — inline in upload route |
| `uploaded` | `processing` | `processReceipt` starts (marks to prevent double-run) | None |
| `processing` | `approved` | AI extraction succeeds, all validations pass, confidence high | **Email A** — "Seus códigos chegaram" |
| `processing` | `rejected` (duplicate) | Duplicate detection finds matching receipt | **Email F** — "Recibo já registrado" |
| `processing` | `awaiting_reupload` | Pre-check 0 fires (is_readable false, OR low+2 nulls, OR cnpj null) — first strike only | **Email H** — "Precisamos de uma foto melhor" |
| `processing` | `needs_review` | Any of: image_too_large, image_unprocessable, no_email_on_file*, low_confidence, incomplete_extraction, not_a_receipt, invalid_cnpj, amount_too_low, date_out_of_window, unreadable, second_unreadable_upload | **Email I** — "Estamos analisando" (except no_email_on_file — no email possible) |
| `needs_review` | `approved` | Admin manually approves via `/admin/recibos-revisao` | **Email A** — "Seus códigos chegaram" |
| `needs_review` | `rejected` | Admin manually rejects with reason | **Email B/C/D/E/F/G** depending on reason selected |
| `awaiting_reupload` | `needs_review` | 7-day cron (`/api/cron/timeout-reuploads`) — customer never re-uploaded | **None** (silent — intentional per design) |
| `awaiting_reupload` | `uploaded` | Customer re-uploads a new photo | **Upload confirmation** email fires again ("Recibo recebido") |
| `uploaded` (re-upload) | `awaiting_reupload` | Second photo also unprocessable (second strike) | **Email H** again (first strike logic repeats for the new receipt) — OR **Email I** if the new receipt triggers second strike based on the prior receipt |

*no_email_on_file: participant has null email — no email can be sent regardless.

### States with no outbound email

| Status | Who is in this state | Email status |
|--------|---------------------|-------------|
| `awaiting_reupload` | Customer whose first photo was unreadable | Has received Email H. No further email until they re-upload or 7-day cron fires. |
| `needs_review` (no_email_on_file) | Participants without email | No email ever sent. WhatsApp follow-up required. |
| `awaiting_reupload → needs_review` (cron) | Customers who ignored Email H for 7 days | Silent transition. Customer last heard via Email H. No further contact until admin reviews. |

---

## 4. Detected Issues

### Issue 1 — DUPLICATE: Upload confirmation + Email I on every new upload
**Severity: HIGH**
**Category: Duplicate**

Every successful upload fires the inline "Recibo recebido — Panini XP" email immediately. Then `waitUntil(processReceipt(...))` runs in the background. If the receipt routes to `needs_review`, Email I ("Estamos analisando") fires minutes later.

Result: customer receives two emails within minutes — first saying "we got it, codes coming soon", then "we're reviewing it manually". The first email's body ("Em breve você receberá seus códigos") directly contradicts the outcome for ~200 current needs_review receipts.

If the receipt routes to `awaiting_reupload`, the sequence is even worse: upload confirmation → Email H ("precisamos de uma foto melhor") — contradicts "codes coming soon".

If the receipt is auto-approved, the sequence is: upload confirmation → Email A ("seus códigos chegaram") — this is redundant but not contradictory.

### Issue 2 — CONTRADICTION: Upload confirmation body text vs. actual outcomes
**Severity: HIGH**
**Category: Contradiction**

The upload confirmation email says: "Em breve você receberá seus códigos para concorrer aos prêmios da Copa do Mundo 2026." This is only true if the receipt is approved. For needs_review and awaiting_reupload outcomes (which are the majority), this promise is premature and misleading.

### Issue 3 — DUPLICATE: Reanalysis script re-fires Email I
**Severity: MEDIUM**
**Category: Duplicate**

`scripts/reanalyze-needs-review.ts --apply` resets needs_review receipts to `uploaded` and calls `processReceipt`. Any receipt that routes to `needs_review` again will fire Email I to the customer. If a customer's receipt was already in needs_review (meaning they already got Email I from their original upload), they will receive a second Email I.

The May 9 reanalysis run was safe because Email I didn't exist yet at the time of that run. Future runs will cause double Email I.

### Issue 4 — DEAD IMPORTS: Emails B, C, D, E, G imported in orchestrator but never called
**Severity: LOW**
**Category: Obsolete (partial)**

`lib/process-receipt.ts` imports `sendReceiptRejectedNotReceipt`, `sendReceiptRejectedInvalidCnpj`, `sendReceiptRejectedAmountTooLow`, `sendReceiptRejectedDateOutOfWindow`, and `sendReceiptPleaseReupload` — but none of these are called anywhere in the orchestrator. The validator routes not_a_receipt, invalid_cnpj, amount_too_low, date_out_of_window, and unreadable to `needs_review` (not `rejected`), so these emails are only reachable via the admin reject route.

These imports are dead weight and could cause confusion about which emails actually fire automatically.

### Issue 5 — CONTRADICTION: send-rejection-recovery.ts vs. rejection emails already sent
**Severity: MEDIUM**
**Category: Contradiction**

`scripts/send-rejection-recovery.ts` sends "Vamos revisar seu recibo — Panini XP" to all participants with rejected receipts. If a customer already received a rejection email (Email F for duplicates, or an admin rejection email), they now receive a contradictory message saying their receipt will be manually reviewed. This script appears to be a one-time recovery blast and may already have been run — but re-running it in the future would cause contradictions.

### Issue 6 — DUPLICATE RISK: send-reminders.ts has no run-tracking
**Severity: MEDIUM**
**Category: Edge case**

`scripts/send-reminders.ts` has no guard against being run twice. It queries participants with no receipts and sends them a reminder. Running it twice in the same day sends each eligible participant two identical reminder emails. No idempotency mechanism exists.

### Issue 7 — DUPLICATE: send-catchup.ts subject matches upload confirmation
**Severity: LOW**
**Category: Duplicate**

`scripts/send-catchup.ts` sends "Recibo recebido — Panini XP" — the same subject as the inline upload confirmation. Participants who uploaded before the cutoff would have received both. This was presumably a one-time blast, but the identical subject makes the emails indistinguishable in a customer's inbox.

### Issue 8 — GAP: No email when awaiting_reupload expires via 7-day cron
**Severity: LOW (intentional)**
**Category: Gap**

When the cron silently moves `awaiting_reupload → needs_review` after 7 days, no email is sent. The customer's last contact was Email H asking them to re-upload. They then go silent. If Leonardo's admin review finds the original photo acceptable and approves it, the customer receives Email A — which may feel surprising after 7+ days of silence.

Decision already documented as intentional in Task 6 design. Flagging for awareness.

### Issue 9 — GAP: Admin approve does not guard against double Email A
**Severity: LOW**
**Category: Edge case**

The admin approve route sends Email A whenever `participant.email` is not null, without checking whether Email A was already sent (e.g., from a previous auto-approval attempt that partially failed). In normal flow this is safe, but if a receipt somehow ended up back in `needs_review` after a partial auto-approval, the admin could re-approve and send a second Email A.

### Issue 10 — Admin reject does not pass isDelayedAnalysis
**Severity: LOW**
**Category: Edge case**

When admin manually rejects a receipt with reason `duplicate`, `sendReceiptRejectedDuplicate` is called without an `isDelayedAnalysis` flag. The customer does not get the "Recebemos seu recibo há alguns dias" prefix. This is probably correct for most admin rejections (which happen within days), but worth noting as a behavioral inconsistency vs. the orchestrator's duplicate path which does pass the flag.

---

## 5. Recommendations

*All decisions pending Leonardo's review. Recommendations only.*

| Issue | Severity | Proposed action |
|-------|----------|----------------|
| 1 — Upload confirmation + Email I duplicate | HIGH | Remove or rewrite the inline upload confirmation to not promise "codes coming soon". Replace with a neutral "we received your receipt and are processing it" body that holds up regardless of outcome. OR suppress Email I when the receipt was just uploaded (i.e., not a re-analysis). |
| 2 — Upload confirmation body contradicts outcomes | HIGH | Same fix as Issue 1 — rewrite body to be outcome-neutral. |
| 3 — Reanalysis re-fires Email I | MEDIUM | Add an `isDelayedAnalysis` flag to Email I and suppress it in reanalysis runs. OR track `manual_review_email_sent_at` on the receipt row and skip if already sent. |
| 4 — Dead imports B, C, D, E, G in orchestrator | LOW | Remove the dead imports from `lib/process-receipt.ts`. The functions themselves remain available for the admin reject route. |
| 5 — send-rejection-recovery.ts contradiction | MEDIUM | Do not re-run this script. If a second recovery blast is ever needed, use a different subject/body that matches current customer state. |
| 6 — send-reminders.ts no idempotency | MEDIUM | Add a `--confirm` guard or track sends in a DB table before running again. |
| 7 — send-catchup.ts duplicate subject | LOW | One-time script, likely already run. No action needed unless run again. |
| 8 — 7-day cron silent transition | LOW | No action needed per current design. Consider a follow-up email ("We're still working on your receipt") when admin approves from this queue. |
| 9 — Admin double Email A risk | LOW | Add a check for existing approved codes before sending Email A from admin route. |
| 10 — Admin reject no isDelayedAnalysis | LOW | Accept as-is or add `isDelayedAnalysis: true` to admin reject baseParams (most admin rejections are delayed by definition). |
