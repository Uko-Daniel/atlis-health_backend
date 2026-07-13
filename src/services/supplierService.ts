import { prisma } from '../lib/prisma';

export const supplierService = {

  async create(tenantId: string, data: {
    name: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    address?: string;
    products?: string;
  }) {
    return prisma.supplier.create({
      data: {
        tenantId,
        name: data.name.trim(),
        contactPerson: data.contactPerson?.trim() ?? null,
        phone: data.phone?.trim() ?? null,
        email: data.email?.trim() ?? null,
        address: data.address?.trim() ?? null,
        products: data.products?.trim() ?? null,
      },
    });
  },

  async getAll(tenantId: string) {
    return prisma.supplier.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' },
    });
  },

  async getById(id: string, tenantId: string) {
    return prisma.supplier.findFirst({ where: { id, tenantId } });
  },

  async update(id: string, _tenantId: string, data: {
    name?: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    address?: string;
    products?: string;
    isActive?: boolean;
  }) {
    return prisma.supplier.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name.trim() }),
        ...(data.contactPerson !== undefined && { contactPerson: data.contactPerson?.trim() ?? null }),
        ...(data.phone !== undefined && { phone: data.phone?.trim() ?? null }),
        ...(data.email !== undefined && { email: data.email?.trim() ?? null }),
        ...(data.address !== undefined && { address: data.address?.trim() ?? null }),
        ...(data.products !== undefined && { products: data.products?.trim() ?? null }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  },

  async deactivate(id: string, _tenantId: string) {
    return prisma.supplier.update({
      where: { id },
      data: { isActive: false },
    });
  },
};
