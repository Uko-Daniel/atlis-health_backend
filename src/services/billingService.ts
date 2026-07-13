import { prisma } from '../lib/prisma';
import type { PlanTier, BillingStatus } from '../../generated/prisma/client';

// ── PRICING CONFIG ────────────────────────────────────────────

const PRICING = {
  TIER_1: {
    baseMonthly: 10_000,
    staffBrackets: [
      { max: 5, price: 10_000, encounterOverageThreshold: 0, encounterOverageRate: 0 },
      { max: 15, price: 10_000, encounterOverageThreshold: 200, encounterOverageRate: 150 },
    ],
    onboardingFee: 0,
    eveeIncluded: false,
  },
  TIER_2: {
    baseMonthly: 50_000,
    includedUsers: 20,
    overagePerUser: 2_500,
    onboardingFee: 150_000,
    eveeIncluded: false,
  },
  TIER_3: {
    baseMonthly: 150_000,
    includedUsers: 60,
    overagePerUser: 2_000,
    onboardingFee: 350_000,
    eveeIncluded: true,
    customDomainIncluded: true,
  },
  TIER_4: {
    // Negotiated — stored per-tenant, not calculated here
    baseMonthly: 0,
    includedUsers: 0,
    overagePerUser: 0,
    onboardingFee: 0,
    eveeIncluded: true,
    customDomainIncluded: true,
    prioritySupportIncluded: true,
  },
} as const;

const ADDONS = {
  EVEE: 20_000,
  VIDEO_CONSULT_PER_MINUTE: 50,
  VIDEO_CONSULT_UNLIMITED: 30_000,
  EXTENDED_AUDIO_RETENTION: 5_000,
  CUSTOM_DOMAIN_THEMING: 15_000 / 12, // yearly → monthly
  PRIORITY_SUPPORT: 25_000,
} as const;

// ── HELPERS ───────────────────────────────────────────────────

function getBracketForStaffCount(tier: 'TIER_1', count: number) {
  if (tier !== 'TIER_1') return null;
  return PRICING.TIER_1.staffBrackets.find(b => count <= b.max)
    ?? PRICING.TIER_1.staffBrackets[PRICING.TIER_1.staffBrackets.length - 1];
}

/**
 * Count distinct staff with ≥1 authenticated action in a calendar month.
 * Uses AuditLog — any action = active user.
 */
async function countActiveUsers(tenantId: string, periodStart: Date, periodEnd: Date): Promise<number> {
  const result = await prisma.auditLog.groupBy({
    by: ['userId'],
    where: {
      tenantId,
      createdAt: { gte: periodStart, lt: periodEnd },
    },
  });
  return result.length;
}

/**
 * Count encounters in a calendar month (Tier 1 overage only).
 */
async function countEncounters(tenantId: string, periodStart: Date, periodEnd: Date): Promise<number> {
  return prisma.encounter.count({
    where: {
      patient: { tenantId },
      createdAt: { gte: periodStart, lt: periodEnd },
    },
  });
}

/**
 * Calculate video minutes from AuditLog (VIDEO_CONSULT_START actions).
 * In practice this would come from a dedicated metering table —
 * for now, estimate from encounter duration or return 0.
 */
async function countVideoMinutes(tenantId: string, periodStart: Date, periodEnd: Date): Promise<number> {
  // Stub — actual video metering requires Google Meet webhook integration
  return 0;
}

// ── CALCULATION ───────────────────────────────────────────────

export interface BillingCalculation {
  tenantId: string;
  periodStart: Date;
  periodEnd: Date;
  planTier: PlanTier;
  activeUserCount: number;
  includedUsers: number;
  overageUsers: number;
  encounterCount: number;
  encounterOverage: number;
  videoMinutes: number;
  baseAmount: number;
  userOverageAmount: number;
  encounterOverageAmount: number;
  eveeAmount: number;
  videoAmount: number;
  audioRetentionAmount: number;
  customDomainAmount: number;
  prioritySupportAmount: number;
  totalAmount: number;
  breakdown: string;
}

export async function calculateBilling(
  tenantId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<BillingCalculation> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new Error('Tenant not found');

  const tier = tenant.planTier;
  const activeUsers = await countActiveUsers(tenantId, periodStart, periodEnd);
  const encounters = await countEncounters(tenantId, periodStart, periodEnd);
  const videoMinutes = await countVideoMinutes(tenantId, periodStart, periodEnd);

  let baseAmount = 0;
  let includedUsers = 0;
  let overageUsers = 0;
  let userOverageAmount = 0;
  let encounterOverage = 0;
  let encounterOverageAmount = 0;
  let eveeAmount = 0;
  let customDomainAmount = 0;
  let prioritySupportAmount = 0;

  if (tier === 'TIER_4') {
    // Negotiated — amounts stored on tenant record or contract
    // For calculation purposes, return 0 — admin sets manually
    baseAmount = 0;
    includedUsers = activeUsers;
  } else if (tier === 'TIER_3') {
    const cfg = PRICING.TIER_3;
    baseAmount = cfg.baseMonthly;
    includedUsers = cfg.includedUsers;
    overageUsers = Math.max(0, activeUsers - includedUsers);
    userOverageAmount = overageUsers * cfg.overagePerUser;
    if (!cfg.eveeIncluded && tenant.eveeEnabled) eveeAmount = ADDONS.EVEE;
    if (!cfg.customDomainIncluded && tenant.customDomainEnabled) customDomainAmount = ADDONS.CUSTOM_DOMAIN_THEMING;
  } else if (tier === 'TIER_2') {
    const cfg = PRICING.TIER_2;
    baseAmount = cfg.baseMonthly;
    includedUsers = cfg.includedUsers;
    overageUsers = Math.max(0, activeUsers - includedUsers);
    userOverageAmount = overageUsers * cfg.overagePerUser;
    if (tenant.eveeEnabled) eveeAmount = ADDONS.EVEE;
    if (tenant.customDomainEnabled) customDomainAmount = ADDONS.CUSTOM_DOMAIN_THEMING;
  } else {
    // TIER_1
    const bracket = getBracketForStaffCount('TIER_1', activeUsers);
    if (bracket) {
      baseAmount = bracket.price;
      if (bracket.encounterOverageThreshold > 0) {
        encounterOverage = Math.max(0, encounters - bracket.encounterOverageThreshold);
        encounterOverageAmount = encounterOverage * bracket.encounterOverageRate;
      }
    }
    // EVEE not available on Tier 1
  }

  // Add-ons (all tiers)
  const videoAmount = tenant.videoConsultEnabled
    ? (tenant.videoConsultMetered ? videoMinutes * ADDONS.VIDEO_CONSULT_PER_MINUTE : ADDONS.VIDEO_CONSULT_UNLIMITED)
    : 0;

  const audioRetentionAmount = 0; // Stub — depends on audio retention config

  if (tenant.prioritySupport && tier !== 'TIER_4') {
    prioritySupportAmount = ADDONS.PRIORITY_SUPPORT;
  }

  const totalAmount = baseAmount + userOverageAmount + encounterOverageAmount
    + eveeAmount + videoAmount + audioRetentionAmount
    + customDomainAmount + prioritySupportAmount;

  const breakdown = [
    `Base (${tier}): ₦${baseAmount.toLocaleString()}`,
    activeUsers > 0 ? `Active users: ${activeUsers} (${includedUsers} included, ${overageUsers} overage)` : null,
    userOverageAmount > 0 ? `User overage: ₦${userOverageAmount.toLocaleString()}` : null,
    encounterOverageAmount > 0 ? `Encounter overage: ${encounterOverage} × ₦150 = ₦${encounterOverageAmount.toLocaleString()}` : null,
    eveeAmount > 0 ? `EVEE: ₦${eveeAmount.toLocaleString()}` : null,
    videoAmount > 0 ? `Video consults: ₦${videoAmount.toLocaleString()}` : null,
    customDomainAmount > 0 ? `Custom domain: ₦${customDomainAmount.toLocaleString()}` : null,
    prioritySupportAmount > 0 ? `Priority support: ₦${prioritySupportAmount.toLocaleString()}` : null,
  ].filter(Boolean).join(' | ');

  return {
    tenantId,
    periodStart,
    periodEnd,
    planTier: tier,
    activeUserCount: activeUsers,
    includedUsers,
    overageUsers,
    encounterCount: encounters,
    encounterOverage,
    videoMinutes,
    baseAmount,
    userOverageAmount,
    encounterOverageAmount,
    eveeAmount,
    videoAmount,
    audioRetentionAmount,
    customDomainAmount,
    prioritySupportAmount,
    totalAmount,
    breakdown,
  };
}

// ── PERIOD MANAGEMENT ─────────────────────────────────────────

/**
 * Close out the previous calendar month for a tenant.
 * Creates a BillingPeriod row with FINALIZED status.
 * Safe to call multiple times — skips if period already exists.
 */
export async function closeBillingPeriod(tenantId: string): Promise<{ created: boolean; period?: any }> {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth(), 1);

  // Check if already closed
  const existing = await prisma.billingPeriod.findFirst({
    where: { tenantId, periodStart, periodEnd },
  });
  if (existing) return { created: false };

  const calc = await calculateBilling(tenantId, periodStart, periodEnd);

  const period = await prisma.billingPeriod.create({
    data: {
      tenantId,
      periodStart,
      periodEnd,
      activeUserCount: calc.activeUserCount,
      encounterCount: calc.encounterCount,
      videoMinutesUsed: calc.videoMinutes,
      calculatedAmount: calc.totalAmount,
      status: 'FINALIZED',
    },
  });

  return { created: true, period };
}

/**
 * Close all tenants' billing periods for the previous month.
 * Called by cron job on the 1st of each month.
 */
export async function closeAllBillingPeriods(): Promise<{ processed: number; created: number }> {
  const tenants = await prisma.tenant.findMany({
    where: { subscriptionStatus: { not: 'EXPIRED' } },
    select: { id: true },
  });

  let created = 0;
  for (const tenant of tenants) {
    const result = await closeBillingPeriod(tenant.id);
    if (result.created) created++;
  }

  return { processed: tenants.length, created };
}

/**
 * Get billing history for a tenant.
 */
export async function getBillingHistory(tenantId: string, limit = 12) {
  return prisma.billingPeriod.findMany({
    where: { tenantId },
    orderBy: { periodEnd: 'desc' },
    take: limit,
  });
}

/**
 * Get a live estimate for the current month (not yet closed).
 */
export async function getCurrentEstimate(tenantId: string) {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return calculateBilling(tenantId, periodStart, periodEnd);
}