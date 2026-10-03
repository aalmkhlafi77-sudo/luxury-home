-- Migration: 20261003_04_fix_unit_archived_uniqueness
-- Replaces the full rigid Unit unique constraint with a partial unique index on non-archived units.
-- This aligns DB constraints with application policy: Archived units can share unit numbers upon re-creation/archival.

BEGIN;

-- 1. Drop rigid full constraint if present
ALTER TABLE "Unit" DROP CONSTRAINT IF EXISTS "Unit_propertyId_unitNumber_key";

-- 2. Pre-check: Ensure no duplicate unit numbers exist among active/published/draft units
DO $$
BEGIN
  IF EXISTS (
    SELECT "propertyId", "unitNumber", COUNT(*)
    FROM "Unit"
    WHERE "publicationStatus" != 'archived'
    GROUP BY "propertyId", "unitNumber"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate unit numbers found among active units in same property; resolve duplicates before creating partial unique index';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'Unit_propertyId_unitNumber_active_key'
  ) THEN
    CREATE UNIQUE INDEX "Unit_propertyId_unitNumber_active_key"
      ON "Unit" ("propertyId", "unitNumber")
      WHERE "publicationStatus" != 'archived';
  END IF;
END $$;

COMMIT;
