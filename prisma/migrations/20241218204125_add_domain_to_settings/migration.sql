/*
  Warnings:

  - Added the required column `domainName` to the `Settings` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "domainName" TEXT NOT NULL;
