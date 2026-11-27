-- AlterTable
ALTER TABLE "LoyaltyCard" ADD COLUMN     "walletMessage" TEXT;

-- CreateTable
CREATE TABLE "WalletBroadcast" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "recipients" INTEGER NOT NULL,
    "appleDevices" INTEGER NOT NULL DEFAULT 0,
    "googleCards" INTEGER NOT NULL DEFAULT 0,
    "staffUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletBroadcast_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "WalletBroadcast" ADD CONSTRAINT "WalletBroadcast_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

