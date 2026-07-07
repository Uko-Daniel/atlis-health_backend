import { type FastifyInstance } from 'fastify';
import { authenticate }    from '../middleware/authenticate';
import { authorize }       from '../middleware/authorize';
import { recordController } from '../controllers/recordController';

export async function recordRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // POST /api/records
  fastify.post('/', {
    preHandler: [authorize(['DOCTOR', 'NURSES', 'ADMIN', 'RECEPTIONIST', 'LAB_TECH', 'RADIOLOGIST'])],
    handler:    recordController.createRecord,
  });
  
  // GET /api/records/patient/:patientId
  fastify.get('/patient/:patientId', {
    handler: recordController.getRecordsByPatient,
  });

  // GET /api/records/:id/summary
  fastify.get('/:id/summary', {
    handler: recordController.getRecordSummary,
  });

  // GET /api/records/:id
  fastify.get('/:id', {
    handler: recordController.getRecordById,
  });
}