/*
  Warnings:

  - You are about to drop the column `priceUsd` on the `Product` table. All the data in the column will be lost.
  - Added the required column `currency` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `price` to the `Product` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD', 'EURO', 'GBP', 'PLN');

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "priceUsd",
ADD COLUMN     "currency" "Currency" NOT NULL,
ADD COLUMN     "price" TEXT NOT NULL;
