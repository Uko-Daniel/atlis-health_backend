import { type FastifyInstance } from 'fastify';
import { templateController } from '../controllers/templateController';

export async function templateRoutes(fastify: FastifyInstance) {
    fastify.post('/templates', templateController.create);
    fastify.get('/templates', templateController.getAll);
    fastify.get('/templates/:id', templateController.getById);
    fastify.get('/templates/search', templateController.searchByName);
    fastify.get('/templates/type', templateController.getByType);
    fastify.put('/templates/:id', templateController.update);
    fastify.delete('/templates/:id', templateController.remove);
}