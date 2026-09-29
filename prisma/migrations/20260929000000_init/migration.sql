-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'MANAGER', 'ADMIN', 'OPERATOR', 'FINANCE');

-- CreateEnum
CREATE TYPE "UnitStatus" AS ENUM ('RUNNING', 'STANDBY', 'BREAKDOWN', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateEnum
CREATE TYPE "SalarySystem" AS ENUM ('PER_TON', 'MONTHLY', 'DAILY');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('ACTIVE', 'LEAVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "FieldSubmissionStatus" AS ENUM ('PENDING', 'PROCESSED', 'REJECTED');

-- CreateEnum
CREATE TYPE "FieldSubmissionType" AS ENUM ('SURAT_JALAN', 'SOLAR', 'BIAYA_LAIN');

-- CreateEnum
CREATE TYPE "DeliveryOrderStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'WAITING_VERIFICATION', 'VERIFIED', 'COMPLETED', 'INVOICED');

-- CreateEnum
CREATE TYPE "OperationalCostType" AS ENUM ('SOLAR', 'MAINTENANCE', 'LAINNYA');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIAL', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('TRANSFER', 'CASH', 'GIRO', 'OTHER');

-- CreateEnum
CREATE TYPE "JournalEntryType" AS ENUM ('CASH_OUT', 'CASH_IN');

-- CreateEnum
CREATE TYPE "JournalCategory" AS ENUM ('SOLAR', 'DRIVER', 'TIRE', 'MAINTENANCE', 'CICILAN', 'DEPRECIATION', 'MOVING', 'BIAYA_LAIN', 'UANG_JALAN', 'REVENUE', 'OTHER');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'OPERATOR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role" "Role" NOT NULL,
    "permissions" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role")
);

-- CreateTable
CREATE TABLE "master_units" (
    "id" TEXT NOT NULL,
    "unitNumber" TEXT NOT NULL,
    "brandType" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "licensePlate" TEXT NOT NULL,
    "capacity" DOUBLE PRECISION NOT NULL,
    "defaultDriverId" TEXT,
    "status" "UnitStatus" NOT NULL DEFAULT 'STANDBY',
    "currentKm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "operationStartDate" TIMESTAMP(3),
    "purchasePrice" DOUBLE PRECISION,
    "estimatedSalvageValue" DOUBLE PRECISION DEFAULT 0,
    "economicLifespanDays" INTEGER,
    "estimatedOpsDaysPerMonth" INTEGER,
    "monthlyCicilan" DOUBLE PRECISION,
    "monthlyMaintenanceBudget" DOUBLE PRECISION,
    "monthlyMovingCost" DOUBLE PRECISION,
    "allocatedTonasePerPeriod" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_drivers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "defaultUnitId" TEXT,
    "salarySystem" "SalarySystem" NOT NULL DEFAULT 'PER_TON',
    "driverRatePerTon" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "monthlySalary" DOUBLE PRECISION,
    "dailySalary" DOUBLE PRECISION,
    "attendanceStatus" "AttendanceStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_customers" (
    "id" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "loadingLocation" TEXT NOT NULL,
    "dumpingLocation" TEXT NOT NULL,
    "oneWayDistance" DOUBLE PRECISION NOT NULL,
    "ratePerTon" DOUBLE PRECISION NOT NULL,
    "targetTonase" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentTermDays" INTEGER NOT NULL DEFAULT 30,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_cost_configs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Default',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "globalSolarPrice" DOUBLE PRECISION NOT NULL,
    "globalTirePrice" DOUBLE PRECISION NOT NULL,
    "tireLifespanDays" INTEGER NOT NULL,
    "defaultMaintenanceBudget" DOUBLE PRECISION NOT NULL,
    "defaultCicilan" DOUBLE PRECISION NOT NULL,
    "defaultDepreciation" DOUBLE PRECISION NOT NULL,
    "defaultMovingCost" DOUBLE PRECISION NOT NULL,
    "estimatedOpsDaysPerMonth" INTEGER NOT NULL DEFAULT 25,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_cost_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hpp_journal_entries" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "entryType" "JournalEntryType" NOT NULL DEFAULT 'CASH_OUT',
    "category" "JournalCategory" NOT NULL DEFAULT 'OTHER',
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "unitId" TEXT,
    "createdById" TEXT,
    "notes" TEXT,
    "kasOnly" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hpp_journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_submissions" (
    "id" TEXT NOT NULL,
    "submissionType" "FieldSubmissionType" NOT NULL,
    "date" DATE NOT NULL,
    "unitId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "deliveryOrderId" TEXT,
    "photoUrl" TEXT NOT NULL,
    "notes" TEXT,
    "status" "FieldSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "field_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_orders" (
    "id" TEXT NOT NULL,
    "internalTripId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "unitId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "customerId" TEXT,
    "uangJalan" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ratePerTon" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ticketNumber" TEXT,
    "bruto" DOUBLE PRECISION,
    "tara" DOUBLE PRECISION,
    "netto" DOUBLE PRECISION,
    "kmHauling" DOUBLE PRECISION,
    "suratJalanPhoto" TEXT,
    "invoiceId" TEXT,
    "status" "DeliveryOrderStatus" NOT NULL DEFAULT 'ASSIGNED',
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operational_costs" (
    "id" TEXT NOT NULL,
    "costType" "OperationalCostType" NOT NULL,
    "date" DATE NOT NULL,
    "unitId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "deliveryOrderId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "volume" DOUBLE PRECISION,
    "description" TEXT NOT NULL,
    "fieldSubmissionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operational_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "invoiceDate" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "totalTonase" DOUBLE PRECISION NOT NULL,
    "ratePerTon" DOUBLE PRECISION NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "withholdingAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'ISSUED',
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_payments" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "withholdingAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "method" "PaymentMethod" NOT NULL DEFAULT 'TRANSFER',
    "reference" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "breakdown_history" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "issueDescription" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "downtimeHours" DOUBLE PRECISION,
    "maintenanceCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "breakdown_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "tableName" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "oldData" JSONB,
    "newData" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "master_units_unitNumber_key" ON "master_units"("unitNumber");

-- CreateIndex
CREATE UNIQUE INDEX "master_units_licensePlate_key" ON "master_units"("licensePlate");

-- CreateIndex
CREATE UNIQUE INDEX "master_drivers_driverId_key" ON "master_drivers"("driverId");

-- CreateIndex
CREATE INDEX "hpp_journal_entries_date_idx" ON "hpp_journal_entries"("date");

-- CreateIndex
CREATE INDEX "hpp_journal_entries_entryType_category_idx" ON "hpp_journal_entries"("entryType", "category");

-- CreateIndex
CREATE INDEX "field_submissions_status_date_idx" ON "field_submissions"("status", "date");

-- CreateIndex
CREATE INDEX "field_submissions_submissionType_status_idx" ON "field_submissions"("submissionType", "status");

-- CreateIndex
CREATE INDEX "field_submissions_deliveryOrderId_idx" ON "field_submissions"("deliveryOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_orders_internalTripId_key" ON "delivery_orders"("internalTripId");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_orders_ticketNumber_key" ON "delivery_orders"("ticketNumber");

-- CreateIndex
CREATE INDEX "delivery_orders_date_idx" ON "delivery_orders"("date");

-- CreateIndex
CREATE INDEX "delivery_orders_unitId_date_idx" ON "delivery_orders"("unitId", "date");

-- CreateIndex
CREATE INDEX "delivery_orders_customerId_date_idx" ON "delivery_orders"("customerId", "date");

-- CreateIndex
CREATE INDEX "delivery_orders_status_idx" ON "delivery_orders"("status");

-- CreateIndex
CREATE UNIQUE INDEX "operational_costs_fieldSubmissionId_key" ON "operational_costs"("fieldSubmissionId");

-- CreateIndex
CREATE INDEX "operational_costs_date_idx" ON "operational_costs"("date");

-- CreateIndex
CREATE INDEX "operational_costs_unitId_date_idx" ON "operational_costs"("unitId", "date");

-- CreateIndex
CREATE INDEX "operational_costs_costType_idx" ON "operational_costs"("costType");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoiceNumber_key" ON "invoices"("invoiceNumber");

-- CreateIndex
CREATE INDEX "invoices_customerId_periodStart_idx" ON "invoices"("customerId", "periodStart");

-- CreateIndex
CREATE INDEX "invoices_status_dueDate_idx" ON "invoices"("status", "dueDate");

-- CreateIndex
CREATE INDEX "invoice_payments_date_idx" ON "invoice_payments"("date");

-- CreateIndex
CREATE INDEX "invoice_payments_invoiceId_idx" ON "invoice_payments"("invoiceId");

-- CreateIndex
CREATE INDEX "breakdown_history_unitId_date_idx" ON "breakdown_history"("unitId", "date");

-- CreateIndex
CREATE INDEX "audit_logs_tableName_recordId_idx" ON "audit_logs"("tableName", "recordId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_timestamp_idx" ON "audit_logs"("userId", "timestamp");

-- AddForeignKey
ALTER TABLE "master_units" ADD CONSTRAINT "master_units_defaultDriverId_fkey" FOREIGN KEY ("defaultDriverId") REFERENCES "master_drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_drivers" ADD CONSTRAINT "master_drivers_defaultUnitId_fkey" FOREIGN KEY ("defaultUnitId") REFERENCES "master_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hpp_journal_entries" ADD CONSTRAINT "hpp_journal_entries_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "master_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hpp_journal_entries" ADD CONSTRAINT "hpp_journal_entries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_submissions" ADD CONSTRAINT "field_submissions_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "master_drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_submissions" ADD CONSTRAINT "field_submissions_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "master_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_submissions" ADD CONSTRAINT "field_submissions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_submissions" ADD CONSTRAINT "field_submissions_deliveryOrderId_fkey" FOREIGN KEY ("deliveryOrderId") REFERENCES "delivery_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_orders" ADD CONSTRAINT "delivery_orders_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "master_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_orders" ADD CONSTRAINT "delivery_orders_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "master_drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_orders" ADD CONSTRAINT "delivery_orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "master_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_orders" ADD CONSTRAINT "delivery_orders_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_orders" ADD CONSTRAINT "delivery_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_costs" ADD CONSTRAINT "operational_costs_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "master_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_costs" ADD CONSTRAINT "operational_costs_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "master_drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_costs" ADD CONSTRAINT "operational_costs_deliveryOrderId_fkey" FOREIGN KEY ("deliveryOrderId") REFERENCES "delivery_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_costs" ADD CONSTRAINT "operational_costs_fieldSubmissionId_fkey" FOREIGN KEY ("fieldSubmissionId") REFERENCES "field_submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "master_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "breakdown_history" ADD CONSTRAINT "breakdown_history_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "master_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

