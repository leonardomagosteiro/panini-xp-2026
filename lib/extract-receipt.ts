import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

const EXTRACTION_PROMPT = `You are a receipt data extraction system for a Brazilian retail campaign.

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

Respond ONLY with a valid JSON object matching the schema above. Do not include any other text, explanation, or markdown formatting.`;

export type ImageMimeType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

type Confidence = 'high' | 'medium' | 'low';

export type ExtractedData = {
  is_receipt: boolean;
  is_readable: boolean;
  cnpj: string | null;
  amount_total_brl: number | null;
  receipt_number: string | null;
  receipt_date: string | null;
  confidence: Confidence;
  notes: string;
};

function stripMarkdownFences(text: string): string {
  const match = text.match(/^```(?:json)?\n?([\s\S]*?)\n?```$/);
  return match ? match[1].trim() : text.trim();
}

function validateExtractedData(raw: unknown): ExtractedData {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('AI response missing required fields: is_receipt, is_readable, cnpj, amount_total_brl, receipt_number, receipt_date, confidence, notes');
  }

  const obj = raw as Record<string, unknown>;
  const missing: string[] = [];

  if (typeof obj['is_receipt'] !== 'boolean') missing.push('is_receipt');
  if (typeof obj['is_readable'] !== 'boolean') missing.push('is_readable');
  if (obj['cnpj'] !== null && typeof obj['cnpj'] !== 'string') missing.push('cnpj');
  if (obj['amount_total_brl'] !== null && typeof obj['amount_total_brl'] !== 'number') missing.push('amount_total_brl');
  if (obj['receipt_number'] !== null && typeof obj['receipt_number'] !== 'string') missing.push('receipt_number');
  if (obj['receipt_date'] !== null && typeof obj['receipt_date'] !== 'string') missing.push('receipt_date');
  if (!['high', 'medium', 'low'].includes(obj['confidence'] as string)) missing.push('confidence');
  if (typeof obj['notes'] !== 'string') missing.push('notes');

  if (missing.length > 0) {
    throw new Error(`AI response missing required fields: ${missing.join(', ')}`);
  }

  return {
    is_receipt: obj['is_receipt'] as boolean,
    is_readable: obj['is_readable'] as boolean,
    cnpj: obj['cnpj'] as string | null,
    amount_total_brl: obj['amount_total_brl'] as number | null,
    receipt_number: obj['receipt_number'] as string | null,
    receipt_date: obj['receipt_date'] as string | null,
    confidence: obj['confidence'] as Confidence,
    notes: obj['notes'] as string,
  };
}

export async function extractReceipt(
  imageBase64: string,
  mimeType: ImageMimeType
): Promise<ExtractedData> {
  let responseText: string;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: EXTRACTION_PROMPT,
            },
          ],
        },
      ],
    });

    const block = response.content[0];
    if (block.type !== 'text') {
      throw new Error('unexpected response content type from API');
    }
    responseText = block.text;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`AI extraction failed: ${reason}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripMarkdownFences(responseText));
  } catch {
    throw new Error('AI returned malformed JSON');
  }

  return validateExtractedData(parsed);
}
