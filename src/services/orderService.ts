import { prisma } from '../lib/prisma';
import { validateOrder } from '../utils/validation';
import { getSkipTake, paginate } from '../utils/pagination';
import type { OrderStatus } from '../types/order';
import { validateEnum } from '../utils/validation';
import { OrderStatus as Status } from '../../generated/prisma/enums';

export const orderService = {

    async createOrder(patientId: string, serviceIds: string[]) {
        const { valid, errors } = validateOrder({ patientId, serviceIds });
        if (!valid) throw new Error(errors?.join(', '));

        // Ensure patient exists
        const patient = await prisma.patient.findUnique({ where: { id: patientId } });
        if (!patient) throw new Error('Patient not found');

        // Ensure all services exist
        const services = await prisma.service.findMany({
            where: { id: { in: serviceIds } },
        });

        if (services.length !== serviceIds.length) {
            throw new Error('One or more services are invalid');
        }

        // Create order + link services
        return prisma.order.create({
            data: {
                patientId,
                services: {
                    create: serviceIds.map(serviceId => ({
                        serviceId,
                    })),
                },
            },
            include: {
                services: {
                    include: {
                        service: true,
                    },
                },
            },
        });
    },

    async getOrdersByPatient(patientId: string) {
        return prisma.order.findMany({
            where: { patientId },
            orderBy: { createdAt: 'desc' },
            include: {
                services: {
                    include: {
                        service: true,
                    },
                },
            },
        });
    },

    async getOrderById(orderId: string) {
        return prisma.order.findUnique({
            where: { id: orderId },
            include: {
                patient: true,
                services: {
                    include: {
                        service: true,
                    },
                },
                results: true,
            },
        });
    },

    async getOrdersByStatus(status: OrderStatus, page = 1, limit = 50) {
    page = Number(page);
    limit = Number(limit);

    const where = { status };

    const total = await prisma.order.count({ where });

    const { skip, take } = getSkipTake(page, limit);

    const orders = await prisma.order.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip,
        take,
        include: {
            patient: true,
            services: {
                include: {
                    service: true,
                },
            },
        },
    });

    return paginate(orders, total, page, limit);
},

    async updateOrderStatus(orderId: string, status: OrderStatus) {
        const validStatus = validateEnum(status, Status, 'Order status')
        return prisma.order.update({
            where: { id: orderId },
            data: { status: validStatus },
        });
    },
};
