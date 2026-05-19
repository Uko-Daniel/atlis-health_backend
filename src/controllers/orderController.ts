import type { FastifyRequest, FastifyReply } from 'fastify';
import { orderService } from '../services/orderService';

export const orderController = {

    async createOrder(req: FastifyRequest, res: FastifyReply) {
        try {
            const { patientId, serviceIds } = req.body as any;
            const order = await orderService.createOrder(patientId, serviceIds);
            res.send({ success: true, order });
        } catch (error: any) {
            res.status(400).send({ success: false, message: error.message });
        }
    },

    async getOrdersByPatient(req: FastifyRequest, res: FastifyReply) {
        try {
            const { id } = req.params as { id: string };
            const orders = await orderService.getOrdersByPatient(id);
            res.send({ success: true, orders });
        } catch (error: any) {
            res.status(400).send({ success: false, message: error.message });
        }
    },

    async getOrderById(req: FastifyRequest, res: FastifyReply) {
        try {
            const { id } = req.params as { id: string };
            const order = await orderService.getOrderById(id);

            if (!order) {
                return res.status(404).send({ success: false, message: 'Order not found' });
            }

            res.send({ success: true, order });
        } catch (error: any) {
            res.status(400).send({ success: false, message: error.message });
        }
    },

    async getOrdersByStatus(req: FastifyRequest, res: FastifyReply) {
        try {
            const { status, page, limit } = req.query as any;

            const result = await orderService.getOrdersByStatus(
                status,
                Number(page) || 1,
                Number(limit) || 50
            );

            res.send({ success: true, ...result });
        } catch (error: any) {
            res.status(400).send({ success: false, message: error.message });
        }
    },

    async updateOrderStatus(req: FastifyRequest, res: FastifyReply) {
        try {
            const { id } = req.params as { id: string };
            const { status } = req.body as any;
            const order = await orderService.updateOrderStatus(id, status);
            res.send({ success: true, order });
        } catch (error: any) {
            res.status(400).send({ success: false, message: error.message });
        }
    },
};