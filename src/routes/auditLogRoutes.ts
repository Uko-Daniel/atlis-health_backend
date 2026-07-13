import { type FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { auditLogService } from '../services/auditLogService';

export async function auditLogRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/audit-logs', {
    preHandler: [authorize(['HIM_OFFICER', 'ADMIN', 'MANAGER', 'SUPER_ADMIN'])],
    handler: async (request, reply) => {
      const { userId, action, entityType, page, limit } = request.query as any;
      const result = await auditLogService.getAll(request.tenantId, {
        userId, action, entityType,
        page: Number(page) || 1,
        limit: Number(limit) || 50,
      });
      return reply.send(result);
    },
  });
}