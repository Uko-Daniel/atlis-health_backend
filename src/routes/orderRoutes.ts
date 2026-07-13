import type { FastifyInstance } from 'fastify';
import { orderController } from '../controllers/orderServiceController';
import { authorize } from '../middleware/authorize';
import { authenticate } from '../middleware/authenticate';

export default async function orderRoutes(fastify: FastifyInstance) {
    fastify.addHook('preHandler', authenticate);

    fastify.post('/orders', orderController.createOrder);
    fastify.get('/orders', {
    preHandler: [authenticate, authorize(['IT_SUPPORT', 'ADMIN', 'MANAGER', 'BILLING_OFFICER', 'HIM_OFFICER'])],
    handler: orderController.getAllOrders,
    });
    fastify.get('/orders/patient/:id', orderController.getOrdersByPatient);
    fastify.get('/orders/:id', orderController.getOrderById);
    fastify.get('/orders/status/:status', orderController.getOrdersByStatus);
    fastify.put('/orders/:id/status', orderController.updateOrderStatus);
}