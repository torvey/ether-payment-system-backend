-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('pending', 'completed', 'failed');

-- CreateTable
CREATE TABLE "ScheduledPayout" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "amount" TEXT NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledPayout_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ScheduledPayout" ADD CONSTRAINT "ScheduledPayout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
