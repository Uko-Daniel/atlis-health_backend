import { type FastifyRequest, type FastifyReply } from 'fastify';
import { orderService }   from '../services/orderService';
import { serviceService } from '../services/serviceService';
import { PaymentMethod } from '../../generated/prisma/enums';

// ── ORDER ─────────────────────────────────────────────────────

export const orderController = {

  async createOrder(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { patientId, serviceIds, paymentMethod } = request.body as {
        patientId:  string;
        serviceIds: string[];
        paymentMethod: PaymentMethod;
      };
      const order = await orderService.createOrder(patientId, serviceIds, request.tenantId, paymentMethod);
      return reply.status(201).send(order);
    } catch (err: any) {
      const status = err.message.includes('not found') ? 404 : 400;
      return reply.status(status).send({ error: err.message });
    }
  },

  async getAllOrders(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { status, page, limit } = request.query as {
        status?: string;
        page?: string;
        limit?: string;
      };
      const orders = await orderService.getAllOrders(
        request.tenantId,
        status as any,
        Number(page) || 1,
        Number(limit) || 50,
      );
      return reply.status(200).send(orders);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },

  async getOrderById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const order  = await orderService.getOrderById(id, request.tenantId);
      if (!order) return reply.status(404).send({ error: 'Order not found' });
      return reply.status(200).send(order);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },

  async getOrdersByPatient(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { patientId } = request.params as { patientId: string };
      const orders = await orderService.getOrdersByPatient(patientId, request.tenantId);
      return reply.status(200).send(orders);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },

  async getOrdersByStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { status }      = request.params as { status: any };
      const { page, limit } = request.query  as { page?: number; limit?: number };
      const orders = await orderService.getOrdersByStatus(status, request.tenantId, page, limit);
      return reply.status(200).send(orders);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },

  async updateOrderStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id }     = request.params as { id: string };
      const { status } = request.body   as { status: any };
      const order = await orderService.updateOrderStatus(id, status, request.tenantId);
      return reply.status(200).send(order);
    } catch (err: any) {
      const status = err.message.includes('not found') ? 404 : 400;
      return reply.status(status).send({ error: err.message });
    }
  },
};

// ── SERVICE ───────────────────────────────────────────────────

export const serviceController = {

  async createService(request: FastifyRequest, reply: FastifyReply) {
    try {
      const service = await serviceService.createService(
        {         ...(request.body as object),
        tenantId: request.tenantId, }
      );
      return reply.status(201).send(service);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  },

  async getServiceById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id }  = request.params as { id: string };
      const service = await serviceService.getServiceById(id, request.tenantId);
      if (!service) return reply.status(404).send({ error: 'Service not found' });
      return reply.status(200).send(service);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },

  async getAllServices(request: FastifyRequest, reply: FastifyReply) {
    try {
      const services = await serviceService.getAllServices(request.tenantId);
      return reply.status(200).send(services);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },

  async getServicesByCategory(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { category } = request.params as { category: string };
      const services = await serviceService.getByCategory(category, request.tenantId);
      return reply.status(200).send(services);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },

  async searchServices(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { name } = request.query as { name: string };
      if (!name) return reply.status(400).send({ error: 'name query param required' });
      const services = await serviceService.searchServiceByName(name, request.tenantId);
      return reply.status(200).send(services);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },

  async updateService(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id }  = request.params as { id: string };
      const service = await serviceService.updateService(id, request.tenantId, request.body as any);
      return reply.status(200).send(service);
    } catch (err: any) {
      const status = err.message.includes('not found') ? 404 : 400;
      return reply.status(status).send({ error: err.message });
    }
  },

  async deleteService(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      await serviceService.deleteService(id, request.tenantId);
      return reply.status(200).send({ message: 'Service deleted' });
    } catch (err: any) {
      const status = err.message.includes('not found') ? 404 : 400;
      return reply.status(status).send({ error: err.message });
    }
  },
};
