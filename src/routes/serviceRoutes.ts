import { type FastifyInstance } from 'fastify';
import { serviceController } from '../controllers/orderServiceController';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

export async function serviceRoutes(fastify: FastifyInstance) {

  fastify.addHook('preHandler', authenticate);


  fastify.post('/services',{
            preHandler: [authenticate, authorize(['IT_SUPPORT', 'ADMIN', 'MANAGER'])],
            handler: serviceController.createService});
  fastify.put('/services/:id', {
            preHandler: [authenticate, authorize(['IT_SUPPORT', 'ADMIN', 'MANAGER'])],
            handler: serviceController.updateService
  });
  fastify.delete('/services/:id', {
            preHandler: [authenticate, authorize(['IT_SUPPORT', 'ADMIN', 'MANAGER'])],
            handler: serviceController.deleteService
  });

  fastify.get('/services/:id', {
            preHandler: [authenticate, authorize(['IT_SUPPORT', 'ADMIN', 'MANAGER'])],
            handler: serviceController.getServiceById
  });
  fastify.get('/services', {
            preHandler: [authenticate, authorize(['IT_SUPPORT', 'ADMIN', 'MANAGER'])],
            handler: serviceController.getAllServices
  });
  fastify.get('/services/search', {
            preHandler: [authenticate, authorize(['IT_SUPPORT', 'ADMIN', 'MANAGER'])],
            handler: serviceController.searchServices
  });
  fastify.get('/services/by-template', {
            preHandler: [authenticate, authorize(['IT_SUPPORT', 'ADMIN', 'MANAGER'])],
            handler: serviceController.updateService
  });
  fastify.get('/services/by-category', {
            preHandler: [authenticate, authorize(['IT_SUPPORT', 'ADMIN', 'MANAGER'])],
            handler: serviceController.deleteService
  });
  fastify.get('/services/sorted/price', {
            preHandler: [authenticate, authorize(['IT_SUPPORT', 'ADMIN', 'MANAGER'])],
            handler: serviceController.getServicesByCategory
  });
}