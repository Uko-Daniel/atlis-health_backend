import { type FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { permissionService } from '../services/permissionService';

export async function permissionRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // GET /api/settings/permissions
  fastify.get('/settings/permissions', {
    preHandler: [authorize(['ADMIN', 'IT_SUPPORT', 'MANAGER'])],
    handler: async (request, reply) => {
      try {
        const permissions = await permissionService.getAll(request.tenantId);
        return reply.send(permissions);
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    },
  });

  // PUT /api/settings/permissions/:key
  fastify.put('/settings/permissions/:key', {
    preHandler: [authorize(['ADMIN', 'IT_SUPPORT'])],
    handler: async (request, reply) => {
      try {
        const { key } = request.params as { key: string };
        const { allowedRoles } = request.body as { allowedRoles: string[] };
        const permission = await permissionService.update(
          request.tenantId,
          key,
          allowedRoles as any,
          request.user.sub,
        );
        return reply.send(permission);
      } catch (err: any) {
        const status = err.message.includes('compliance-locked') ? 403 : 400;
        return reply.status(status).send({ error: err.message });
      }
    },
  });
}