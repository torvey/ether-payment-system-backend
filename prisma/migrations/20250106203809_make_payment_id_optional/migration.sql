-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_paymentId_fkey";

-- AlterTable
ALTER TABLE "Transaction" ALTER COLUMN "paymentId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
