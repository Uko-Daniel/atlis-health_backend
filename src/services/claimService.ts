import { prisma } from '../lib/prisma';
import type { ClaimStatus } from '../../generated/prisma/client';

export const claimService = {

  /**
   * Generate a claim from an encounter or order.
   * Pulls services from the order, applies payer tariffs where available,
   * falls back to the service's cash price.
   */
  async generateFromEncounter(tenantId: string, data: {
    patientId: string;
    payerId: string;
    encounterId: string;
    orderId?: string;
  }) {
    // Get patient's payer
    const payer = await prisma.payer.findFirst({
      where: { id: data.payerId, tenantId },
    });
    if (!payer) throw new Error('Payer not found');

    // Get order services if orderId provided, otherwise from encounter
    let serviceIds: string[] = [];
    if (data.orderId) {
      const orderServices = await prisma.orderService.findMany({
        where: { orderId: data.orderId },
        select: { serviceId: true },
      });
      serviceIds = orderServices.map((os) => os.serviceId);
    }

    if (serviceIds.length === 0) {
      throw new Error('No services found to claim');
    }

    // Get tariffs for these services under this payer
    const tariffs = await prisma.tariff.findMany({
      where: {
        payerId: data.payerId,
        serviceId: { in: serviceIds },
      },
    });

    const tariffMap = new Map(tariffs.map((t) => [t.serviceId, t.agreedPrice]));

    // Get service cash prices as fallback
    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds } },
      select: { id: true, price: true },
    });

    // Calculate total
    let totalAmount = 0;
    for (const svc of services) {
      const price = tariffMap.get(svc.id) ?? svc.price;
      totalAmount += Number(price);
    }

    return prisma.claim.create({
      data: {
        tenantId,
        patientId: data.patientId,
        payerId: data.payerId,
        encounterId: data.encounterId,
        orderId: data.orderId ?? null,
        amount: totalAmount,
        status: 'DRAFT',
      },
    });
  },

  async getAll(tenantId: string, params?: { status?: ClaimStatus; patientId?: string; payerId?: string }) {
    const where: any = { tenantId };
    if (params?.status) where.status = params.status;
    if (params?.patientId) where.patientId = params.patientId;
    if (params?.payerId) where.payerId = params.payerId;

    return prisma.claim.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        payer: { select: { id: true, name: true, type: true } },
      },
    });
  },

  async getById(id: string, tenantId: string) {
    return prisma.claim.findFirst({
      where: { id, tenantId },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        payer: true,
        encounter: { select: { id: true, type: true, startTime: true } },
        order: { select: { id: true, status: true } },
      },
    });
  },

  async updateStatus(id: string, tenantId: string, status: ClaimStatus, notes?: string) {
    const claim = await prisma.claim.findFirst({ where: { id, tenantId } });
    if (!claim) throw new Error('Claim not found');

    const data: any = { status };
    if (status === 'SUBMITTED') data.submittedAt = new Date();
    if (status === 'VETTED') data.vettedAt = new Date();
    if (status === 'PAID') data.paidAt = new Date();
    if (notes) data.notes = notes;

    return prisma.claim.update({ where: { id }, data });
  },
};