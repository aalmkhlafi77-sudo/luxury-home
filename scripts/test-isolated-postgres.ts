/**
 * Isolated PostgreSQL Persistence & Real DB Verification Suite (Task 4)
 * 
 * Strict Requirement:
 * - Must connect to real PostgreSQL database via DATABASE_URL or TEST_DATABASE_URL.
 * - Fails and refuses any fallback if database is not reachable.
 * - If no PostgreSQL is available in environment, explicitly reports NOT EXECUTED.
 * - Verifies real database tables, relations, exclusion constraints, and survival across server restarts.
 */

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

async function main() {
  console.log('=====================================================');
  console.log('🐘 PostgreSQL Isolated Database & Persistence Verification');
  console.log('=====================================================');

  const dbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

  if (!dbUrl) {
    console.log('\n⚠️ [NOT EXECUTED / غير منفذ]');
    console.log('لم يتم تنفيذ هذا الاختبار لعدم توفر خادم PostgreSQL معزول أو متغير بيئة DATABASE_URL في بيئة الحاوية.');
    console.log('وفقاً لشروط الاعتماد الصريحة: "إذا لم تتوفر قاعدة PostgreSQL، صرّح بأن الاختبار لم يُنفذ. لا تستبدله باختبار JSON ثم تصفه بأنه ناجح على قاعدة البيانات."');
    console.log('النتيجة المعلنة رسمياً: لم يُنفذ لاختفاء خدمة PostgreSQL المحلية.');
    console.log('=====================================================\n');
    return;
  }

  console.log('\n[1/6] Connecting strictly to PostgreSQL...');
  const prisma = new PrismaClient({
    datasources: {
      db: { url: dbUrl }
    }
  });

  try {
    await prisma.$connect();
    console.log('✅ Connected to isolated PostgreSQL successfully.');

    // 2. Apply Migrations
    console.log('\n[2/6] Applying Prisma migrations to test database...');
    execSync('npx prisma migrate deploy', { stdio: 'inherit', env: { ...process.env, DATABASE_URL: dbUrl } });
    console.log('✅ Migrations applied.');

    // 3. Create isolated records directly in PostgreSQL
    console.log('\n[3/6] Inserting Property, Floor, and complete Unit records directly...');
    const testProp = await prisma.property.create({
      data: {
        code: `PG-BLD-${Date.now().toString().slice(-4)}`,
        name: 'برج التحقق من PostgreSQL',
        address: 'طريق الملك فهد',
        city: 'الرياض',
        district: 'النخيل',
        floorsCount: 5
      }
    });

    const testFloor = await prisma.floor.create({
      data: {
        propertyId: testProp.id,
        number: 3,
        name: 'الطابق الثالث'
      }
    });

    const unitNumber = `PG-${Date.now().toString().slice(-4)}`;
    const testUnit = await prisma.unit.create({
      data: {
        propertyId: testProp.id,
        floorId: testFloor.id,
        unitNumber,
        title: 'شقة فاخرة - قاعدة بيانات فعلية',
        titleEn: 'Real DB Luxury Unit',
        type: 'apartment',
        areaSqm: 140,
        floorNumber: 3,
        maxGuests: 5,
        bedroomsCount: 3,
        bathroomsCount: 2,
        bedsCount: 3,
        furnishingStatus: 'furnished',
        allowDaily: false, // Explicit false
        dailyRate: 0,
        dailySecurityDeposit: 0, // Explicit zero
        allowMonthly: true,
        monthlyRate: 14500,
        monthlySecurityDeposit: 0, // Explicit zero
        allowYearly: true,
        annualRate: 155000,
        yearlySecurityDeposit: 0, // Explicit zero
        cleaningFee: 0, // Explicit zero
        securityDeposit: 0, // Explicit zero
        taxPercentage: 0, // Explicit zero
        operationalStatus: 'ready',
        occupancyStatus: 'vacant',
        publicationStatus: 'published',
        amenities: ['wifi', 'smart_lock', 'ev_charger'],
        images: ['https://example.com/pg_unit.jpg'],
        notes: 'ملاحظة مباشرة في PostgreSQL'
      }
    });

    console.log(`✅ Unit inserted directly with ID: ${testUnit.id} in Property: ${testProp.id}`);

    // 4. Query directly via fresh client to verify persistence of all fields and zeros
    console.log('\n[4/6] Verifying records and relations directly in PostgreSQL...');
    const queriedUnit = await prisma.unit.findUnique({
      where: { id: testUnit.id },
      include: { property: true, floor: true }
    });

    if (!queriedUnit) throw new Error('Unit not found in DB!');
    if (queriedUnit.propertyId !== testProp.id) throw new Error('Property relation mismatch!');
    if (queriedUnit.floorId !== testFloor.id) throw new Error('Floor relation mismatch!');
    if (queriedUnit.allowDaily !== false) throw new Error('allowDaily boolean lost in DB!');
    if (Number(queriedUnit.dailySecurityDeposit) !== 0) throw new Error('dailySecurityDeposit zero lost in DB!');
    if (Number(queriedUnit.taxPercentage) !== 0) throw new Error('taxPercentage zero lost in DB!');
    if (Number(queriedUnit.cleaningFee) !== 0) throw new Error('cleaningFee zero lost in DB!');

    console.log('✅ All fields, relationships, false booleans, and 0 values verified strictly in PostgreSQL.');

    // 5. Test Restart Survival: Disconnect and Reconnect
    console.log('\n[5/6] Simulating server shutdown, restart, and fresh connection query...');
    await prisma.$disconnect();
    
    // Fresh client instance simulating fresh process/session
    const freshPrisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
    await freshPrisma.$connect();

    const reReadUnit = await freshPrisma.unit.findUnique({
      where: { id: testUnit.id }
    });
    if (!reReadUnit || Number(reReadUnit.dailySecurityDeposit) !== 0 || reReadUnit.allowDaily !== false) {
      throw new Error('Fresh session query failed after reconnection!');
    }
    console.log('✅ Records and zero values persisted intact across restart/reconnection.');

    // 6. Test PostgreSQL Exclusion Constraint on Allocations
    console.log('\n[6/6] Testing PostgreSQL Exclusion Constraint (active allocations conflict)...');
    const start = new Date('2026-12-10T15:00:00.000Z');
    const end = new Date('2026-12-15T12:00:00.000Z');

    const alloc1 = await freshPrisma.unitAllocation.create({
      data: {
        unitId: testUnit.id,
        startDate: start,
        endDate: end,
        rentalType: 'DAILY',
        purpose: 'booking',
        status: 'active'
      }
    });

    console.log(`✅ Created active allocation: ${alloc1.id}`);

    // Try creating overlapping active allocation (must throw exclusion conflict)
    let exclusionCaught = false;
    try {
      await freshPrisma.unitAllocation.create({
        data: {
          unitId: testUnit.id,
          startDate: new Date('2026-12-12T15:00:00.000Z'),
          endDate: new Date('2026-12-14T12:00:00.000Z'),
          rentalType: 'DAILY',
          purpose: 'booking',
          status: 'active'
        }
      });
    } catch (err: any) {
      exclusionCaught = true;
      console.log('✅ Overlapping active allocation rejected by PostgreSQL constraint.');
    }

    if (!exclusionCaught) {
      throw new Error('PostgreSQL exclusion constraint did not prevent overlapping active allocation!');
    }

    // Cancel allocation and verify re-allocation succeeds
    await freshPrisma.unitAllocation.update({
      where: { id: alloc1.id },
      data: { status: 'cancelled' }
    });

    const allocReBook = await freshPrisma.unitAllocation.create({
      data: {
        unitId: testUnit.id,
        startDate: start,
        endDate: end,
        rentalType: 'DAILY',
        purpose: 'booking',
        status: 'active'
      }
    });
    console.log(`✅ Re-booking after cancellation succeeded with new allocation: ${allocReBook.id}`);

    // Cleanup test data from PostgreSQL
    await freshPrisma.unitAllocation.deleteMany({ where: { unitId: testUnit.id } });
    await freshPrisma.unit.delete({ where: { id: testUnit.id } });
    await freshPrisma.floor.delete({ where: { id: testFloor.id } });
    await freshPrisma.property.delete({ where: { id: testProp.id } });
    await freshPrisma.$disconnect();

    console.log('\n=====================================================');
    console.log('🎉 REAL POSTGRESQL VERIFICATION PASSED COMPLETELY');
    console.log('=====================================================');
  } catch (e) {
    console.error('❌ PostgreSQL verification failure:', e);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
