import type { FastifyReply, FastifyRequest } from 'fastify';
import { serviceService } from '../services/serviceService';

export const serviceController = {
  async create(req: FastifyRequest, reply: FastifyReply) {
    try {
      const service = await serviceService.createService(req.body as any);
      reply.send({ success: true, data: service });
    } catch (err: any) {
      reply.status(400).send({ success: false, message: err.message });
    }
  },

  async getById(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as any;
    const service = await serviceService.getServiceById(id);
    reply.send({ success: !!service, data: service });
  },

  async getAll(req: FastifyRequest, reply: FastifyReply) {
    const services = await serviceService.getAllServices();
    reply.send({ success: true, data: services });
  },

  async update(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as any;
    try {
      const updated = await serviceService.updateService(id, req.body as any);
      reply.send({ success: true, data: updated });
    } catch (err: any) {
      reply.status(400).send({ success: false, message: err.message });
    }
  },

  async delete(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as any;
    try {
      const deleted = await serviceService.deleteService(id);
      reply.send({ success: true, data: deleted });
    } catch (err: any) {
      reply.status(400).send({ success: false, message: err.message });
    }
  },

  async searchByName(req: FastifyRequest, reply: FastifyReply) {
    const { name } = req.query as any;
    const results = await serviceService.searchServiceByName(name);
    reply.send({ success: true, data: results });
  },

  async getByTemplate(req: FastifyRequest, reply: FastifyReply) {
    const { templateId } = req.query as any;
    const results = await serviceService.getServicesByTemplate(templateId);
    reply.send({ success: true, data: results });
  },

  async getByCategory(req: FastifyRequest, reply: FastifyReply) {
    const { category } = req.query as any;
    const results = await serviceService.getByCategory(category);
    reply.send({ success: true, data: results });
  },

  async getAllSortedByPrice(req: FastifyRequest, reply: FastifyReply) {
    const { order } = req.query as any; // 'asc' | 'desc'
    const results = await serviceService.getAllServicesByPrice(order !== 'desc');
    reply.send({ success: true, data: results });
  },
};
