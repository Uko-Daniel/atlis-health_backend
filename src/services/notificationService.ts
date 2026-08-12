import { prisma } from '../lib/prisma'
import { sendEmail } from '../utils/mailer'
import type { NotificationType } from '../../generated/prisma/client'
import type {
  CreateNotificationInput,
  NotifyUserInput,
  NotificationResponse,
  EmailLogResponse,
} from '../types/notification'

// ── In‑app notification ──────────────────────────────────────

export async function createNotification(input: CreateNotificationInput): Promise<NotificationResponse> {
  const notif = await prisma.notification.create({
    data: {
      tenantId: input.tenantId,
      userId:   input.userId,
      type:     input.type,
      title:    input.title,
      body:     input.body,
      link:     input.link ?? null,
    },
  })

  return {
    id:        notif.id,
    tenantId:  notif.tenantId,
    userId:    notif.userId,
    type:      notif.type,
    title:     notif.title,
    body:      notif.body,
    link:      notif.link,
    isRead:    notif.isRead,
    createdAt: notif.createdAt.toISOString(),
  }
}

// ── Email + notification together ────────────────────────────

export async function notifyUser(options: NotifyUserInput): Promise<void> {
  // 1. Create in‑app notification
  await createNotification({
    tenantId: options.tenantId,
    userId:   options.userId,
    type:     options.type,
    title:    options.title,
    body:     options.body,
    ...(options.link ? { link: options.link } : {}),
  })

  // 2. Send email (fire‑and‑forget)
  if (options.emailSubject && options.emailHtml) {
    sendEmail({
      to:      options.userEmail,
      subject: options.emailSubject,
      html:    options.emailHtml,
    }).then((result) => {
      prisma.emailLog.create({
        data: {
          tenantId: options.tenantId,
          toEmail:  options.userEmail,
          subject:  options.emailSubject ?? options.title,
          body:     options.emailHtml ?? options.body,
          status:   result.success ? 'SENT' : 'FAILED',
          error:    result.error ?? null,
        },
      }).catch(() => {})
    })
  }
}

// ── Queries ──────────────────────────────────────────────────

export async function getNotifications(
  tenantId: string,
  userId:   string,
  limit = 50,
): Promise<NotificationResponse[]> {
  const list = await prisma.notification.findMany({
    where:   { tenantId, userId },
    orderBy: { createdAt: 'desc' },
    take:    limit,
  })

  return list.map((n) => ({
    id:        n.id,
    tenantId:  n.tenantId,
    userId:    n.userId,
    type:      n.type,
    title:     n.title,
    body:      n.body,
    link:      n.link,
    isRead:    n.isRead,
    createdAt: n.createdAt.toISOString(),
  }))
}

export async function getUnreadCount(tenantId: string, userId: string): Promise<number> {
  return prisma.notification.count({
    where: { tenantId, userId, isRead: false },
  })
}

export async function markAsRead(id: string, tenantId: string, userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { id, tenantId, userId },
    data:  { isRead: true },
  })
}

export async function markAllAsRead(tenantId: string, userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { tenantId, userId, isRead: false },
    data:  { isRead: true },
  })
}