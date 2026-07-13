import { prisma } from '../lib/prisma';
import type { PlanTier, SubscriptionStatus } from '../../generated/prisma/client';

export interface CreateTenantInput {
  facilityName: string;
  subdomain: string;
  planTier?: PlanTier;
  licenseExpiresAt?: string;
  eveeEnabled?: boolean;
  themePrimaryColor?: string;
  logoUrl?: string;
}

export const tenantService = {

  async create(data: CreateTenantInput) {
    const existing = await prisma.tenant.findFirst({
      where: {
        OR: [
          { subdomain: data.subdomain },
        ],
      },
    });

    if (existing) throw new Error('A tenant with this subdomain already exists');

    return prisma.tenant.create({
      data: {
        facilityName: data.facilityName,
        subdomain: data.subdomain.toLowerCase(),
        planTier: data.planTier ?? 'TIER_1',
        subscriptionStatus: 'ACTIVE',
        licenseExpiresAt: data.licenseExpiresAt
          ? new Date(data.licenseExpiresAt)
          : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year default
        eveeEnabled: data.eveeEnabled ?? false,
        themePrimaryColor: data.themePrimaryColor ?? null,
        logoUrl: data.logoUrl ?? null,
      },
    });
  },

  async getById(id: string) {
    return prisma.tenant.findUnique({ where: { id } });
  },

  async getBySubdomain(subdomain: string) {
    return prisma.tenant.findUnique({ where: { subdomain: subdomain.toLowerCase() } });
  },

  async getByDomain(domain: string) {
    return prisma.tenant.findFirst({
      where: {
        OR: [
          { customDomain: domain },
          { subdomain: domain },
        ],
      },
    });
  },

  async getAll() {
    return prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
    });
  },

  async updateSubscription(
    id: string,
    status: SubscriptionStatus,
    licenseExpiresAt?: string,
  ) {
    return prisma.tenant.update({
      where: { id },
      data: {
        subscriptionStatus: status,
        ...(licenseExpiresAt && { licenseExpiresAt: new Date(licenseExpiresAt) }),
        ...(status === 'GRACE_PERIOD' && {
          gracePeriodEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
        }),
      },
    });
  },

  async updateSettings(id: string, data: {
    facilityName?: string;
    themePrimaryColor?: string | null;
    logoUrl?: string | null;
    eveeEnabled?: boolean;
    videoConsultEnabled?: boolean;
  }) {
    return prisma.tenant.update({
      where: { id },
      data,
    });
  },

  async addCustomDomain(id: string, domain: string) {
    const existing = await prisma.tenant.findFirst({
      where: { customDomain: domain },
    });
    if (existing) throw new Error('This domain is already in use');

    return prisma.tenant.update({
      where: { id },
      data: {
        customDomain: domain,
        customDomainEnabled: true,
      },
    });
  },
};