import { type FastifyInstance } from 'fastify';
import { staffController } from '../controllers/staffController';

export async function staffRoutes(fastify: FastifyInstance) {

  // AUTH
  fastify.post('/auth/login', staffController.login);

  // CRUD
  fastify.post('/staff', staffController.createStaff);
  fastify.put('/staff/:id', staffController.updateStaff);
  fastify.patch('/staff/:id', staffController.updatePermissions);
  fastify.delete('/staff/:id', staffController.deleteStaff);

  fastify.get('/staff/:id', staffController.getStaffById);
  fastify.get('/staff', staffController.getAllStaff);
}