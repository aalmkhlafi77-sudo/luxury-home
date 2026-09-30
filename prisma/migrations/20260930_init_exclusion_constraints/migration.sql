-- PostgreSQL Migration: Add Exclusion Constraint for Overlapping Booking/Lease Allocations
-- Prevents double bookings at database level via btree_gist extension

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Drop constraint if exists
ALTER TABLE "UnitAllocation" DROP CONSTRAINT IF EXISTS "no_overlapping_allocations";

-- Add Exclusion Constraint for non-overlapping daterange per unit
ALTER TABLE "UnitAllocation" 
ADD CONSTRAINT "no_overlapping_allocations" 
EXCLUDE USING gist (
  "unitId" WITH =, 
  daterange("startDate"::date, "endDate"::date, '[)') WITH &&
);
