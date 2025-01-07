/*
  Warnings:

  - A unique constraint covering the columns `[link]` on the table `PaymentLink` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "PaymentLink_link_key" ON "PaymentLink"("link");
