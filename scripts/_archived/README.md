# Archived Scripts

These scripts were used during Phase 1 of the campaign and are no longer safe to run.
Each was flagged by the email communication audit (docs/email-communication-audit.md) as
having one or more of the following issues:

- No idempotency guards (would send duplicate emails if re-run)
- Subject lines or content that contradicts current customer-state emails
- Built for a system that no longer exists (pre-AI extraction era)

DO NOT RUN these scripts. They are kept here only for git-history reference.
If a similar batch operation is needed in the future, build a new script with proper
guards and align it with the current email map.

— Archived 2026-05-09 by Phase 2.5 audit cleanup
