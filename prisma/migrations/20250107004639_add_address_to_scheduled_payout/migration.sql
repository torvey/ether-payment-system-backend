/*
  Warnings:

  - Added the required column `address` to the `ScheduledPayout` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ScheduledPayout" ADD COLUMN     "address" TEXT NOT NULL;
