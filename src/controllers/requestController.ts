import { type FastifyRequest, type FastifyReply } from 'fastify';
import { requestService } from '../services/requestService';

export const requestController = {

  async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const req = await requestService.create(
        request.tenantId,
        request.user.sub,
        request.body as any,
      );
      return reply.status(201).send(req);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  },

  async getAll(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { type, status, page, limit } = request.query as any;
      const result = await requestService.getAll(request.tenantId, {
        type,
        status,
        page: Number(page) || 1,
        limit: Number(limit) || 20,
      });
      return reply.send(result);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },

  async getMyRequests(request: FastifyRequest, reply: FastifyReply) {
    try {
      const result = await requestService.getMyRequests(request.tenantId, request.user.sub);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },

  async getById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const req = await requestService.getById(id, request.tenantId);
      if (!req) return reply.status(404).send({ error: 'Request not found' });
      return reply.send(req);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },

  async approve(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const req = await requestService.approve(id, request.tenantId, request.user.sub);
      return reply.send(req);
    } catch (err: any) {
      const status = err.message.includes('not found') ? 404
                   : err.message.includes('not pending') ? 409 : 400;
      return reply.status(status).send({ error: err.message });
    }
  },

  async reject(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const { reason } = request.body as { reason: string };
      if (!reason?.trim()) return reply.status(400).send({ error: 'Rejection reason is required' });
      const req = await requestService.reject(id, request.tenantId, request.user.sub, reason);
      return reply.send(req);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  },

  async fulfill(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const req = await requestService.fulfill(id, request.tenantId);
      return reply.send(req);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  },
};