-- AlterTable PaymentRecord
ALTER TABLE "PaymentRecord"
    ADD COLUMN IF NOT EXISTS "installmentId" TEXT,
    ADD COLUMN IF NOT EXISTS "sourceType" TEXT DEFAULT 'direct_payment',
    ADD COLUMN IF NOT EXISTS "affectsCash" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable SecurityDepositRecord
ALTER TABLE "SecurityDepositRecord"
    ADD COLUMN IF NOT EXISTS "rentAppliedAmount" DECIMAL(12, 2) NOT NULL DEFAULT 0;

-- AlterTable SecurityDepositTransaction
ALTER TABLE "SecurityDepositTransaction"
    ADD COLUMN IF NOT EXISTS "targetLeaseId" TEXT,
    ADD COLUMN IF NOT EXISTS "targetInstallmentId" TEXT;
