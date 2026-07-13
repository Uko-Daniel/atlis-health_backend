import { type FastifyInstance } from 'fastify';
import { patientController } from '../controllers/patientController';
import { authorize } from '../middleware/authorize';
import { authenticate } from "../middleware/authenticate";

export async function patientRoutes(fastify: FastifyInstance) {

    fastify.addHook('preHandler', authenticate);

    fastify.post('/patients', patientController.createPatient);
    fastify.get('/patients/search',  patientController.searchPatients);
    fastify.get('/patients', {
        preHandler: [authenticate, authorize(['IT_SUPPORT', 'ADMIN', 'MANAGER', 'BILLING_OFFICER', 'HIM_OFFICER', 'DOCTOR', 'NURSES', 'PHARMACIST'])],
        handler:  patientController.getAllPatients
    });
    fastify.get('/patients/:id', {
        preHandler: [authenticate, authorize(['IT_SUPPORT', 'ADMIN', 'MANAGER', 'BILLING_OFFICER', 'HIM_OFFICER', 'DOCTOR', 'NURSES', 'PHARMACIST', 'LAB_SCIENTIST', 'IMAGING_TECH'])],
        handler: patientController.getPatientById
    });
    fastify.put('/patients/:id', {
        preHandler: [authenticate, authorize(['IT_SUPPORT', 'ADMIN', 'MANAGER', 'BILLING_OFFICER', 'HIM_OFFICER'])],
        handler: patientController.updatePatient
    });
    fastify.delete('/patients/:id', {
        preHandler: [authenticate, authorize(['IT_SUPPORT', 'ADMIN', 'MANAGER', 'BILLING_OFFICER', 'HIM_OFFICER'])],
        handler: patientController.deletePatient
    });
}