import { type FastifyInstance } from 'fastify';
import { resultController } from '../controllers/resultController';

export const resultRoutes = async (fastify: FastifyInstance) => {
  fastify.post('/results', resultController.create);
  fastify.get('/results/patient/:patientId', resultController.getByPatient);
  fastify.get('/results/:id', resultController.getById);
  fastify.put('/results/:id/status', resultController.updateStatus);
};