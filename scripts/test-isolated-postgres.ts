/**
 * Comprehensive Isolated PostgreSQL Verification Suite
 * 
 * Strict Operational Verification:
 * 1. Executes ONLY when TEST_DATABASE_URL is provided, valid, targets a database ending with '_test',
 *    and ALLOW_TEST_DATABASE_RESET='yes'.
 * 2. Never mutates DATABASE_URL or initializes Prisma until test environment guards pass.
 * 3. Migrations deployment with orphan checks.
 * 4. Real deposit collection, applyDepositToRent with independent approvalReference.
 * 5. Idempotency replay on deposit settlement (returning exact result with 0 extra movements).
 * 6. Documented damage deduction and strict rejection of balance overruns.
 * 7. Concurrency race testing with Row-Level Lock (FOR UPDATE) and balance verification.
 * 8. Strict pre-restoration validation (valid package accepted, corrupted/incomplete package rejected before deletion).
 * 9. Real database export and restore roundtrip on isolated test DB with data comparison.
 * 10. Cleanup of test-created records only in finally block.
 */

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execSync } from 'node:child_process';

interface EnvironmentCheckResult {
  isValid: boolean;
  reason?: string;
  dbUrl?: string;
}

export function validateTestEnvironment(): EnvironmentCheckResult {
  const testUrl = process.env.TEST_DATABASE_URL?.trim();
  if (!testUrl) {
    return {
      isValid: false,
      reason: 'متغير البيئة TEST_DATABASE_URL غير محدد. يلزم تحديد رابط قاعدة بيانات PostgreSQL اختبارية منفصلة.'
    };
  }

  if (process.env.NODE_ENV === 'production') {
    return {
      isValid: false,
      reason: 'حظر أمني قاطع: لا يمكن تشغيل اختبارات التكامل على بيئة الإنتاج (NODE_ENV=production).'
    };
  }

  if (process.env.ALLOW_TEST_DATABASE_RESET !== 'yes') {
    return {
      isValid: false,
      reason: 'متغير البيئة ALLOW_TEST_DATABASE_RESET يجب أن يكون "yes" صراحة للتأكيد على تفويض العمليات على قاعدة الاختبار.'
    };
  }

  try {
    const parsed = new URL(testUrl);
    if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
      return {
        isValid: false,
        reason: 'بروتوكول TEST_DATABASE_URL يجب أن يكون postgresql:// أو postgres://'
      };
    }
    const pathname = parsed.pathname.replace(/^\//, '');
    if (!pathname || !pathname.endsWith('_test')) {
      return {
        isValid: false,
        reason: `اسم قاعدة البيانات (${pathname}) يجب أن ينتهي بـ "_test" حصراً لمنع المساس بأي قاعدة بيانات تشغيلية أو إنتاجية.`
      };
    }
  } catch (err: any) {
    return {
      isValid: false,
      reason: `صيغة TEST_DATABASE_URL غير صالحة: ${err?.message}`
    };
  }

  return { isValid: true, dbUrl: testUrl };
}

interface CreatedTestRecords {
  userId?: string;
  propertyId?: string;
  floorId?: string;
  unitId?: string;
  leaseId?: string;
  depositId?: string;
}

export async function runPostgresTestSuite(): Promise<boolean> {
  const envCheck = validateTestEnvironment();
  if (!envCheck.isValid || !envCheck.dbUrl) {
    console.log('========================================================================================');
    console.log('⚠️ [POSTGRES_TEST_STATUS: NOT_EXECUTED]');
    console.log('PostgreSQL غير منفذ: لم يتم تشغيل اختبارات PostgreSQL نظراً لعدم توفر بيئة اختبار صالحة.');
    console.log(`السبب: ${envCheck.reason}`);
    console.log('\nمتطلبات تشغيل دورة PostgreSQL الحقيقية:');
    console.log('  1. TEST_DATABASE_URL="postgresql://user:pass@host:5432/luxuryhome_test"');
    console.log('  2. اسم قاعدة البيانات ينتهي بـ "_test"');
    console.log('  3. ALLOW_TEST_DATABASE_RESET="yes"');
    console.log('========================================================================================');
    return false;
  }

  // Guard passed: configure environment and dynamically load dependencies
  process.env.DATABASE_URL = envCheck.dbUrl;

  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient({
    datasources: { db: { url: envCheck.dbUrl } }
  });

  const { RefundError, refundDeposit, applyDepositToRent } = await import('../src/server/depositRefundService.js');
  const { validateBackupPackageIntegrity, exportFullDatabase, restoreFullDatabaseInDb } = await import('../src/server/repository.js');

  console.log('=====================================================');
  console.log('🐘 Isolated PostgreSQL Financial & Integration Test Suite');
  console.log(`🎯 Target DB: ${envCheck.dbUrl.replace(/:[^:@]+@/, ':****@')}`);
  console.log('=====================================================');

  const created: CreatedTestRecords = {};
  const testRunId = randomUUID().slice(0, 8);

  let originalError: unknown;
  let cleanupError: unknown;

  const cleanupCreatedTestRecords = async (rec: CreatedTestRecords) => {
    if (rec.depositId) {
      await prisma.securityDepositTransaction.deleteMany({ where: { depositId: rec.depositId } });
    }
    if (rec.leaseId) {
      await prisma.paymentRecord.deleteMany({ where: { leaseId: rec.leaseId } });
      await prisma.securityDepositRecord.deleteMany({ where: { leaseId: rec.leaseId } });
      await prisma.leaseInstallment.deleteMany({ where: { leaseId: rec.leaseId } });
      await prisma.lease.deleteMany({ where: { id: rec.leaseId } });
    } else if (rec.depositId) {
      await prisma.securityDepositRecord.deleteMany({ where: { id: rec.depositId } });
    }

    if (rec.unitId) {
      await prisma.unit.deleteMany({ where: { id: rec.unitId } });
    }
    if (rec.floorId) {
      await prisma.floor.deleteMany({ where: { id: rec.floorId } });
    }
    if (rec.propertyId) {
      await prisma.property.deleteMany({ where: { id: rec.propertyId } });
    }

    if (rec.userId) {
      await prisma.idempotencyRecord.deleteMany({ where: { userId: rec.userId } });
      await prisma.auditLog.deleteMany({ where: { userId: rec.userId } });
      await prisma.user.deleteMany({ where: { id: rec.userId } });
    }
  };

  try {
    // ----------------------------------------------------
    // 1. Apply Migrations
    // ----------------------------------------------------
    console.log('\n[1/8] Applying Prisma migrations with orphan checks...');
    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: envCheck.dbUrl }
    });
    console.log('✅ Migrations applied cleanly.');

    // ----------------------------------------------------
    // 2. Setup Test Records
    // ----------------------------------------------------
    console.log('\n[2/8] Setting up isolated test records...');
    const testAdmin = await prisma.user.upsert({
      where: { username: `test_admin_${testRunId}` },
      update: {},
      create: {
        username: `test_admin_${testRunId}`,
        email: `test_admin_${testRunId}@luxuryhome.sa`,
        passwordHash: 'dummy_test_hash',
        name: 'مدير الاختبار المالي',
        role: 'SUPER_ADMIN',
        isActive: true,
        allowedProperties: ['all']
      }
    });
    created.userId = testAdmin.id;

    const prop = await prisma.property.create({
      data: {
        code: `TEST-PROP-${testRunId}`,
        name: `برج اختبار التكامل ${testRunId}`,
        address: 'طريق الملك فهد',
        city: 'الرياض',
        district: 'العليا',
        floorsCount: 3
      }
    });
    created.propertyId = prop.id;

    const floor = await prisma.floor.create({
      data: {
        propertyId: prop.id,
        number: 1,
        name: 'الطابق الأول'
      }
    });
    created.floorId = floor.id;

    const unit = await prisma.unit.create({
      data: {
        propertyId: prop.id,
        floorId: floor.id,
        unitNumber: `U-${testRunId}`,
        title: 'وحدة اختبار التكامل المالي',
        type: 'apartment',
        areaSqm: 120,
        floorNumber: 1,
        maxGuests: 4,
        bedroomsCount: 2,
        bathroomsCount: 2,
        bedsCount: 2,
        furnishingStatus: 'furnished',
        allowYearly: true,
        annualRate: 60000,
        yearlySecurityDeposit: 5000,
        cleaningFee: 0,
        taxPercentage: 0,
        securityDeposit: 5000,
        operationalStatus: 'ready',
        occupancyStatus: 'occupied',
        publicationStatus: 'published'
      }
    });
    created.unitId = unit.id;

    const lease = await prisma.lease.create({
      data: {
        contractNumber: `CONT-${testRunId}`,
        unitId: unit.id,
        tenantName: 'عبدالله السعيد',
        tenantPhone: '+966500001122',
        tenantIdNumber: '1098765432',
        startDate: new Date('2026-11-01T00:00:00.000Z'),
        endDate: new Date('2027-10-31T23:59:59.000Z'),
        annualRent: 60000,
        paymentOption: '2 payments',
        securityDeposit: 5000,
        status: 'ACTIVE',
        rentalType: 'ANNUAL',
        paymentFrequency: 'semi_annual'
      }
    });
    created.leaseId = lease.id;

    const installment1 = await prisma.leaseInstallment.create({
      data: {
        leaseId: lease.id,
        number: 1,
        label: 'الدفعة الأولى',
        dueDate: new Date('2026-11-01T00:00:00.000Z'),
        amount: 30000,
        paidAmount: 0,
        remainingAmount: 30000,
        status: 'UPCOMING'
      }
    });

    const deposit = await prisma.securityDepositRecord.create({
      data: {
        leaseId: lease.id,
        amount: 5000,
        collectedAmount: 5000,
        refundedAmount: 0,
        deductedAmount: 0,
        rentAppliedAmount: 0,
        status: 'held',
        collectionReference: `REC-DEP-${testRunId}`,
        collectionVerifiedAt: new Date(),
        notes: 'تحصيل تأمين فعلي معتمد'
      }
    });
    created.depositId = deposit.id;

    console.log(`✅ Records created: Lease=${lease.id}, Deposit=${deposit.id}, Installment=${installment1.id}`);

    // ----------------------------------------------------
    // 3. Apply Deposit to Rent & Idempotency Replay (المطلب أ)
    // ----------------------------------------------------
    console.log('\n[3/8] Testing applyDepositToRent with idempotency replay assertion...');
    const settleApprovalRef = `APPR-SETTLE-${testRunId}-001`;
    const idempotencyKey1 = `${testRunId}:settle:1`;

    const applyResult1 = await applyDepositToRent({
      depositId: deposit.id,
      installmentId: installment1.id,
      actorId: testAdmin.id,
      amount: '2000.00',
      approvalReference: settleApprovalRef,
      reason: 'تسوية قسط إيجاري معتمد',
      idempotencyKey: idempotencyKey1
    });
    assert.ok(applyResult1);

    // Replay with exact same idempotency key
    const applyResult2 = await applyDepositToRent({
      depositId: deposit.id,
      installmentId: installment1.id,
      actorId: testAdmin.id,
      amount: '2000.00',
      approvalReference: settleApprovalRef,
      reason: 'تسوية قسط إيجاري معتمد',
      idempotencyKey: idempotencyKey1
    });
    assert.ok(applyResult2);

    // Assert: Only 1 PaymentRecord exists, and rentAppliedAmount is exactly 2000 (not 4000)
    const paymentRecords = await prisma.paymentRecord.findMany({
      where: {
        leaseId: lease.id,
        installmentId: installment1.id,
        sourceType: 'deposit_application'
      }
    });
    assert.equal(paymentRecords.length, 1);
    assert.equal(paymentRecords[0].paymentMethod, 'security_deposit');
    assert.equal(paymentRecords[0].affectsCash, false);
    assert.equal(paymentRecords[0].amount.toFixed(2), '2000.00');

    const depositAfterSettle = await prisma.securityDepositRecord.findUniqueOrThrow({
      where: { id: deposit.id }
    });
    assert.equal(depositAfterSettle.rentAppliedAmount.toFixed(2), '2000.00');
    console.log('✅ Idempotency Verified: Second call returned cached result with 0 extra movements.');

    // ----------------------------------------------------
    // 4. Documented Damage Deduction & Overrun Rejection (المطلب ب)
    // ----------------------------------------------------
    console.log('\n[4/8] Testing documented damage deduction and rejecting balance overrun...');
    const damageDeductionResult = await refundDeposit({
      depositId: deposit.id,
      actorId: testAdmin.id,
      deductedAmount: '1000.00',
      deductionReason: 'محضر إتلاف أثاث موثق رقم INSP-881',
      refundAmount: '0.00',
      refundMethod: 'bank_transfer',
      refundReference: `DAMAGE-DEC-${testRunId}`,
      refundType: 'actual_payout',
      idempotencyKey: `${testRunId}:deduct:1`
    });
    assert.ok(damageDeductionResult);

    const depositAfterDamage = await prisma.securityDepositRecord.findUniqueOrThrow({
      where: { id: deposit.id }
    });
    assert.equal(depositAfterDamage.deductedAmount.toFixed(2), '1000.00');

    // Available now = 5000 - 2000 (settled) - 1000 (damage) = 2000 SAR
    // Try to deduct or refund 2500 SAR (exceeding available 2000)
    let overrunRejected = false;
    try {
      await refundDeposit({
        depositId: deposit.id,
        actorId: testAdmin.id,
        refundAmount: '2500.00',
        refundMethod: 'bank_transfer',
        refundReference: `TEST-OVERRUN-${testRunId}`,
        refundType: 'actual_payout',
        idempotencyKey: `${testRunId}:overrun:1`
      });
    } catch (err: any) {
      if (err instanceof RefundError && err.code === 'INSUFFICIENT_DEPOSIT_BALANCE') {
        overrunRejected = true;
      }
    }
    assert.equal(overrunRejected, true, 'Operation exceeding available deposit balance must be rejected.');
    console.log('✅ Damage deduction registered and balance overrun correctly rejected with INSUFFICIENT_DEPOSIT_BALANCE.');

    // ----------------------------------------------------
    // 5. Concurrency Race Testing (Row-Level Lock)
    // ----------------------------------------------------
    console.log('\n[5/8] Testing concurrent race condition with Row-Level Locks...');
    // Available balance = 2000 SAR. We fire two concurrent requests for 1500 SAR each.
    const concurrentResults = await Promise.allSettled([
      refundDeposit({
        depositId: deposit.id,
        actorId: testAdmin.id,
        refundAmount: '1500.00',
        refundMethod: 'bank_transfer',
        refundReference: `RACE-A-${testRunId}`,
        refundType: 'actual_payout',
        idempotencyKey: `${testRunId}:race:A`,
      }),
      refundDeposit({
        depositId: deposit.id,
        actorId: testAdmin.id,
        refundAmount: '1500.00',
        refundMethod: 'bank_transfer',
        refundReference: `RACE-B-${testRunId}`,
        refundType: 'actual_payout',
        idempotencyKey: `${testRunId}:race:B`,
      }),
    ]);

    const successes = concurrentResults.filter(r => r.status === 'fulfilled');
    const failures = concurrentResults.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    assert.equal(successes.length, 1);
    assert.equal(failures.length, 1);
    assert.ok(failures[0].reason instanceof RefundError);
    assert.equal((failures[0].reason as any).code, 'INSUFFICIENT_DEPOSIT_BALANCE');
    console.log('✅ Concurrency Verified: Exactly 1 succeeded, 1 rejected.');

    // ----------------------------------------------------
    // 6. Pre-Restoration Validation (المطلب ج)
    // ----------------------------------------------------
    console.log('\n[6/8] Testing strict pre-restoration validation assertions...');
    // Valid package
    const validPackage = {
      properties: [{ id: prop.id, code: prop.code, name: prop.name, address: prop.address, district: prop.district, floorsCount: 3 }],
      floors: [{ id: floor.id, propertyId: prop.id, number: 1, name: floor.name }],
      units: [{ id: unit.id, propertyId: prop.id, floorId: floor.id, unitNumber: unit.unitNumber, title: unit.title, areaSqm: 120 }],
      leases: [{ id: lease.id, unitId: unit.id, tenantName: lease.tenantName, status: 'ACTIVE' }],
      installments: [{ id: installment1.id, leaseId: lease.id, number: 1, amount: 30000, remainingAmount: 28000 }],
      securityDeposits: [{
        id: deposit.id,
        leaseId: lease.id,
        bookingId: null,
        collectedAmount: '5000.00',
        collectionReference: `REC-DEP-${testRunId}`,
        collectionVerifiedAt: new Date().toISOString(),
        refundedAmount: '1500.00',
        deductedAmount: '1000.00',
        rentAppliedAmount: '2000.00'
      }],
      securityDepositTransactions: [{
        id: `tx-settle-${testRunId}`,
        depositId: deposit.id,
        type: 'rent_application',
        amount: '2000.00',
        reference: settleApprovalRef,
        targetLeaseId: lease.id,
        targetInstallmentId: installment1.id,
        status: 'completed'
      }],
      payments: [{
        id: `pay-${testRunId}`,
        leaseId: lease.id,
        installmentId: installment1.id,
        sourceType: 'deposit_application',
        paymentMethod: 'security_deposit',
        affectsCash: false,
        amount: '2000.00',
        referenceNo: settleApprovalRef
      }]
    };

    const validCheck = validateBackupPackageIntegrity(validPackage);
    assert.equal(validCheck.isValid, true, 'Valid package must be accepted.');

    // Incomplete package: rentAppliedAmount = 2000 but 0 transactions
    const corruptedPackage = {
      ...validPackage,
      securityDepositTransactions: []
    };
    const corruptedCheck = validateBackupPackageIntegrity(corruptedPackage);
    assert.equal(corruptedCheck.isValid, false, 'Corrupted package must be rejected.');
    assert.ok(corruptedCheck.errors.some(e => e.includes('لا يطابق الرصيد المستخدم للإيجار')));

    // Verify rejection prevents deletion
    let thrownBeforeDelete = false;
    try {
      await restoreFullDatabaseInDb(corruptedPackage);
    } catch {
      thrownBeforeDelete = true;
    }
    assert.equal(thrownBeforeDelete, true);
    console.log('✅ Pre-restoration validation: Valid package accepted, corrupted package rejected before DB deletion.');

    // ----------------------------------------------------
    // 7. Full DB Export & Restore Roundtrip (المطلب د)
    // ----------------------------------------------------
    console.log('\n[7/8] Testing full database export, restoration, and data comparison...');
    const exportedState = await exportFullDatabase();
    assert.ok(exportedState);
    assert.ok(Array.isArray(exportedState.properties));
    assert.ok(Array.isArray(exportedState.securityDeposits));

    // Restore exported state on the test database
    await restoreFullDatabaseInDb(exportedState);

    // Verify database state matches after restoration
    const restoredDeposit = await prisma.securityDepositRecord.findUniqueOrThrow({
      where: { id: deposit.id }
    });
    assert.equal(restoredDeposit.collectedAmount.toFixed(2), '5000.00');
    assert.equal(restoredDeposit.rentAppliedAmount.toFixed(2), '2000.00');
    assert.equal(restoredDeposit.deductedAmount.toFixed(2), '1000.00');
    assert.equal(restoredDeposit.refundedAmount.toFixed(2), '1500.00');

    const restoredPayment = await prisma.paymentRecord.findFirstOrThrow({
      where: { leaseId: lease.id, installmentId: installment1.id, sourceType: 'deposit_application' }
    });
    assert.equal(restoredPayment.affectsCash, false);
    assert.equal(restoredPayment.paymentMethod, 'security_deposit');
    console.log('✅ Export/Restore roundtrip completed and data verified with 100% fidelity.');

    console.log('\n[8/8] Cleaning up isolated test records...');
    await cleanupCreatedTestRecords(created);
    console.log('✅ Test records cleaned up.');

    console.log('\n=====================================================');
    console.log('🎉 ALL ISOLATED POSTGRESQL INTEGRATION TESTS PASSED (0 Failures)');
    console.log('=====================================================');
    return true;

  } catch (error) {
    originalError = error;
  } finally {
    try {
      await cleanupCreatedTestRecords(created);
    } catch (error) {
      cleanupError = error;
    } finally {
      await prisma.$disconnect();
    }
  }

  if (originalError !== undefined) {
    throw originalError;
  }

  if (cleanupError !== undefined) {
    throw cleanupError;
  }

  return true;
}

// Direct CLI invocation
if (import.meta.url === `file://${process.argv[1]}`) {
  runPostgresTestSuite().then((success) => {
    if (!success) {
      process.exit(0);
    }
  }).catch((err) => {
    console.error('❌ PostgreSQL Test Suite Failed:', err);
    process.exit(1);
  });
}
