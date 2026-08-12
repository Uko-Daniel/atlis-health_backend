import { type FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/authenticate';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from '../services/notificationService';

export async function notificationRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/notifications', async (request, reply) => {
    const { limit } = request.query as { limit?: string };
    return getNotifications(request.tenantId, request.user.sub, Number(limit) || 50);
  });

  fastify.get('/notifications/unread-count', async (request, reply) => {
    const count = await getUnreadCount(request.tenantId, request.user.sub);
    return { count };
  });

  fastify.patch('/notifications/:id/read', async (request, reply) => {
    const { id } = request.params as { id: string };
    await markAsRead(id, request.tenantId, request.user.sub);
    return { success: true };
  });

  fastify.patch('/notifications/read-all', async (request, reply) => {
    await markAllAsRead(request.tenantId, request.user.sub);
    return { success: true };
  });
}