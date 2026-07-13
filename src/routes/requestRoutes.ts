import { type FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { requestController } from '../controllers/requestController';

export async function requestRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // Anyone can create a request
  fastify.post('/requests', {
    handler: requestController.create,
  });

  // My requests
  fastify.get('/requests/mine', {
    handler: requestController.getMyRequests,
  });

  // View all requests (admin/billing/manager)
  fastify.get('/requests', {
    preHandler: [authorize(['ADMIN', 'MANAGER', 'BILLING_OFFICER', 'SUPER_ADMIN'])],
    handler: requestController.getAll,
  });

  // Single request
  fastify.get('/requests/:id', {
    handler: requestController.getById,
  });

  // Approve (billing/manager/admin)
  fastify.patch('/requests/:id/approve', {
    preHandler: [authorize(['ADMIN', 'MANAGER', 'BILLING_OFFICER'])],
    handler: requestController.approve,
  });

  // Reject
  fastify.patch('/requests/:id/reject', {
    preHandler: [authorize(['ADMIN', 'MANAGER', 'BILLING_OFFICER'])],
    handler: requestController.reject,
  });

  // Fulfill
  fastify.patch('/requests/:id/fulfill', {
    preHandler: [authorize(['ADMIN', 'MANAGER', 'BILLING_OFFICER', 'PROCUREMENT_OFFICER', 'HIM_OFFICER'])],
    handler: requestController.fulfill,
  });
}