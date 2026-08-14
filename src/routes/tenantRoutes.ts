import { type FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { tenantService } from '../services/tenantService';

export async function tenantRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // GET /api/tenant/current — current tenant info
  fastify.get('/tenant/current', {
    handler: async (request, reply) => {
      return reply.send(request.tenant);
    },
  });
}