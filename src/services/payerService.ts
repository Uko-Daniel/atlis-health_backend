import { prisma } from '../lib/prisma';
import type { PayerType } from '../../generated/prisma/client';

export const payerService = {

  async create(tenantId: string, data: {
    name: string;
    type: PayerType;
    contactInfo?: string;
  }) {
    return prisma.payer.create({
      data: {
        tenantId,
        name: data.name.trim(),
        type: data.type,
        contactInfo: data.contactInfo ?? null,
      },
    });
  },

  async getAll(tenantId: string) {
    return prisma.payer.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' },
      include: { _count: { select: { tariffs: true, claims: true } } },
    });
  },

  async getById(id: string, tenantId: string) {
    return prisma.payer.findFirst({
      where: { id, tenantId },
      include: { tariffs: { include: { service: true } } },
    });
  },

  async update(id: string, tenantId: string, data: { name?: string; contactInfo?: string; isActive?: boolean }) {
    return prisma.payer.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name.trim() }),
        ...(data.contactInfo !== undefined && { contactInfo: data.contactInfo }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  },

  // ── Tariffs ──────────────────────────────────────────────

  async setTariff(payerId: string, serviceId: string, agreedPrice: number) {
    return prisma.tariff.upsert({
      where: { payerId_serviceId: { payerId, serviceId } },
      update: { agreedPrice },
      create: { payerId, serviceId, agreedPrice },
    });
  },

  async removeTariff(payerId: string, serviceId: string) {
    return prisma.tariff.delete({
      where: { payerId_serviceId: { payerId, serviceId } },
    });
  },

  async getTariffs(payerId: string) {
    return prisma.tariff.findMany({
      where: { payerId },
      include: { service: { select: { id: true, name: true, category: true, price: true } } },
      orderBy: { service: { name: 'asc' } },
    });
  },
};