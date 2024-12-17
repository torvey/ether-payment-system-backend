-- CreateTable
CREATE TABLE "AuthorizationToken" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthorizationToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthorizationToken_token_key" ON "AuthorizationToken"("token");

-- CreateIndex
CREATE INDEX "AuthorizationToken_userId_idx" ON "AuthorizationToken"("userId");

-- AddForeignKey
ALTER TABLE "AuthorizationToken" ADD CONSTRAINT "AuthorizationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
