import { sendEmail } from './mailer'
import { prisma }   from '../lib/prisma'

// ── Template engine ───────────────────────────────────────────

interface TemplateParams {
  toName?:           string
  facilityName?:     string
  password?:         string
  patientName?:      string
  appointmentType?:  string
  appointmentDate?:  string
  encounterLink?:    string
  resultLink?:       string
  orderLink?:        string
  newsletterTitle?:  string
  newsletterBody?:   string
}

interface EmailTemplate {
  subject: string
  html:    string
}

const BASE_URL = process.env.FRONTEND_URL ?? 'https://health.atlis.com.ng'

export function getTemplate(key: string, params: TemplateParams = {}): EmailTemplate {
  const {
    toName           = 'there',
    facilityName     = 'Atlis Health',
    password,
    patientName,
    appointmentType,
    appointmentDate,
    encounterLink,
    resultLink,
    orderLink,
    newsletterTitle,
    newsletterBody,
  } = params

  switch (key) {

    case 'STAFF_WELCOME':
      return {
        subject: `Welcome to ${facilityName}`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px">
            <h2 style="color:#0F172A">Welcome, ${toName}!</h2>
            <p>Your account has been created at <strong>${facilityName}</strong>.</p>
            ${password ? `<p>Your temporary password is: <strong style="font-family:monospace;background:#F0F4FF;padding:2px 6px;border-radius:4px">${password}</strong></p>` : ''}
            <p>Please log in and change your password immediately.</p>
            <a href="${BASE_URL}/login" style="display:inline-block;margin-top:12px;padding:10px 20px;background:#5580F4;color:#fff;text-decoration:none;border-radius:8px">Log In</a>
          </div>`,
      }

    case 'APPOINTMENT_BOOKED':
      return {
        subject: `New Appointment: ${patientName ?? 'Patient'}`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px">
            <h2 style="color:#0F172A">New Appointment</h2>
            <p>You have a new <strong>${appointmentType ?? 'appointment'}</strong> with <strong>${patientName ?? 'a patient'}</strong>${appointmentDate ? ` on ${appointmentDate}` : ''}.</p>
            ${encounterLink ? `<a href="${BASE_URL}${encounterLink}" style="display:inline-block;margin-top:12px;padding:10px 20px;background:#5580F4;color:#fff;text-decoration:none;border-radius:8px">Open Encounter</a>` : ''}
          </div>`,
      }

    case 'RESULT_READY':
      return {
        subject: 'Result Ready for Review',
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px">
            <h2 style="color:#0F172A">Result Ready</h2>
            <p>A result for <strong>${patientName ?? 'a patient'}</strong> has been released and is ready for your review.</p>
            ${resultLink ? `<a href="${BASE_URL}${resultLink}" style="display:inline-block;margin-top:12px;padding:10px 20px;background:#5580F4;color:#fff;text-decoration:none;border-radius:8px">View Result</a>` : ''}
          </div>`,
      }

    case 'NEWSLETTER':
      return {
        subject: newsletterTitle ?? 'Update from Atlis Health',
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px">
            ${newsletterTitle ? `<h2 style="color:#0F172A">${newsletterTitle}</h2>` : ''}
            ${newsletterBody ? `<div style="color:#475569;line-height:1.6">${newsletterBody}</div>` : ''}
            <p style="color:#94A3B8;font-size:12px;margin-top:24px;border-top:1px solid #EEF1F8;padding-top:12px">Sent by ${facilityName} via Atlis Health</p>
          </div>`,
      }

    default:
      return {
        subject: 'Notification',
        html:    `<p>You have a new notification from ${facilityName}.</p>`,
      }
  }
}

// ── Send using a template key ─────────────────────────────────

export async function sendTemplateEmail(params: {
  key:            string
  to:             string | string[]
  templateParams?: TemplateParams
  tenantId:       string
}) {
  const { key, to, templateParams, tenantId } = params
  const template = getTemplate(key, templateParams)

  const result = await sendEmail({
    to:      to,
    subject: template.subject,
    html:    template.html,
  })

  // Log to DB
  await prisma.emailLog.create({
    data: {
      tenantId,
      toEmail:  Array.isArray(to) ? to.join(', ') : to,
      subject:  template.subject,
      body:     template.html,
      status:   result.success ? 'SENT' : 'FAILED',
      error:    result.error ?? null,
    },
  }).catch(() => {})

  return result
}