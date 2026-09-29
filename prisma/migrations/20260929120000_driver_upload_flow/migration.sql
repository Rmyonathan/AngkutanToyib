-- AlterEnum
BEGIN;
CREATE TYPE "DeliveryOrderStatus_new" AS ENUM ('VERIFIED', 'COMPLETED', 'INVOICED');
ALTER TABLE "delivery_orders" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "delivery_orders" ALTER COLUMN "status" TYPE "DeliveryOrderStatus_new" USING ("status"::text::"DeliveryOrderStatus_new");
ALTER TYPE "DeliveryOrderStatus" RENAME TO "DeliveryOrderStatus_old";
ALTER TYPE "DeliveryOrderStatus_new" RENAME TO "DeliveryOrderStatus";
DROP TYPE "DeliveryOrderStatus_old";
ALTER TABLE "delivery_orders" ALTER COLUMN "status" SET DEFAULT 'VERIFIED';
COMMIT;

-- DropForeignKey
ALTER TABLE "master_drivers" DROP CONSTRAINT "master_drivers_defaultUnitId_fkey";

-- DropIndex
DROP INDEX "field_submissions_deliveryOrderId_idx";

-- DropIndex
DROP INDEX "field_submissions_submissionType_status_idx";

-- DropIndex
DROP INDEX "operational_costs_fieldSubmissionId_key";

-- AlterTable
ALTER TABLE "delivery_orders" DROP COLUMN "bruto",
DROP COLUMN "tara",
ADD COLUMN     "customerTripId" TEXT,
ALTER COLUMN "status" SET DEFAULT 'VERIFIED';

-- AlterTable
ALTER TABLE "field_submissions" DROP COLUMN "photoUrl",
DROP COLUMN "submissionType",
ADD COLUMN     "customerTripId" TEXT NOT NULL,
ADD COLUMN     "otherPhoto" TEXT,
ADD COLUMN     "rejectReason" TEXT,
ADD COLUMN     "solarPhoto" TEXT,
ADD COLUMN     "suratJalanPhoto" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "master_drivers" DROP COLUMN "defaultUnitId",
ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "operational_costs" ADD COLUMN     "pricePerLiter" DOUBLE PRECISION;

-- DropEnum
DROP TYPE "FieldSubmissionType";

-- CreateTable
CREATE TABLE "customer_trips" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "distanceKm" DOUBLE PRECISION,
    "ratePerTon" DOUBLE PRECISION,
    "uangJalan" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_trips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_trips_customerId_name_key" ON "customer_trips"("customerId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "field_submissions_deliveryOrderId_key" ON "field_submissions"("deliveryOrderId");

-- CreateIndex
CREATE INDEX "field_submissions_driverId_date_idx" ON "field_submissions"("driverId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "master_drivers_userId_key" ON "master_drivers"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "master_units_defaultDriverId_key" ON "master_units"("defaultDriverId");

-- AddForeignKey
ALTER TABLE "master_drivers" ADD CONSTRAINT "master_drivers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_trips" ADD CONSTRAINT "customer_trips_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "master_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_submissions" ADD CONSTRAINT "field_submissions_customerTripId_fkey" FOREIGN KEY ("customerTripId") REFERENCES "customer_trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_orders" ADD CONSTRAINT "delivery_orders_customerTripId_fkey" FOREIGN KEY ("customerTripId") REFERENCES "customer_trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;

