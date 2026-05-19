import { type FastifyRequest, type FastifyReply } from 'fastify';
import { patientService } from '../services/patientService';

export const patientController = {

  async createPatient(request: FastifyRequest, reply: FastifyReply) {
    try {
      const patient = await patientService.createPatient(request.body as any);
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
        ? await patientService.getPatientById(id)
        : await patientService.getPatientSummaryById(id);
      if (!patient) return reply.status(404).send({ error: 'Patient not found' });
      return reply.status(200).send(patient);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },

  async getAllPatients(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { page, limit } = request.query as { page?: number; limit?: number };
      const result = await patientService.getAllPatients(page, limit);
      return reply.status(200).send(result);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },

  async searchPatients(request: FastifyRequest, reply: FastifyReply) {
    try {
      const filters = request.query as any;
      const result  = await patientService.searchPatients(filters);
      return reply.status(200).send(result);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },

  async updatePatient(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id }  = request.params as { id: string };
      const patient = await patientService.updatePatient(id, request.body as any);
      return reply.status(200).send(patient);
    } catch (err: any) {
      const status = err.message.includes('not found') ? 404 : 400;
      return reply.status(status).send({ error: err.message });
    }
  },

  async deletePatient(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      await patientService.deletePatient(id);
      return reply.status(200).send({ message: 'Patient deleted' });
    } catch (err: any) {
      const status = err.message.includes('not found') ? 404 : 400;
      return reply.status(status).send({ error: err.message });
    }
  },
};