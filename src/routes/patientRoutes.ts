import { type FastifyInstance } from 'fastify';
import { patientController } from '../controllers/patientController';

export async function patientRoutes(fastify: FastifyInstance) {
    fastify.post('/patients', patientController.createPatient);
    fastify.get('/patients/search', patientController.searchPatients);
    fastify.get('/patients', patientController.getAllPatients);
    fastify.get('/patients/:id', patientController.getPatientById);
    fastify.put('/patients/:id', patientController.updatePatient);
    fastify.delete('/patients/:id', patientController.deletePatient);
}