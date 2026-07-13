import { type FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { purchaseOrderService } from '../services/purchaseOrderService';

export async function purchaseOrderRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.post('/purchase-orders', {
    preHandler: [authorize(['ADMIN', 'MANAGER', 'PROCUREMENT_OFFICER', 'SUPER_ADMIN'])],
    handler: async (request, reply) => {
      try {
        const po = await purchaseOrderService.create(
          request.tenantId, request.user.sub, request.body as any,
        );
        return reply.status(201).send(po);
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    },
  });

  fastify.get('/purchase-orders', {
    handler: async (request, reply) => {
      const { status, page, limit } = request.query as any;
      const result = await purchaseOrderService.getAll(request.tenantId, {
        status, page: Number(page) || 1, limit: Number(limit) || 20,
      });
      return reply.send(result);
    },
  });

  fastify.get('/purchase-orders/:id', {
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const po = await purchaseOrderService.getById(id, request.tenantId);
      if (!po) return reply.status(404).send({ error: 'Purchase order not found' });
      return reply.send(po);
    },
  });

  fastify.patch('/purchase-orders/:id/receive', {
    preHandler: [authorize(['ADMIN', 'MANAGER', 'PROCUREMENT_OFFICER', 'SUPER_ADMIN'])],
    handler: async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const po = await purchaseOrderService.receive(id, request.tenantId, request.user.sub);
        return reply.send(po);
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    },
  });
}