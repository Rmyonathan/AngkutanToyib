-- DO lama: amount 0 artinya belum di-set → null (fallback master). DO baru boleh 0 = tanpa gaji.
ALTER TABLE "delivery_orders" ALTER COLUMN "driverPayAmount" DROP NOT NULL;
ALTER TABLE "delivery_orders" ALTER COLUMN "driverPayAmount" DROP DEFAULT;
UPDATE "delivery_orders" SET "driverPayAmount" = NULL WHERE "driverPayAmount" = 0;
