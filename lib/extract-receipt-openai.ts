import OpenAI from 'openai'
import type { ImageMimeType, ExtractedData } from './extract-receipt'

const openai = new OpenAI()

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

Respond ONLY with a valid JSON object matching the schema above. Do not include any other text, explanation, or markdown formatting.`

export async function extractReceiptOpenAI(
  imageBase64: string,
  mimeType: ImageMimeType
): Promise<ExtractedData> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0,
      max_tokens: 1024,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'receipt_extraction',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              is_receipt: { type: 'boolean' },
              is_readable: { type: 'boolean' },
              cnpj: { anyOf: [{ type: 'string' }, { type: 'null' }] },
              amount_total_brl: { anyOf: [{ type: 'number' }, { type: 'null' }] },
              receipt_number: { anyOf: [{ type: 'string' }, { type: 'null' }] },
              receipt_date: { anyOf: [{ type: 'string' }, { type: 'null' }] },
              confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
              notes: { type: 'string' },
            },
            required: [
              'is_receipt',
              'is_readable',
              'cnpj',
              'amount_total_brl',
              'receipt_number',
              'receipt_date',
              'confidence',
              'notes',
            ],
            additionalProperties: false,
          },
        },
      },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${imageBase64}` },
            },
            {
              type: 'text',
              text: EXTRACTION_PROMPT,
            },
          ],
        },
      ],
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('OpenAI returned empty response')
    }

    return JSON.parse(content) as ExtractedData
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    throw new Error(`AI extraction failed: ${reason}`)
  }
}
