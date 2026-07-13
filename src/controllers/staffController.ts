import { type FastifyRequest, type FastifyReply } from 'fastify';
import { staffService } from '../services/staffService';
import { type Department } from '../../generated/prisma/enums';

export const staffController = {

  async login(request: FastifyRequest, reply: FastifyReply) {
    try {
      const staff = await staffService.login(request.body as any, request.tenantId);

      const token = request.server.jwt.sign({
        sub: staff.id,
        role: staff.role,
        department: staff.department,
        isHOD: staff.isHOD,
        canVerify: staff.canVerify,
        email: staff.email,
        tenantId: staff.tenantId,
      });

      return reply.send({
        staff,
        token,
      });

    } catch (err: any) {
      return reply.status(401).send({ error: err.message });
    }
  },

  async createStaff(request: FastifyRequest, reply: FastifyReply) {
    try {
      const staff = await staffService.createStaff({
        ...(request.body as any),
        tenantId: request.tenantId,
      });
      return reply.status(201).send(staff);
    } catch (err: any) {
      const status = err.message.includes('already exists') ? 409 : 400;
      return reply.status(status).send({ error: err.message });
    }
  },

  async getStaffById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const staff  = await staffService.getStaffById(id, request.tenantId);
      if (!staff) return reply.status(404).send({ error: 'Staff member not found' });
      return reply.status(200).send(staff);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },

  async getAllStaff(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { department } = request.query as { department?: Department };
      const staff = await staffService.getAllStaff(request.tenantId, department);
      return reply.status(200).send(staff);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },

  async updateStaff(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const staff  = await staffService.updateStaff(id, request.tenantId, request.body as any);
      return reply.status(200).send(staff);
    } catch (err: any) {
      const status = err.message.includes('not found') ? 404 : 400;
      return reply.status(status).send({ error: err.message });
    }
  },

  async updatePermissions(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const staff  = await staffService.updatePermissions(id, request.tenantId, request.body as any);
      return reply.status(200).send(staff);
    } catch (err: any) {
      const status = err.message.includes('not found') ? 404 : 400;
      return reply.status(status).send({ error: err.message });
    }
  },

  async deleteStaff(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      await staffService.deleteStaff(id, request.tenantId);
      return reply.status(200).send({ message: 'Staff member deleted' });
    } catch (err: any) {
      const status = err.message.includes('not found') ? 404
                   : err.message.includes('audit')     ? 409 : 400;
      return reply.status(status).send({ error: err.message });
    }
  },
};
