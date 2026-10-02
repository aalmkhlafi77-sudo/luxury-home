-- CreateTable IdempotencyRecord
CREATE TABLE IF NOT EXISTS "IdempotencyRecord" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "operationType" TEXT NOT NULL,
    "userId" TEXT,
    "requestHash" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL DEFAULT 200,
    "responseBody" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "IdempotencyRecord_key_operationType_key" ON "IdempotencyRecord"("key", "operationType");
CREATE INDEX IF NOT EXISTS "IdempotencyRecord_key_operationType_userId_idx" ON "IdempotencyRecord"("key", "operationType", "userId");

-- CreateTable DocumentRecord
CREATE TABLE IF NOT EXISTS "DocumentRecord" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL DEFAULT 0,
    "mimeType" TEXT,
    "isPrivate" BOOLEAN NOT NULL DEFAULT true,
    "ownerUserId" TEXT,
    "propertyId" TEXT,
    "unitId" TEXT,
    "bookingId" TEXT,
    "leaseId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "DocumentRecord_fileName_key" ON "DocumentRecord"("fileName");
CREATE INDEX IF NOT EXISTS "DocumentRecord_propertyId_idx" ON "DocumentRecord"("propertyId");
CREATE INDEX IF NOT EXISTS "DocumentRecord_ownerUserId_idx" ON "DocumentRecord"("ownerUserId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'DocumentRecord_propertyId_fkey'
    ) THEN
        ALTER TABLE "DocumentRecord" ADD CONSTRAINT "DocumentRecord_propertyId_fkey" 
        FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AlterTable SecurityDepositRecord
ALTER TABLE "SecurityDepositRecord"
    ADD COLUMN IF NOT EXISTS "refundMethod" TEXT,
    ADD COLUMN IF NOT EXISTS "refundReference" TEXT,
    ADD COLUMN IF NOT EXISTS "refundType" TEXT,
    ADD COLUMN IF NOT EXISTS "refundedByUserId" TEXT,
    ADD COLUMN IF NOT EXISTS "refundedAt" TIMESTAMP(3);

-- AlterTable Booking
ALTER TABLE "Booking"
    ADD COLUMN IF NOT EXISTS "userId" TEXT;

-- Enforce Unique Active Unit Number per Property at the PostgreSQL level
CREATE UNIQUE INDEX IF NOT EXISTS "unique_unit_number_per_property_active" 
ON "Unit" ("propertyId", "unitNumber") 
WHERE ("publicationStatus" != 'archived');
