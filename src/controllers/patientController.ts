import { type FastifyRequest, type FastifyReply } from 'fastify';
import { patientService } from '../services/patientService';

export const patientController = {

  async createPatient(request: FastifyRequest, reply: FastifyReply) {
    try {
      const patient = await patientService.createPatient({
        ...(request.body as object),
        tenantId: request.tenantId,
      });
      return reply.status(201).send(patient);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  },

  async getPatientById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id }    = request.params as { id: string };
      const { full }  = request.query  as { full?: string };
      const patient   = full === 'true'
        ? await patientService.getPatientById(id, request.tenantId)
        : await patientService.getPatientSummaryById(id, request.tenantId);
      if (!patient) return reply.status(404).send({ error: 'Patient not found' });
      return reply.status(200).send(patient);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },

  async getAllPatients(request: FastifyRequest, reply: FastifyReply) {
    try {  
      const query = request.query as { page?: string | number; limit?: string | number };
      const page  = Number(query.page)  || 1;
      const limit = Number(query.limit) || 15;
      const result = await patientService.getAllPatients(request.tenantId, page, limit);
      return reply.status(200).send(result);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },

  async searchPatients(request: FastifyRequest, reply: FastifyReply) {
    try {
      const filters = { ...(request.query as any), tenantId: request.tenantId };
      const result  = await patientService.searchPatients(filters);
      return reply.status(200).send(result);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },

  async updatePatient(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id }  = request.params as { id: string };
      const patient = await patientService.updatePatient(id, request.tenantId, request.body as any);
      return reply.status(200).send(patient);
    } catch (err: any) {
      const status = err.message.includes('not found') ? 404 : 400;
      return reply.status(status).send({ error: err.message });
    }
  },

  async deletePatient(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      await patientService.deletePatient(id, request.tenantId);
      return reply.status(200).send({ message: 'Patient deleted' });
    } catch (err: any) {
      const status = err.message.includes('not found') ? 404 : 400;
      return reply.status(status).send({ error: err.message });
    }
  },
};
