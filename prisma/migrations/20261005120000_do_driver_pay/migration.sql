-- CreateEnum
CREATE TYPE "DoDriverPayMode" AS ENUM ('PER_TON', 'PER_TRIP');

-- AlterTable
ALTER TABLE "delivery_orders" ADD COLUMN     "driverPayMode" "DoDriverPayMode" NOT NULL DEFAULT 'PER_TON',
ADD COLUMN     "driverPayAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
