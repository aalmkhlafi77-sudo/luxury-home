-- Migration: Add SecurityDepositTransaction table & Correct Unit uniqueness to unarchived
CREATE TABLE IF NOT EXISTS "SecurityDepositTransaction" (
    "id" TEXT NOT NULL,
    "depositId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "reason" TEXT,
    "executedByUserId" TEXT,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "idempotencyKey" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityDepositTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SecurityDepositTransaction_depositId_idx" ON "SecurityDepositTransaction"("depositId");
CREATE UNIQUE INDEX IF NOT EXISTS "SecurityDepositTransaction_idempotencyKey_key" ON "SecurityDepositTransaction"("idempotencyKey");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'SecurityDepositTransaction_depositId_fkey'
    ) THEN
        ALTER TABLE "SecurityDepositTransaction" ADD CONSTRAINT "SecurityDepositTransaction_depositId_fkey" 
        FOREIGN KEY ("depositId") REFERENCES "SecurityDepositRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Ensure partial unique index exists for active/unarchived units per property
CREATE UNIQUE INDEX IF NOT EXISTS "unique_unit_number_per_property_active" 
ON "Unit" ("propertyId", "unitNumber") 
WHERE ("publicationStatus" != 'archived');
