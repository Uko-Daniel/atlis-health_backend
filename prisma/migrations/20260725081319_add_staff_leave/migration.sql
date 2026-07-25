-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'SICK', 'SUSPENDED');

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "leaveStatus" "LeaveStatus" NOT NULL DEFAULT 'ACTIVE';
