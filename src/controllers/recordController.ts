import { type FastifyRequest, type FastifyReply } from 'fastify';
import { recordService } from '../services/recordService';

export const recordController = {

  // POST /api/records
  async createRecord(request: FastifyRequest, reply: FastifyReply) {
    try {
      const record = await recordService.createRecord({
        ...(request.body as any),
        tenantId: request.tenantId,
      });
      return reply.status(201).send(record);
    } catch (err: any) {
      const status = err.message.includes('not found') ? 404 : 400;
      return reply.status(status).send({ error: err.message });
    }
  },

  // GET /api/records/:id
  async getRecordById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const record = await recordService.getRecordById(id, request.tenantId);
      if (!record) return reply.status(404).send({ error: 'Record not found' });
      return reply.status(200).send(record);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },

  // GET /api/records/patient/:patientId
  async getRecordsByPatient(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { patientId } = request.params as { patientId: string };
      const records = await recordService.getRecordsByPatient(patientId, request.tenantId);
      return reply.status(200).send(records);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },

  // GET /api/records/:id/summary
  async getRecordSummary(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const summary = await recordService.getRecordSummary(id, request.tenantId);
      return reply.status(200).send(summary);
    } catch (err: any) {
      const status = err.message.includes('not found') ? 404 : 500;
      return reply.status(status).send({ error: err.message });
    }
  },
};
