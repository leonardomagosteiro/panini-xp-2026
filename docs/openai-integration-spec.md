# OpenAI Integration Spec

**Status:** Spec finalized May 9, 2026 - ready to build
**Build target:** This session, before 9:45am Brazil time
**Owner:** Leonardo Magosteiro

## 1. Purpose

Replace Claude vision (60% false-rejection rate on CNPJ) with OpenAI vision for receipt data extraction. Keep Claude implementation intact and toggleable via env var so we can revert in 30 seconds if OpenAI underperforms or fails.

## 2. Scope

In scope:
- New file lib/extract-receipt-openai.ts exporting extractReceiptOpenAI(imageBase64, mimeType) - same signature and return type as existing extractReceipt
- Env-var toggle in lib/process-receipt.ts to choose provider per-call
- Same prompt and JSON schema as the Claude extractor
- Use OpenAI Structured Outputs for guaranteed JSON compliance

Out of scope:
- Removing Claude code (kept as fallback)
- Changing validation rules, email templates, database schema
- Reprocessing existing rejected receipts (separate session, post-launch)

## 3. Architecture decisions (locked)

- Model: gpt-4o (vision-capable, ~$0.01/receipt)
- Output format: OpenAI Structured Outputs (response_format json_schema)
- Image input: Base64 data URL (same as Claude)
- Temperature: 0
- Max tokens: 1024
- Toggle env var: AI_EXTRACTION_PROVIDER with values claude or openai
- Default if env unset: claude (safe default)
- Error fallback: NO silent fallback. If OpenAI throws, throw to caller. process-receipt's existing error handling routes to needs_review.
- Logging: attach provider name to ai_raw_response._provider for audit

## 4. Implementation requirements

### 4.1 Install dependency
npm install openai

### 4.2 New file: lib/extract-receipt-openai.ts
- Export async function extractReceiptOpenAI(imageBase64: string, mimeType: ImageMimeType): Promise<ExtractedData>
- Same signature as extractReceipt - base64 string + mimeType, not a File object
- Import ExtractedData and ImageMimeType from ./extract-receipt (both already exported there)
- Build OpenAI Chat Completions request: model gpt-4o, temperature 0, max_tokens 1024
- Use OpenAI Structured Outputs: response_format: { type: "json_schema", json_schema: { name: "receipt_extraction", strict: true, schema: {...} } }
- Nullable fields in strict mode use anyOf: [{type: "string"}, {type: "null"}] pattern
- The JSON schema must match exactly what validator expects (same fields as Claude returns)
- Use the SAME prompt text as Claude extractor - copied verbatim
- Parse response, return as ExtractedData
- On any error, throw with clear message - NO internal fallback to Claude

### 4.3 Modified file: lib/process-receipt.ts
At the start of Step 5 (before extraction call), add provider detection:

const provider = process.env.AI_EXTRACTION_PROVIDER === 'openai' ? 'openai' : 'claude'

Replace extractReceipt call with conditional:

extracted = provider === 'openai'
  ? await extractReceiptOpenAI(imageBase64, mimeType)
  : await extractReceipt(imageBase64, mimeType)

When persisting ai_raw_response in Step 6, attach the provider so we can audit later:
ai_raw_response: { ...extracted, _provider: provider }

### 4.4 Environment variables
- OPENAI_API_KEY: already added to .env.local
- AI_EXTRACTION_PROVIDER: NEW. Add to .env.local with value claude. Leonardo will add it to Vercel manually.

## 5. Failure modes

- OpenAI API key missing/invalid: throw, route to needs_review
- OpenAI API down: throw, route to needs_review
- OpenAI returns malformed JSON: structured outputs prevents this; if it still happens, throw, route to needs_review
- Env var unset: default to claude. Safe.
- Image too large: same as Claude today, route to needs_review

NO silent fallback from OpenAI to Claude. If OpenAI fails, receipt goes to manual review. Production issues stay visible.

## 6. Build order

1. npm install openai
2. Create lib/extract-receipt-openai.ts
3. Modify lib/process-receipt.ts with the toggle
4. Add AI_EXTRACTION_PROVIDER=claude to .env.local
5. Commit each logical change separately:
   - feat(ai): add openai sdk dependency
   - feat(ai): add OpenAI-based receipt extractor with structured outputs
   - feat(ai): add provider toggle to process-receipt orchestrator
6. Push

DO NOT run any tests yet. Do NOT modify Vercel env vars. Leonardo will:
- Add AI_EXTRACTION_PROVIDER=claude to Vercel manually
- Test locally with AI_EXTRACTION_PROVIDER=openai before flipping production
- Only flip Vercel to openai after local verification

## 7. Update protocol

After implementation:
- Update docs/PROJECT_HANDOFF.md section 9 (Decisions) to mark decision #15 as resolved
- Update section 7 (What's working) to add OpenAI extractor
- Update section 8 (What's broken) to remove Claude CNPJ issue once OpenAI is confirmed working
- Update section 20 (Session log)
