-- AlterTable PaymentRecord
ALTER TABLE "PaymentRecord"
    ADD COLUMN IF NOT EXISTS "installmentId" TEXT,
    ADD COLUMN IF NOT EXISTS "sourceType" TEXT DEFAULT 'direct_payment',
    ADD COLUMN IF NOT EXISTS "affectsCash" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable SecurityDepositRecord
ALTER TABLE "SecurityDepositRecord"
    ADD COLUMN IF NOT EXISTS "rentAppliedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable SecurityDepositTransaction
ALTER TABLE "SecurityDepositTransaction"
    ADD COLUMN IF NOT EXISTS "targetLeaseId" TEXT,
    ADD COLUMN IF NOT EXISTS "targetInstallmentId" TEXT;

-- AddForeignKey: PaymentRecord to LeaseInstallment
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PaymentRecord_installmentId_fkey'
  ) THEN
    ALTER TABLE "PaymentRecord"
      ADD CONSTRAINT "PaymentRecord_installmentId_fkey"
      FOREIGN KEY ("installmentId") REFERENCES "LeaseInstallment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey: SecurityDepositTransaction to Lease
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SecurityDepositTransaction_targetLeaseId_fkey'
  ) THEN
    ALTER TABLE "SecurityDepositTransaction"
      ADD CONSTRAINT "SecurityDepositTransaction_targetLeaseId_fkey"
      FOREIGN KEY ("targetLeaseId") REFERENCES "Lease"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey: SecurityDepositTransaction to LeaseInstallment
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SecurityDepositTransaction_targetInstallmentId_fkey'
  ) THEN
    ALTER TABLE "SecurityDepositTransaction"
      ADD CONSTRAINT "SecurityDepositTransaction_targetInstallmentId_fkey"
      FOREIGN KEY ("targetInstallmentId") REFERENCES "LeaseInstallment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
