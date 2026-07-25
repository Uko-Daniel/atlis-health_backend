-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'CARD');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paymentStatus" "PaymentMethod" NOT NULL DEFAULT 'CASH';
