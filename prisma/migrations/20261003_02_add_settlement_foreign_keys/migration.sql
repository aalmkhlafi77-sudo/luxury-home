-- Migration: 20261003_02_add_settlement_foreign_keys
-- Adds foreign key constraints with orphan checks

BEGIN;

-- 1. Check orphan PaymentRecord -> LeaseInstallment references
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "PaymentRecord" p
    LEFT JOIN "LeaseInstallment" i
      ON i."id" = p."installmentId"
    WHERE p."installmentId" IS NOT NULL
      AND i."id" IS NULL
  ) THEN
    RAISE EXCEPTION
      'Orphan payment installment references require reconciliation before applying foreign key constraint';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'PaymentRecord_installmentId_fkey'
      AND conrelid = '"PaymentRecord"'::regclass
  ) THEN
    ALTER TABLE "PaymentRecord"
      ADD CONSTRAINT "PaymentRecord_installmentId_fkey"
      FOREIGN KEY ("installmentId")
      REFERENCES "LeaseInstallment"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

-- 2. Check orphan SecurityDepositTransaction -> Lease references
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "SecurityDepositTransaction" t
    LEFT JOIN "Lease" l
      ON l."id" = t."targetLeaseId"
    WHERE t."targetLeaseId" IS NOT NULL
      AND l."id" IS NULL
  ) THEN
    RAISE EXCEPTION
      'Orphan security deposit transaction target lease references require reconciliation';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'SecurityDepositTransaction_targetLeaseId_fkey'
      AND conrelid = '"SecurityDepositTransaction"'::regclass
  ) THEN
    ALTER TABLE "SecurityDepositTransaction"
      ADD CONSTRAINT "SecurityDepositTransaction_targetLeaseId_fkey"
      FOREIGN KEY ("targetLeaseId")
      REFERENCES "Lease"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

-- 3. Check orphan SecurityDepositTransaction -> LeaseInstallment references
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "SecurityDepositTransaction" t
    LEFT JOIN "LeaseInstallment" i
      ON i."id" = t."targetInstallmentId"
    WHERE t."targetInstallmentId" IS NOT NULL
      AND i."id" IS NULL
  ) THEN
    RAISE EXCEPTION
      'Orphan security deposit transaction target installment references require reconciliation';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'SecurityDepositTransaction_targetInstallmentId_fkey'
      AND conrelid = '"SecurityDepositTransaction"'::regclass
  ) THEN
    ALTER TABLE "SecurityDepositTransaction"
      ADD CONSTRAINT "SecurityDepositTransaction_targetInstallmentId_fkey"
      FOREIGN KEY ("targetInstallmentId")
      REFERENCES "LeaseInstallment"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
