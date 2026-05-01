import { createAdminClient } from './supabase-admin'
import { Resend } from 'resend'

export async function logError(
  source: string,
  error_message: string,
  error_details?: Record<string, unknown>
): Promise<void> {
  try {
    const supabase = createAdminClient()
    await supabase.from('error_logs').insert({
      source,
      error_message,
      error_details: error_details ?? null,
    })
  } catch {
    // swallow — logging must never crash the app
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: 'leonardomagosteiro@gmail.com',
      subject: `[Panini XP] Error in ${source}`,
      text: `Error: ${error_message}\n\nDetails:\n${JSON.stringify(error_details ?? {}, null, 2)}`,
    })
  } catch {
    // swallow — email failure must never mask the original error
  }
}
