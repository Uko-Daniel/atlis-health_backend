import { prisma } from '../lib/prisma';
import { validateOrder } from '../utils/validation';
import { getSkipTake, paginate } from '../utils/pagination';
import type { OrderStatus } from '../types/order';
import { validateEnum } from '../utils/validation';
import { OrderStatus as Status } from '../../generated/prisma/enums';

export const orderService = {

    async createOrder(patientId: string, serviceIds: string[], tenantId: string) {
        const { valid, errors } = validateOrder({ patientId, serviceIds });
        if (!valid) throw new Error(errors?.join(', '));
        if (!tenantId) throw new Error('tenantId is required');

        // Ensure patient exists
        const patient = await prisma.patient.findFirst({ where: { id: patientId, tenantId } });
        if (!patient) throw new Error('Patient not found');

        // Ensure all services exist
        const services = await prisma.service.findMany({
            where: { id: { in: serviceIds }, tenantId },
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

    async getOrdersByPatient(patientId: string, tenantId: string) {
        return prisma.order.findMany({
            where: { patientId, patient: { tenantId } },
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

    async getAllOrders(tenantId: string, status?: OrderStatus, page = 1, limit = 50) {
    const where: any = { patient: { tenantId } };
    if (status) where.status = status;

    const total = await prisma.order.count({ where });
    const { skip, take } = getSkipTake(page, limit);

    const orders = await prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        services: { include: { service: { select: { name: true, category: true, price: true } } } },
        _count: { select: { results: true } },
        },
    });

    return paginate(orders, total, page, limit);
    },

    async getOrderById(orderId: string, tenantId: string) {
        return prisma.order.findFirst({
            where: { id: orderId, patient: { tenantId } },
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

    async getOrdersByStatus(status: OrderStatus, tenantId: string, page = 1, limit = 50) {
    page = Number(page);
    limit = Number(limit);

    const where = { status, patient: { tenantId } };

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

    async updateOrderStatus(orderId: string, status: OrderStatus, tenantId: string) {
        const validStatus = validateEnum(status, Status, 'Order status')
        const existing = await prisma.order.findFirst({
            where: { id: orderId, patient: { tenantId } },
        });
        if (!existing) throw new Error('Order not found');

        return prisma.order.update({
            where: { id: orderId },
            data: { status: validStatus },
        });
    },
};
