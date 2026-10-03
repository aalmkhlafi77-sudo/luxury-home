-- Migration: 20261003_03_add_building_floor_unit_parking_integrity
-- Adds unique constraints for Floor(propertyId, number), Unit(propertyId, unitNumber), and ParkingSpot(propertyId, spotNumber)
-- Includes orphan/duplicate checks before applying constraints

BEGIN;

-- 1. Check duplicate Floor (propertyId, number)
DO $$
BEGIN
  IF EXISTS (
    SELECT "propertyId", "number", COUNT(*)
    FROM "Floor"
    GROUP BY "propertyId", "number"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate floor numbers found in same property; resolve duplicates before applying unique constraint';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Floor_propertyId_number_key'
  ) THEN
    ALTER TABLE "Floor" ADD CONSTRAINT "Floor_propertyId_number_key" UNIQUE ("propertyId", "number");
  END IF;
END $$;

-- 2. Check duplicate Unit (propertyId, unitNumber)
DO $$
BEGIN
  IF EXISTS (
    SELECT "propertyId", "unitNumber", COUNT(*)
    FROM "Unit"
    WHERE "publicationStatus" != 'archived'
    GROUP BY "propertyId", "unitNumber"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate unit numbers found in same property; resolve duplicates before applying unique constraint';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Unit_propertyId_unitNumber_key'
  ) THEN
    ALTER TABLE "Unit" ADD CONSTRAINT "Unit_propertyId_unitNumber_key" UNIQUE ("propertyId", "unitNumber");
  END IF;
END $$;

-- 3. Check duplicate ParkingSpot (propertyId, spotNumber)
DO $$
BEGIN
  IF EXISTS (
    SELECT "propertyId", "spotNumber", COUNT(*)
    FROM "ParkingSpot"
    GROUP BY "propertyId", "spotNumber"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate parking spot numbers found in same property; resolve duplicates before applying unique constraint';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ParkingSpot_propertyId_spotNumber_key'
  ) THEN
    ALTER TABLE "ParkingSpot" ADD CONSTRAINT "ParkingSpot_propertyId_spotNumber_key" UNIQUE ("propertyId", "spotNumber");
  END IF;
END $$;

COMMIT;
