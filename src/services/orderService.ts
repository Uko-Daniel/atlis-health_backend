import { prisma } from '../lib/prisma';
import { validateOrder } from '../utils/validation';
import { getSkipTake, paginate } from '../utils/pagination';
import type { OrderStatus } from '../types/order';
import { validateEnum } from '../utils/validation';
import { PaymentMethod as paymentMethod, OrderStatus as Status } from '../../generated/prisma/enums';
import {initializePayment} from './paystackService';

const BYPASS_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'BILLING_OFFICER', 'MANAGER']);

export const orderService = {

    // Low-level order creation – used after payment or bypass.
    async createOrder(patientId: string, serviceIds: string[], tenantId: string, paymentMethod: paymentMethod) {
        const { valid, errors } = validateOrder({ patientId, serviceIds });
        if (!valid) throw new Error(errors?.join(', '));
        if (!tenantId) throw new Error('tenantId is required');

        const patient = await prisma.patient.findFirst({ where: { id: patientId, tenantId } });
        if (!patient) throw new Error('Patient not found');

        const services = await prisma.service.findMany({
            where: { id: { in: serviceIds }, tenantId },
        });
        if (services.length !== serviceIds.length) {
            throw new Error('One or more services are invalid');
        }

        return prisma.order.create({
            data: {
                patientId,
                paymentMethod: paymentMethod ?? 'CASH',
                services: {
                    create: serviceIds.map(serviceId => ({ serviceId })),
                },
            },
            include: { services: { include: { service: true } } },
        });
    },

    // High-level order initiation with payment enforcement.
    async initiateOrder({
        patientId,
        serviceIds,
        tenantId,
        userId,
        userRole,
        bypassReason,
    }: {
        patientId: string;
        serviceIds: string[];
        tenantId: string;
        userId: string;
        userRole: string;
        bypassReason?: string;
    }) {
        const { valid, errors } = validateOrder({ patientId, serviceIds });
        if (!valid) throw new Error(errors?.join(', '));
        if (!tenantId) throw new Error('tenantId is required');

        const patient = await prisma.patient.findFirst({
            where: { id: patientId, tenantId },
            include: { payer: true },
        });
        if (!patient) throw new Error('Patient not found');

        const requiresPayment = !patient.payer || patient.payer.type === 'SELF_PAY';

        if (requiresPayment) {
            const canBypass = BYPASS_ROLES.has(userRole);
            if (canBypass) {
                if (!['SUPER_ADMIN', 'ADMIN'].includes(userRole) && !bypassReason?.trim()) {
                    throw new Error('Bypass reason is required');
                }

                const order = await this.createOrder(patientId, serviceIds, tenantId, 'CASH');

                await prisma.auditLog.create({
                    data: {
                        userId,
                        action: 'BYPASS_PAYMENT',
                        entityId: order.id,
                        entityType: 'Order',
                        tenantId,
                    },
                });

                return { order, paymentRequired: false };
            }

            // Initiate Paystack payment
            const services = await prisma.service.findMany({
                where: { id: { in: serviceIds }, tenantId },
            });
            if (services.length !== serviceIds.length) {
                throw new Error('One or more services are invalid');
            }

            const totalAmount = services.reduce((sum, s) => sum + s.price, 0);
            const { authorizationUrl } = await initializePayment({
                tenantId,
                patientId,
                serviceIds,
                amount: totalAmount,
            });

            return { paymentRequired: true, authorizationUrl };
        }

        // Non self-pay – create order directly
        const order = await this.createOrder(patientId, serviceIds, tenantId, 'CASH');
        return { order, paymentRequired: false };
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
