/*
  Warnings:

  - You are about to drop the column `hmoId` on the `Patient` table. All the data in the column will be lost.
  - You are about to drop the `HMO` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "PayerType" AS ENUM ('NHIA', 'HMO', 'SELF_PAY', 'CORPORATE');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'VETTED', 'PAID', 'REJECTED');

-- DropForeignKey
ALTER TABLE "Patient" DROP CONSTRAINT "Patient_hmoId_fkey";

-- AlterTable
ALTER TABLE "Encounter" ADD COLUMN     "meetLink" TEXT;

-- AlterTable
ALTER TABLE "Patient" DROP COLUMN "hmoId",
ADD COLUMN     "payerId" TEXT;

-- DropTable
DROP TABLE "HMO";

-- CreateTable
CREATE TABLE "Payer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PayerType" NOT NULL,
    "contactInfo" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tariff" (
    "id" TEXT NOT NULL,
    "payerId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "agreedPrice" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tariff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "payerId" TEXT NOT NULL,
    "encounterId" TEXT,
    "orderId" TEXT,
    "status" "ClaimStatus" NOT NULL DEFAULT 'DRAFT',
    "amount" DECIMAL(65,30) NOT NULL,
    "notes" TEXT,
    "submittedAt" TIMESTAMP(3),
    "vettedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleCredential" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiry" TIMESTAMP(3) NOT NULL,
    "scope" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payer_tenantId_idx" ON "Payer"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Payer_tenantId_name_key" ON "Payer"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Tariff_payerId_serviceId_key" ON "Tariff"("payerId", "serviceId");

-- CreateIndex
CREATE INDEX "Claim_tenantId_idx" ON "Claim"("tenantId");

-- CreateIndex
CREATE INDEX "Claim_patientId_idx" ON "Claim"("patientId");

-- CreateIndex
CREATE INDEX "Claim_payerId_idx" ON "Claim"("payerId");

-- CreateIndex
CREATE INDEX "Claim_status_idx" ON "Claim"("status");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleCredential_staffId_key" ON "GoogleCredential"("staffId");

-- AddForeignKey
ALTER TABLE "Payer" ADD CONSTRAINT "Payer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tariff" ADD CONSTRAINT "Tariff_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "Payer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tariff" ADD CONSTRAINT "Tariff_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "Payer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "Payer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
