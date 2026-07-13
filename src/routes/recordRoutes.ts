import { type FastifyInstance } from 'fastify';
import { authenticate }    from '../middleware/authenticate';
import { authorize }       from '../middleware/authorize';
import { recordController } from '../controllers/recordController';

export async function recordRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // POST /api/records
  fastify.post('/', {
    preHandler: [authorize(['DOCTOR', 'NURSES', 'ADMIN', 'RECEPTIONIST', 'LAB_SCIENTIST', 'IMAGING_TECH'])],
    handler:    recordController.createRecord,
  });
  
  // GET /api/records/patient/:patientId
  fastify.get('/patient/:patientId', {
    preHandler: [authorize(['DOCTOR', 'NURSES', 'HIM_OFFICER'])],
    handler: recordController.getRecordsByPatient,
  });

  // GET /api/records/completeness
  fastify.get('/records/completeness', {
    preHandler: [authorize(['HIM_OFFICER', 'ADMIN', 'MANAGER', 'SUPER_ADMIN'])],
    handler: recordController.getRecordCompleteness,
  });

  // GET /api/records/:id/summary
  fastify.get('/:id/summary', {
    handler: recordController.getRecordSummary,
  });

  // GET /api/records/:id
  fastify.get('/:id', {
    preHandler: [authorize(['DOCTOR', 'NURSES', 'HIM_OFFICER', 'RECEPTIONIST'])],
    handler: recordController.getRecordById,
  });
}