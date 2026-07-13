import { type FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { tenantService } from '../services/tenantService';

export async function tenantRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // GET /api/admin/tenants — list all (ADMIN only)
  fastify.get('/admin/tenants', {
    preHandler: [authorize(['SUPER_ADMIN'])],
    handler: async (_request, reply) => {
      const tenants = await tenantService.getAll();
      return reply.send(tenants);
    },
  });

  fastify.get('/tenant/current', {
  handler: async (request, reply) => {
    return reply.send(request.tenant);
    },
  });

  // POST /api/admin/tenants — create new tenant (ADMIN only)
  fastify.post('/admin/tenants', {
    preHandler: [authorize(['SUPER_ADMIN'])],
    handler: async (request, reply) => {
      try {
        const tenant = await tenantService.create(request.body as any);
        return reply.status(201).send(tenant);
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    },
  });

  // PATCH /api/admin/tenants/:id/subscription
  fastify.patch('/admin/tenants/:id/subscription', {
    preHandler: [authorize(['SUPER_ADMIN'])],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as { status: any; licenseExpiresAt?: string };
      try {
        const tenant = await tenantService.updateSubscription(id, body.status, body.licenseExpiresAt);
        return reply.send(tenant);
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    },
  });
}