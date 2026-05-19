/*
  Warnings:

  - Added the required column `department` to the `Result` table without a default value. This is not possible if the table is not empty.
  - Added the required column `department` to the `Template` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Department" AS ENUM ('LABORATORY', 'RADIOLOGY', 'CARDIOLOGY', 'PHARMACY', 'GENERAL', 'EMERGENCY', 'PAEDIATRICS', 'OBSTETRICS', 'SURGERY', 'ADMINISTRATION');

-- AlterTable
ALTER TABLE "Result" ADD COLUMN     "department" "Department" NOT NULL,
ADD COLUMN     "lockedAt" TIMESTAMP(3),
ADD COLUMN     "lockedBy" TEXT,
ADD COLUMN     "releasedAt" TIMESTAMP(3),
ADD COLUMN     "releasedBy" TEXT,
ADD COLUMN     "signatureHash" TEXT,
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedBy" TEXT,
ADD COLUMN     "verifierRole" TEXT;

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "canVerify" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "department" "Department",
ADD COLUMN     "isHOD" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "department" "Department" NOT NULL,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "ResultEditSession" (
    "id" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "draftData" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSavedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResultEditSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResultEditSession_resultId_key" ON "ResultEditSession"("resultId");

-- CreateIndex
CREATE INDEX "ResultEditSession_staffId_idx" ON "ResultEditSession"("staffId");

-- CreateIndex
CREATE INDEX "Result_department_idx" ON "Result"("department");

-- AddForeignKey
ALTER TABLE "ResultEditSession" ADD CONSTRAINT "ResultEditSession_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "Result"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
