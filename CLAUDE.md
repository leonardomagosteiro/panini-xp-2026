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
Customers register, submit their purchase amount, and receive unique codes.
Every R$50 spent = 1 code. Codes are used in a prize draw.

## Tech Stack
- Next.js 14 with App Router and TypeScript
- Tailwind CSS for styling
- Supabase (São Paulo region) for database and backend
- Vercel for hosting

## Pages
- / → Landing page (for social media traffic)
- /cadastro → Registration form (for in-store QR code traffic)
- /confirmacao → Shows generated codes after registration
- /ranking → Public leaderboard (nickname + code count only)
- /privacidade → LGPD privacy policy

## Database Tables
- participants: stores customer data (most fields private/LGPD)
- codes: stores generated codes linked to participants

## Public vs Private Data
- PUBLIC (visible in ranking): nickname, code_count
- PRIVATE (never exposed): full_name, cpf, whatsapp, email, amount_spent

## Rules
- All customer-facing copy must be in Brazilian Portuguese
- Never expose private fields in any public query or API call
- Never modify the database schema without asking Leonardo first
- Always validate CPF uniqueness before inserting a new participant
- Code format: PXP-2026-XXXXX (X = random uppercase alphanumeric)
- One code generated per R$50 spent (floor division)
- The .env.local file must never be committed to GitHub

## Coding Style
- Mobile-first design (most users will be on phones)
- Show loading states during all form submissions
- All error messages must be in Brazilian Portuguese
- Keep components simple — this is a non-technical founder's project
