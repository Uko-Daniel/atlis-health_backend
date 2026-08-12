import type { NotificationType } from '../../generated/prisma/client'

// ── Create notification input ─────────────────────────────────

export interface CreateNotificationInput {
  tenantId: string
  userId:   string
  type:     NotificationType
  title:    string
  body:     string
  link?:    string
}

// ── Notification + Email together ────────────────────────────

export interface NotifyUserInput {
  tenantId:     string
  userId:       string
  userEmail:    string
  type:         NotificationType
  title:        string
  body:         string
  link?:        string
  emailSubject?: string
  emailHtml?:    string
}

// ── Notification response shape ──────────────────────────────

export interface NotificationResponse {
  id:        string
  tenantId:  string
  userId:    string
  type:      NotificationType
  title:     string
  body:      string
  link:      string | null
  isRead:    boolean
  createdAt: string
}

// ── Email log shape ──────────────────────────────────────────

export interface EmailLogResponse {
  id:        string
  tenantId:  string
  toEmail:   string
  subject:   string
  body:      string
  status:    'SENT' | 'FAILED' | 'BOUNCED'
  error:     string | null
  createdAt: string
}