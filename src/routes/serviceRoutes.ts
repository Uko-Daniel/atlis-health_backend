import { type FastifyInstance } from 'fastify';
import { serviceController } from '../controllers/serviceController';

export async function serviceRoutes(fastify: FastifyInstance) {
  fastify.post('/services', serviceController.create);
  fastify.get('/services/:id', serviceController.getById);
  fastify.get('/services', serviceController.getAll);
  fastify.put('/services/:id', serviceController.update);
  fastify.delete('/services/:id', serviceController.delete);
  
  fastify.get('/services/search', serviceController.searchByName);
  fastify.get('/services/by-template', serviceController.getByTemplate);
  fastify.get('/services/by-category', serviceController.getByCategory);
  fastify.get('/services/sorted/price', serviceController.getAllSortedByPrice);
}