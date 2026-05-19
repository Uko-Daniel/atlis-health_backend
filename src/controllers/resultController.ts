import type { FastifyReply, FastifyRequest } from 'fastify';
import { resultService } from '../services/resultService';

export const resultController = {
  async create(req: FastifyRequest, reply: FastifyReply) {
    try {
      const result = await resultService.createResult(req.body as any);
      reply.send({ success: true, data: result });
    } catch (err: any) {
      reply.status(400).send({ success: false, message: err.message });
    }
  },

  async getByPatient(req: FastifyRequest, reply: FastifyReply) {
    const { patientId } = req.params as any;
    const results = await resultService.getResultsByPatient(patientId);
    reply.send({ success: true, data: results });
  },

  async getById(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as any;
    const result = await resultService.getResultById(id);
    reply.send({ success: !!result, data: result });
  },

  async updateStatus(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as any;
    const { status } = req.body as any;
    try {
      const updated = await resultService.updateResultStatus(id, status);
      reply.send({ success: true, data: updated });
    } catch (err: any) {
      reply.status(400).send({ success: false, message: err.message });
    }
  },
};