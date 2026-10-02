-- PostgreSQL Migration: Add Exclusion Constraint for Overlapping Booking/Lease Allocations
-- Prevents double bookings at database level via btree_gist extension

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Drop legacy conflicting constraints if exist
ALTER TABLE "UnitAllocation" DROP CONSTRAINT IF EXISTS "no_overlapping_allocations";
ALTER TABLE "UnitAllocation" DROP CONSTRAINT IF EXISTS "no_overlapping_active_allocations";

-- Add Exclusion Constraint for non-overlapping timestamp range per unit ONLY for active allocations
ALTER TABLE "UnitAllocation" 
ADD CONSTRAINT "no_overlapping_active_allocations" 
EXCLUDE USING gist (
  "unitId" WITH =, 
  tsrange("startDate", "endDate", '[)') WITH &&
)
WHERE ("status" = 'active');

