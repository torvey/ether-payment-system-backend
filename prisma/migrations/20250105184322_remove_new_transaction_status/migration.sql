/*
  Warnings:

  - The values [pending_insufficient_funds] on the enum `PaymentStatusEnum` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PaymentStatusEnum_new" AS ENUM ('pending', 'completed', 'failed', 'expired');
ALTER TABLE "PaymentStatus" ALTER COLUMN "name" TYPE "PaymentStatusEnum_new" USING ("name"::text::"PaymentStatusEnum_new");
ALTER TYPE "PaymentStatusEnum" RENAME TO "PaymentStatusEnum_old";
ALTER TYPE "PaymentStatusEnum_new" RENAME TO "PaymentStatusEnum";
DROP TYPE "PaymentStatusEnum_old";
COMMIT;
