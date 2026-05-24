import { type FastifyInstance } from 'fastify';
import { serviceController } from '../controllers/orderServiceController';

export async function serviceRoutes(fastify: FastifyInstance) {
  fastify.post('/services', serviceController.createService);
  fastify.put('/services/:id', serviceController.updateService);
  fastify.delete('/services/:id', serviceController.deleteService);

  fastify.get('/services/:id', serviceController.getServiceById);
  fastify.get('/services', serviceController.getAllServices);
  fastify.get('/services/search', serviceController.searchServices);
  fastify.get('/services/by-template', serviceController.updateService);
  fastify.get('/services/by-category', serviceController.deleteService);
  fastify.get('/services/sorted/price', serviceController.getServicesByCategory);
}