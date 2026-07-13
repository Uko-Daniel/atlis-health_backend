import { prisma } from '../lib/prisma';
import { type Service } from '../types/service';
import { validateService } from '../utils/validation';

export const serviceService = {
  async createService(data: Partial<Service>) {
    const { valid, errors } = validateService(data);
    if (!valid) throw new Error(errors?.join(', '));
    if (!data.tenantId) throw new Error('tenantId is required');
    const tenantId = data.tenantId;

    if (data.templateId) {
      const template = await prisma.template.findFirst({
        where: { id: data.templateId, tenantId },
      });
      if (!template) throw new Error('Template not found');
    }

    return prisma.service.create({
      data: {
        name: data.name!,
        labCode: data.labCode!,
        category: data.category ?? null,
        description: data.description ?? null,
        price: data.price!,
        templateId: data.templateId ?? null,
        tenantId,
      },
    });
  },

  async getServiceById(id: string, tenantId: string) {
    if (!tenantId) throw new Error('tenantId is required');
    return prisma.service.findFirst({ where: { id, tenantId } });
    
  },

  async getAllServices(tenantId: string) {
  return prisma.service.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    include: {
      template: {
        select: { id: true, name: true },
      },
    },
  });
},

  async getByCategory(category: string, tenantId: string) {
    return prisma.service.findMany({
      where: { tenantId, category },
      orderBy: { name: 'asc' },
      include: {
        template: { select: { id: true, name: true } },
      },
    });
  },

  async getAllServicesByPrice(tenantId: string, ascending = true) {
    return prisma.service.findMany({
        where: { tenantId },
        orderBy: { price: ascending ? 'asc': 'desc'},
    });
  },

  async updateService(id: string, tenantId: string, data: Partial<Service>) {
    const { valid, errors } = validateService(data);
    if (!valid) throw new Error(errors?.join(', '));

    const existing = await prisma.service.findFirst({ where: { id, tenantId } });
    if (!existing) throw new Error('Service not found');

    if (data.templateId) {
      const template = await prisma.template.findFirst({
        where: { id: data.templateId, tenantId },
      });
      if (!template) throw new Error('Template not found');
    }

    const { tenantId: _tenantId, ...safeData } = data;
    return prisma.service.update({ where: { id }, data: safeData });
  },

  async deleteService(id: string, tenantId: string) {
    const existing = await prisma.service.findFirst({ where: { id, tenantId } });
    if (!existing) throw new Error('Service not found');

    return prisma.service.delete({ where: { id } });
  },

  async searchServiceByName(name: string, tenantId: string) {
    return prisma.service.findMany({
      where: {
        tenantId,
        name: { contains: name, mode: 'insensitive' },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        template: { select: { id: true, name: true } },
      },
    });
  },

  async getServicesByTemplate(templateId: string, tenantId: string) {
    return prisma.service.findMany({
      where: { tenantId, templateId },
      orderBy: { createdAt: 'desc' },
    });
  },
};
