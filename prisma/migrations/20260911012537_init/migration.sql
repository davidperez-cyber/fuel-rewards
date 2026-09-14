-- CreateEnum
CREATE TYPE "CardStage" AS ENUM ('STAGE_1', 'STAGE_2', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RewardType" AS ENUM ('FREE_SHAKE', 'SHAKER');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('STAFF', 'ADMIN');

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyCard" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "stamps" INTEGER NOT NULL DEFAULT 0,
    "stage" "CardStage" NOT NULL DEFAULT 'STAGE_1',
    "reward1ClaimedAt" TIMESTAMP(3),
    "reward2ClaimedAt" TIMESTAMP(3),
    "firstStampAt" TIMESTAMP(3),
    "cycleStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cycleNumber" INTEGER NOT NULL DEFAULT 1,
    "serialNumber" TEXT NOT NULL,
    "authenticationToken" TEXT NOT NULL,
    "passUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "googleObjectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StampEvent" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "staffUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StampEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RedemptionEvent" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "rewardType" "RewardType" NOT NULL,
    "staffUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RedemptionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CycleResetEvent" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "staffUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CycleResetEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppleDeviceRegistration" (
    "id" TEXT NOT NULL,
    "deviceLibraryIdentifier" TEXT NOT NULL,
    "pushToken" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppleDeviceRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffUser" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL DEFAULT 'STAFF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "Customer_name_idx" ON "Customer"("name");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyCard_customerId_key" ON "LoyaltyCard"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyCard_serialNumber_key" ON "LoyaltyCard"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyCard_authenticationToken_key" ON "LoyaltyCard"("authenticationToken");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyCard_googleObjectId_key" ON "LoyaltyCard"("googleObjectId");

-- CreateIndex
CREATE INDEX "StampEvent_cardId_idx" ON "StampEvent"("cardId");

-- CreateIndex
CREATE INDEX "RedemptionEvent_cardId_idx" ON "RedemptionEvent"("cardId");

-- CreateIndex
CREATE INDEX "CycleResetEvent_cardId_idx" ON "CycleResetEvent"("cardId");

-- CreateIndex
CREATE INDEX "AppleDeviceRegistration_cardId_idx" ON "AppleDeviceRegistration"("cardId");

-- CreateIndex
CREATE UNIQUE INDEX "AppleDeviceRegistration_deviceLibraryIdentifier_cardId_key" ON "AppleDeviceRegistration"("deviceLibraryIdentifier", "cardId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffUser_email_key" ON "StaffUser"("email");

-- AddForeignKey
ALTER TABLE "LoyaltyCard" ADD CONSTRAINT "LoyaltyCard_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StampEvent" ADD CONSTRAINT "StampEvent_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "LoyaltyCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StampEvent" ADD CONSTRAINT "StampEvent_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RedemptionEvent" ADD CONSTRAINT "RedemptionEvent_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "LoyaltyCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RedemptionEvent" ADD CONSTRAINT "RedemptionEvent_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleResetEvent" ADD CONSTRAINT "CycleResetEvent_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "LoyaltyCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleResetEvent" ADD CONSTRAINT "CycleResetEvent_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppleDeviceRegistration" ADD CONSTRAINT "AppleDeviceRegistration_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "LoyaltyCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
