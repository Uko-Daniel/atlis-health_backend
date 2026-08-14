import { prisma } from '../lib/prisma';
import type { BillingStatus, PlanTier, SubscriptionStatus } from '../../generated/prisma/client';
import { encryptJSON } from '../utils/crypto';
import argon2 from 'argon2';

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

  // Super Admin functions

  async getAllWithCounts() {
    return prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { staff: true, patients: true },
        },
        billingPeriods: {
          orderBy: { periodStart: 'desc' },
          take: 1,
        },
      },
    });
  },


  async getTenantDetail(id: string) {
    return prisma.tenant.findUnique({
      where: { id },
      include: {
        billingPeriods: { orderBy: { periodStart: 'desc' } },
        payers: true,
        staff: { select: { id: true, firstName: true, lastName: true, email: true, role: true, isHOD: true } },
        // You may include more if needed
      },
    });
  },

  // Update tenant plan
  async updatePlan(id: string, planTier: PlanTier) {
    return prisma.tenant.update({
      where: { id },
      data: { planTier },
    });
  },

  // Update Paystack configuration (encrypt secret key)
  async updatePaystackConfig(id: string, publicKey: string, secretKey?: string) {
    const data: any = {
      paystackPublicKey: publicKey,
      paystackConfigured: true,
    };
    if (secretKey) {
      data.paystackSecretKey = encryptJSON(secretKey); // use your crypto util
    }
    return prisma.tenant.update({
      where: { id },
      data,
    });
  },

  // Suspend/reactivate tenant
  async updateSubscription(id: string, status: SubscriptionStatus, licenseExpiresAt?: string) {
    // already exists, but ensure grace period logic
    const updateData: any = {
      subscriptionStatus: status,
    };
    if (licenseExpiresAt) updateData.licenseExpiresAt = new Date(licenseExpiresAt);
    if (status === 'GRACE_PERIOD') {
      updateData.gracePeriodEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    }
    return prisma.tenant.update({
      where: { id },
      data: updateData,
    });
  },

  // Delete/deactivate tenant
  async deactivateTenant(id: string) {
    return prisma.tenant.update({
      where: { id },
      data: { subscriptionStatus: 'SUSPENDED' },
    });
  },

  // Get all signup requests
  async getAllSignupRequests() {
    return prisma.signupRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: { tenant: { select: { facilityName: true, subdomain: true } } },
    });
  },

  // Approve signup request (create tenant and staff)
  async approveSignupRequest(requestId: string, tenantData: CreateTenantInput) {
    const request = await prisma.signupRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new Error('Signup request not found');

    // Create tenant (use existing create logic or inline)
    const tenant = await tenantService.create(tenantData);

    // Create staff from request
    const hashed = await argon2.hash('ChangeMe123!'); // temporary password
    const staff = await prisma.staff.create({
      data: {
        firstName: request.firstName,
        lastName: request.lastName,
        email: request.email,
        password: hashed,
        role: request.role,
        department: request.department,
        phoneNumber: request.phone,
        tenantId: tenant.id,
        isHOD: true,
      },
    });

    // Update signup request
    await prisma.signupRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        reviewedBy: 'SUPER_ADMIN',
        reviewedAt: new Date(),
        createdStaffId: staff.id,
        tenantId: tenant.id,
      },
    });

    return { tenant, staff };
  },

  // Reject signup request
  async rejectSignupRequest(requestId: string, reason: string) {
    return prisma.signupRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        reviewNotes: reason,
        reviewedAt: new Date(),
        reviewedBy: 'SUPER_ADMIN',
      },
    });
  },

  // Billing period actions
  async updateBillingPeriodStatus(periodId: string, status: BillingStatus) {
    return prisma.billingPeriod.update({
      where: { id: periodId },
      data: { status },
    });
  },
};