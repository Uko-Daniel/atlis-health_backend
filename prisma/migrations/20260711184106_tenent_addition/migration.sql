/*
  Warnings:

  - Added the required column `tenantId` to the `AuditLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `Patient` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `Service` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `SignupRequest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `Staff` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `Template` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('TIER_1', 'TIER_2', 'TIER_3', 'TIER_4');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'GRACE_PERIOD', 'SUSPENDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BillingStatus" AS ENUM ('DRAFT', 'FINALIZED', 'PAID', 'OVERDUE');

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "SignupRequest" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "facilityName" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,
    "customDomain" TEXT,
    "themePrimaryColor" TEXT DEFAULT '#5580F4',
    "logoUrl" TEXT,
    "planTier" "PlanTier" NOT NULL DEFAULT 'TIER_1',
    "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "licenseExpiresAt" TIMESTAMP(3) NOT NULL,
    "gracePeriodEndsAt" TIMESTAMP(3),
    "eveeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "videoConsultEnabled" BOOLEAN NOT NULL DEFAULT false,
    "videoConsultMetered" BOOLEAN NOT NULL DEFAULT true,
    "customDomainEnabled" BOOLEAN NOT NULL DEFAULT false,
    "prioritySupport" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantPermission" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "permissionKey" TEXT NOT NULL,
    "allowedRoles" "StaffRole"[],
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT NOT NULL,

    CONSTRAINT "TenantPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantSetting" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingPeriod" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "activeUserCount" INTEGER NOT NULL,
    "encounterCount" INTEGER NOT NULL,
    "videoMinutesUsed" INTEGER NOT NULL DEFAULT 0,
    "calculatedAmount" DECIMAL(65,30) NOT NULL,
    "status" "BillingStatus" NOT NULL DEFAULT 'DRAFT',

    CONSTRAINT "BillingPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_subdomain_key" ON "Tenant"("subdomain");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_customDomain_key" ON "Tenant"("customDomain");

-- CreateIndex
CREATE INDEX "Tenant_subdomain_idx" ON "Tenant"("subdomain");

-- CreateIndex
CREATE INDEX "Tenant_customDomain_idx" ON "Tenant"("customDomain");

-- CreateIndex
CREATE UNIQUE INDEX "TenantPermission_tenantId_permissionKey_key" ON "TenantPermission"("tenantId", "permissionKey");

-- CreateIndex
CREATE UNIQUE INDEX "TenantSetting_tenantId_key_key" ON "TenantSetting"("tenantId", "key");

-- CreateIndex
CREATE INDEX "BillingPeriod_tenantId_idx" ON "BillingPeriod"("tenantId");

-- CreateIndex
CREATE INDEX "Patient_tenantId_idx" ON "Patient"("tenantId");

-- AddForeignKey
ALTER TABLE "TenantPermission" ADD CONSTRAINT "TenantPermission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantSetting" ADD CONSTRAINT "TenantSetting_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingPeriod" ADD CONSTRAINT "BillingPeriod_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignupRequest" ADD CONSTRAINT "SignupRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
