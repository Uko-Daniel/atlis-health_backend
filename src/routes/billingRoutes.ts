import { type FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { billingController } from '../controllers/billingController';

export async function billingRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // Tenant-scoped: view own billing
  fastify.get('/billing/estimate', {
    preHandler: [authorize(['ADMIN', 'MANAGER', 'BILLING_OFFICER', 'SUPER_ADMIN'])],
    handler: billingController.getEstimate,
  });

  fastify.get('/billing/history', {
    preHandler: [authorize(['ADMIN', 'MANAGER', 'BILLING_OFFICER', 'SUPER_ADMIN'])],
    handler: billingController.getHistory,
  });

  fastify.post('/billing/close', {
    preHandler: [authorize(['SUPER_ADMIN'])],
    handler: billingController.closeCurrent,
  });

  // Admin-only: close all tenants (cron or manual)
  fastify.post('/admin/billing/close-all', {
    preHandler: [authorize(['SUPER_ADMIN'])],
    handler: billingController.closeAll,
  });
}