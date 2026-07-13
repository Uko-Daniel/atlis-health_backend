import { type FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { supplierService } from '../services/supplierService';

export async function supplierRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.post('/suppliers', {
    preHandler: [authorize(['ADMIN', 'MANAGER', 'PROCUREMENT_OFFICER', 'SUPER_ADMIN'])],
    handler: async (request, reply) => {
      try {
        const supplier = await supplierService.create(request.tenantId, request.body as any);
        return reply.status(201).send(supplier);
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    },
  });

  fastify.get('/suppliers', {
    handler: async (request, reply) => {
      const suppliers = await supplierService.getAll(request.tenantId);
      return reply.send(suppliers);
    },
  });

  fastify.get('/suppliers/:id', {
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const supplier = await supplierService.getById(id, request.tenantId);
      if (!supplier) return reply.status(404).send({ error: 'Supplier not found' });
      return reply.send(supplier);
    },
  });

  fastify.put('/suppliers/:id', {
    preHandler: [authorize(['ADMIN', 'MANAGER', 'PROCUREMENT_OFFICER', 'SUPER_ADMIN'])],
    handler: async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const supplier = await supplierService.update(id, request.tenantId, request.body as any);
        return reply.send(supplier);
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    },
  });
}