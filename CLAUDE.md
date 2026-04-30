# Panini XP 2026 — Promotional Campaign Platform

## Core Principle: Honesty Over Comfort
- If something doesn't work, say "NOT WORKING"
- If you haven't tested it, say "NOT TESTED"
- If there are errors, show the actual error message
- If tasks remain undone, list what's missing

## Critical Prohibitions
- NO BULK OPERATIONS — one file at a time, test each change
- NO UNTESTED CLAIMS — don't say it works unless verified
- NO FIND/REPLACE ACROSS MULTIPLE FILES — this destroys applications
- NO EMOJIS — they cause encoding issues and break things
- NO DATABASE SCHEMA CHANGES without explicit permission from Leonardo:
  - No new tables
  - No new fields or columns
  - No renaming tables or columns
  - No dropping tables or columns
  - No altering data types
  - ALWAYS ASK FIRST for any database structural changes

## Mandatory Process
1. Make ONE change
2. Test it actually works
3. Report honestly what happened
4. Only then proceed to next change

## What This Project Is
A web platform for the Panini XP FIFA World Cup 2026 promotional campaign.
Customers register in one of 10 store locations, submit their purchase amount, and receive unique codes.
Every R$50 spent = 1 code. Codes are used in a prize draw.

## Current Phase
Phase 2 in progress — receipt upload built, code generation pending.

## Tech Stack
- Next.js 14 with App Router and TypeScript (scope: /cadastro, /confirmacao, /ranking, /privacidade)
- Tailwind CSS for styling
- Supabase (São Paulo region) for database and backend
- Vercel for hosting
- Unicorn Platform for the landing page (external, not part of this Next.js app)
- A standalone JavaScript snippet embeds the live participant counter in Unicorn Platform via Supabase

## Pages (Next.js scope — landing page is NOT here)
- /cadastro → Registration form (for in-store QR code traffic)
- /confirmacao → Shows generated codes after registration
- /enviar-recibo → Receipt upload page (Phase 2 — built tonight)
- /ranking → Public leaderboard (nickname + code count only)
- /privacidade → LGPD privacy policy

## Database Tables
- participants: stores customer data (most fields private/LGPD)
- codes: stores generated codes linked to participants
- receipts: stores uploaded receipt records linked to participants (Phase 2)

## Supabase Storage
- Bucket: receipts — holds receipt images uploaded by customers

## Phase 2 — Tonight's Scope (Receipt Upload)
BUILT TONIGHT:
1. receipts table linked to participants (by participant_id and CPF)
2. Supabase Storage bucket for receipt images
3. /enviar-recibo page — customer enters CPF, selects receipt photo, uploads
4. After upload: confirmation message "Recibo recebido. Voce sera notificado em breve com seu codigo."
5. Receipt stored and linked to participant, awaiting processing

DEFERRED (not tonight):
- AI validation of CNPJ and amount
- Automatic code generation
- Admin manual review page
- Email/WhatsApp notification to customer
- Returning customer email blast

## Business Constants
- DMCAMP CNPJ (for future validation): 07.348.198/0001-48
- Code generation rule (for future): 1 code per R$50 (floor division)
- Code format (for future): PXP-2026-XXXXX (X = random uppercase alphanumeric)

## Public vs Private Data
- PUBLIC (visible in ranking): nickname, code_count
- PRIVATE (never exposed): full_name, cpf, whatsapp, email, amount_spent

## Rules
- All customer-facing copy must be in Brazilian Portuguese
- Never expose private fields in any public query or API call
- Never modify the database schema without asking Leonardo first
- Always validate CPF uniqueness before inserting a new participant
- The .env.local file must never be committed to GitHub

## Coding Style
- Mobile-first design (most users will be on phones)
- Show loading states during all form submissions
- All error messages must be in Brazilian Portuguese
- Keep components simple — this is a non-technical founder's project
