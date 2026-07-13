import { type FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { inventoryService } from '../services/inventoryService';

export async function inventoryRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.post('/inventory', {
    preHandler: [authorize(['ADMIN', 'MANAGER', 'PROCUREMENT_OFFICER', 'SUPER_ADMIN'])],
    handler: async (request, reply) => {
      try {
        const item = await inventoryService.create(request.tenantId, request.body as any);
        return reply.status(201).send(item);
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    },
  });

  fastify.get('/inventory', {
    handler: async (request, reply) => {
      const { category, search } = request.query as any;
      const items = await inventoryService.getAll(request.tenantId, { category, search });
      return reply.send(items);
    },
  });

  fastify.get('/inventory/low-stock', {
    handler: async (request, reply) => {
      const items = await inventoryService.getLowStock(request.tenantId);
      return reply.send(items);
    },
  });

  fastify.get('/inventory/:id', {
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const item = await inventoryService.getById(id, request.tenantId);
      if (!item) return reply.status(404).send({ error: 'Item not found' });
      return reply.send(item);
    },
  });

  fastify.put('/inventory/:id', {
    preHandler: [authorize(['ADMIN', 'MANAGER', 'PROCUREMENT_OFFICER', 'SUPER_ADMIN'])],
    handler: async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const item = await inventoryService.update(id, request.tenantId, request.body as any);
        return reply.send(item);
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    },
  });

  fastify.post('/inventory/:id/transaction', {
    preHandler: [authorize(['ADMIN', 'MANAGER', 'PROCUREMENT_OFFICER', 'PHARMACIST', 'SUPER_ADMIN'])],
    handler: async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const transaction = await inventoryService.addTransaction(request.tenantId, {
          itemId: id,
          ...(request.body as any),
          performedBy: request.user.sub,
        });
        return reply.status(201).send(transaction);
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    },
  });
}