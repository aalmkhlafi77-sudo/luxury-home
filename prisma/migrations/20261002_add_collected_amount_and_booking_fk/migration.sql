BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "SecurityDepositRecord" d
    LEFT JOIN "Booking" b ON b."id" = d."bookingId"
    WHERE d."bookingId" IS NOT NULL
      AND b."id" IS NULL
  ) THEN
    RAISE EXCEPTION
      'Orphan deposit booking references found; reconcile before migration';
  END IF;
END $$;

ALTER TABLE "SecurityDepositRecord"
  ADD COLUMN IF NOT EXISTS "collectedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "collectionReference" TEXT,
  ADD COLUMN IF NOT EXISTS "collectionVerifiedAt" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SecurityDepositRecord_bookingId_fkey'
  ) THEN
    ALTER TABLE "SecurityDepositRecord"
      ADD CONSTRAINT "SecurityDepositRecord_bookingId_fkey"
      FOREIGN KEY ("bookingId") REFERENCES "Booking"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SecurityDepositRecord_collectedAmount_nonnegative'
  ) THEN
    ALTER TABLE "SecurityDepositRecord"
      ADD CONSTRAINT "SecurityDepositRecord_collectedAmount_nonnegative"
      CHECK ("collectedAmount" >= 0);
  END IF;
END $$;

COMMIT;
