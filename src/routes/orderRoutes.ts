import type { FastifyInstance } from 'fastify';
import { orderController } from '../controllers/orderServiceController';

export default async function orderRoutes(fastify: FastifyInstance) {
    fastify.post('/orders', orderController.createOrder);
    fastify.get('/orders/patient/:id', orderController.getOrdersByPatient);
    fastify.get('/orders/:id', orderController.getOrderById);
    fastify.put('/orders/status', orderController.getOrdersByStatus);
    fastify.put('/orders/:id/status', orderController.updateOrderStatus);
}