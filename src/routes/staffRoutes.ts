import { type FastifyInstance } from 'fastify';
import { staffController } from '../controllers/staffController';
import { authorize } from '../middleware/authorize';
import { authenticate } from "../middleware/authenticate";

export async function staffRoutes(fastify: FastifyInstance) {

  fastify.addHook('preHandler', authenticate);

  // CRUD
  fastify.post('/staff',{
          preHandler: [authenticate, authorize(['IT_SUPPORT', 'ADMIN'])],
          handler:  staffController.createStaff});
  fastify.put('/staff/:id', {
          preHandler: [authenticate, authorize(['IT_SUPPORT', 'ADMIN'])],
          handler: staffController.updateStaff
  });
  fastify.patch('/staff/:id', {
          preHandler: [authenticate, authorize(['IT_SUPPORT', 'ADMIN'])],
          handler: staffController.updatePermissions
  });
  fastify.delete('/staff/:id', {
          preHandler: [authenticate, authorize(['IT_SUPPORT', 'ADMIN'])],
          handler: staffController.deleteStaff
  });

  fastify.get('/staff/:id', {
          preHandler: [authenticate, authorize(['IT_SUPPORT', 'ADMIN'])],
          handler: staffController.getStaffById
  });
  fastify.get('/staff', staffController.getAllStaff);
}
