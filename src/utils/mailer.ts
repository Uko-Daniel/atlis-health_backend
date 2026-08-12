import { Resend } from 'resend'

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? ''
const FROM_EMAIL = process.env.FROM_EMAIL ?? 'noreply@atlis.com.ng'
const FROM_NAME = process.env.FROM_NAME ?? 'Atlis Health'

let resend: Resend | null = null
if (RESEND_API_KEY) {
  resend = new Resend(RESEND_API_KEY)
}

interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
  text?: string
}

export async function sendEmail({ to, subject, html, text }: SendEmailOptions): Promise<{ success: boolean; error?: string }> {
  // Dev mode – log to console if no API key
  if (!resend) {
    console.log(`[MAILER DEV] To: ${Array.isArray(to) ? to.join(', ') : to}`)
    console.log(`[MAILER DEV] Subject: ${subject}`)
    console.log(`[MAILER DEV] Body (text): ${text ?? html.replace(/<[^>]+>/g, '')}`)
    return { success: true }
  }

  try {
    const emailData: {
      from: string
      to: string[]
      subject: string
      html: string
      text?: string
    } = {
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    }

    if (text !== undefined) {
      emailData.text = text
    }

    await resend.emails.send(emailData)
    return { success: true }
  } catch (err: any) {
    console.error('[MAILER ERROR]', err)
    return { success: false, error: err?.message ?? 'Unknown error' }
  }
}