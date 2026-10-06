-- Safe Additive Migration: Multi-City Support for Luxury Home (Single-Company Hierarchy)
-- Hierarchy: Company -> Country -> Region (Optional) -> City -> Property (Building) -> Floor -> Unit

BEGIN;

-- 1. Create City table if it does not exist
CREATE TABLE IF NOT EXISTS "City" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "region" TEXT,
    "country" TEXT NOT NULL DEFAULT 'المملكة العربية السعودية',
    "status" TEXT NOT NULL DEFAULT 'active',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- 2. Unique constraint to prevent unintended duplicate cities within the same region and country
CREATE UNIQUE INDEX IF NOT EXISTS "City_name_region_country_key"
ON "City"("name", "region", "country");

-- 3. Seed initial approved cities (الرياض، الدمام، جدة) safely without duplication
INSERT INTO "City" ("id", "name", "nameEn", "region", "country", "status", "displayOrder", "createdAt", "updatedAt")
SELECT 'city-riyadh', 'الرياض', 'Riyadh', 'منطقة الرياض', 'المملكة العربية السعودية', 'active', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM "City" WHERE TRIM("name") = 'الرياض' AND "country" = 'المملكة العربية السعودية'
);

INSERT INTO "City" ("id", "name", "nameEn", "region", "country", "status", "displayOrder", "createdAt", "updatedAt")
SELECT 'city-dammam', 'الدمام', 'Dammam', 'المنطقة الشرقية', 'المملكة العربية السعودية', 'active', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM "City" WHERE TRIM("name") = 'الدمام' AND "country" = 'المملكة العربية السعودية'
);

INSERT INTO "City" ("id", "name", "nameEn", "region", "country", "status", "displayOrder", "createdAt", "updatedAt")
SELECT 'city-jeddah', 'جدة', 'Jeddah', 'منطقة مكة المكرمة', 'المملكة العربية السعودية', 'active', 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM "City" WHERE TRIM("name") = 'جدة' AND "country" = 'المملكة العربية السعودية'
);

-- 4. Migrate any existing distinct Property.city values into City table without loss or duplication
INSERT INTO "City" ("id", "name", "nameEn", "region", "country", "status", "displayOrder", "createdAt", "updatedAt")
SELECT
    'city-migrated-' || md5(TRIM(p."city")),
    TRIM(p."city"),
    NULL,
    NULL,
    'المملكة العربية السعودية',
    'active',
    10,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT "city"
    FROM "Property"
    WHERE "city" IS NOT NULL AND TRIM("city") <> ''
) p
WHERE NOT EXISTS (
    SELECT 1 FROM "City" c WHERE TRIM(c."name") = TRIM(p."city")
);

-- 5. Add cityId column to Property table additively (preserving existing city, address, district columns)
ALTER TABLE "Property"
ADD COLUMN IF NOT EXISTS "cityId" TEXT;

-- 6. Backfill Property.cityId from City.id matching Property.city
UPDATE "Property" p
SET "cityId" = c."id"
FROM "City" c
WHERE p."cityId" IS NULL
  AND TRIM(COALESCE(p."city", 'الرياض')) = TRIM(c."name");

-- 7. Verify all existing properties with non-null cityId reference a valid City before adding FK constraint
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "Property" p
        LEFT JOIN "City" c ON p."cityId" = c."id"
        WHERE p."cityId" IS NOT NULL AND c."id" IS NULL
    ) THEN
        RAISE EXCEPTION 'Migration verification failed: Found Property.cityId values that do not exist in City table';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'Property_cityId_fkey'
    ) THEN
        ALTER TABLE "Property"
        ADD CONSTRAINT "Property_cityId_fkey"
        FOREIGN KEY ("cityId") REFERENCES "City"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

COMMIT;
