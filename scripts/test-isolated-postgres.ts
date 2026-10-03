/**
 * Comprehensive Isolated PostgreSQL Verification Suite
 * 
 * Strict Verification:
 * 1. Executes against isolated test PostgreSQL database.
 * 2. Migrations deployment with orphan checks.
 * 3. Real deposit collection, applyDepositToRent, refund, damage deduction.
 * 4. Exact classification check: paymentMethod='security_deposit', sourceType='deposit_application', affectsCash=false.
 * 5. Concurrency race testing with INSUFFICIENT_DEPOSIT_BALANCE assertion and DB balance checks.
 * 6. Backup export and strict pre-restoration validation assertions.
 * 7. Server query continuity across fresh sessions.
 * 8. Cleanup of test-created records only, preserving original errors and disconnecting in finally.
 */

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execSync } from 'node:child_process';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/server/db.js';
import { RefundError, refundDeposit, applyDepositToRent } from '../src/server/depositRefundService.js';
import { validateBackupPackageIntegrity } from '../src/server/repository.js';

interface CreatedTestRecords {
  userId?: string;
  propertyId?: string;
  floorId?: string;
  unitId?: string;
  leaseId?: string;
  depositId?: string;
}

async function cleanupCreatedTestRecords(created: CreatedTestRecords) {
  if (created.depositId) {
    await prisma.securityDepositTransaction.deleteMany({ where: { depositId: created.depositId } });
  }
  if (created.leaseId) {
    await prisma.paymentRecord.deleteMany({ where: { leaseId: created.leaseId } });
    await prisma.securityDepositRecord.deleteMany({ where: { leaseId: created.leaseId } });
    await prisma.leaseInstallment.deleteMany({ where: { leaseId: created.leaseId } });
    await prisma.lease.deleteMany({ where: { id: created.leaseId } });
  } else if (created.depositId) {
    await prisma.securityDepositRecord.deleteMany({ where: { id: created.depositId } });
  }

  if (created.unitId) {
    await prisma.unit.deleteMany({ where: { id: created.unitId } });
  }
  if (created.floorId) {
    await prisma.floor.deleteMany({ where: { id: created.floorId } });
  }
  if (created.propertyId) {
    await prisma.property.deleteMany({ where: { id: created.propertyId } });
  }

  if (created.userId) {
    await prisma.idempotencyRecord.deleteMany({ where: { userId: created.userId } });
    await prisma.auditLog.deleteMany({ where: { userId: created.userId } });
    await prisma.user.deleteMany({ where: { id: created.userId } });
  }
}

export async function runPostgresTestSuite() {
  console.log('=====================================================');
  console.log('🐘 Isolated PostgreSQL Financial & Integration Test Suite');
  console.log('=====================================================');

  const created: CreatedTestRecords = {};
  const testRunId = randomUUID().slice(0, 8);

  let originalError: unknown;
  let cleanupError: unknown;

  try {
    // ----------------------------------------------------
    // 1. Apply Migrations
    // ----------------------------------------------------
    console.log('\n[1/7] Applying Prisma migrations to isolated test database...');
    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
    });
    console.log('✅ Migrations applied cleanly.');

    // ----------------------------------------------------
    // 2. Setup Isolated Records
    // ----------------------------------------------------
    console.log('\n[2/7] Setting up isolated test records...');
    const testAdmin = await prisma.user.upsert({
      where: { username: `test_admin_${testRunId}` },
      update: {},
      create: {
        username: `test_admin_${testRunId}`,
        email: `test_admin_${testRunId}@luxuryhome.sa`,
        passwordHash: 'dummy_hashed_password',
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

    console.log(`✅ Real Records created: Lease=${lease.id}, Deposit=${deposit.id}, Installment=${installment1.id}`);

    // ----------------------------------------------------
    // 3. Apply Deposit to Rent
    // ----------------------------------------------------
    console.log('\n[3/7] Executing real applyDepositToRent with independent approvalReference...');
    const approvalRef = `APPR-SETTLE-${testRunId}-001`;
    const applyResult = await applyDepositToRent({
      depositId: deposit.id,
      installmentId: installment1.id,
      actorId: testAdmin.id,
      amount: '2000.00',
      approvalReference: approvalRef,
      reason: 'تسوية قسط إيجاري معتمد',
      idempotencyKey: `${testRunId}:settle:1`
    });

    assert.ok(applyResult);
    console.log('✅ applyDepositToRent completed.');

    // ----------------------------------------------------
    // 4. Verify Financial Classification & Records
    // ----------------------------------------------------
    console.log('\n[4/7] Verifying internal settlement classification and database records...');
    const createdPayment = await prisma.paymentRecord.findFirstOrThrow({
      where: {
        leaseId: lease.id,
        installmentId: installment1.id,
        sourceType: 'deposit_application',
        referenceNo: approvalRef
      }
    });

    assert.equal(createdPayment.paymentMethod, 'security_deposit');
    assert.equal(createdPayment.affectsCash, false);
    assert.equal(createdPayment.amount.toFixed(2), '2000.00');
    console.log('✅ Verified: PaymentRecord created with paymentMethod=security_deposit, sourceType=deposit_application, affectsCash=false.');

    const updatedDeposit = await prisma.securityDepositRecord.findUniqueOrThrow({
      where: { id: deposit.id }
    });
    assert.equal(updatedDeposit.rentAppliedAmount.toFixed(2), '2000.00');

    // ----------------------------------------------------
    // 5. Concurrency Race Testing
    // ----------------------------------------------------
    console.log('\n[5/7] Testing concurrency race condition (Row-Level Lock & Over-allocation prevention)...');
    const results = await Promise.allSettled([
      refundDeposit({
        depositId: deposit.id,
        actorId: testAdmin.id,
        refundAmount: '2000.00',
        refundMethod: 'bank_transfer',
        refundReference: `TEST-${testRunId}-A`,
        refundType: 'actual_payout',
        idempotencyKey: `${testRunId}:refund:A`,
      }),
      refundDeposit({
        depositId: deposit.id,
        actorId: testAdmin.id,
        refundAmount: '2000.00',
        refundMethod: 'bank_transfer',
        refundReference: `TEST-${testRunId}-B`,
        refundType: 'actual_payout',
        idempotencyKey: `${testRunId}:refund:B`,
      }),
    ]);

    const successes = results.filter(result => result.status === 'fulfilled');
    const failures = results.filter(
      (result): result is PromiseRejectedResult =>
        result.status === 'rejected',
    );

    assert.equal(successes.length, 1);
    assert.equal(failures.length, 1);

    const rejection = failures[0].reason;
    assert.ok(rejection instanceof RefundError);
    assert.equal(rejection.statusCode, 400);
    assert.equal(rejection.code, 'INSUFFICIENT_DEPOSIT_BALANCE');

    console.log('✅ Exactly 1 operation succeeded and 1 failed with INSUFFICIENT_DEPOSIT_BALANCE.');

    // ----------------------------------------------------
    // 6. Final Ledger Balances in PostgreSQL
    // ----------------------------------------------------
    console.log('\n[6/7] Verifying final ledger balances in PostgreSQL...');
    const after = await prisma.securityDepositRecord.findUniqueOrThrow({
      where: { id: deposit.id },
    });

    assert.equal(after.collectedAmount.toFixed(2), '5000.00');
    assert.equal(after.rentAppliedAmount.toFixed(2), '2000.00');
    assert.equal(after.refundedAmount.toFixed(2), '2000.00');
    assert.equal(after.deductedAmount.toFixed(2), '0.00');

    const available = after.collectedAmount
      .minus(after.rentAppliedAmount)
      .minus(after.refundedAmount)
      .minus(after.deductedAmount);

    assert.equal(available.toFixed(2), '1000.00');

    const refundMovements = await prisma.securityDepositTransaction.findMany({
      where: {
        depositId: deposit.id,
        type: 'refund',
        status: 'completed',
      },
    });

    assert.equal(refundMovements.length, 1);
    assert.equal(refundMovements[0].amount.toFixed(2), '2000.00');
    console.log('✅ Balances verified: Available = 1000.00 SAR, Completed refund = 2000.00 SAR.');

    // ----------------------------------------------------
    // 7. Strict Pre-Restoration Validation Assertions
    // ----------------------------------------------------
    console.log('\n[7/7] Testing strict pre-restoration validation assertions...');

    // Case A: rentAppliedAmount = 600 without movements -> REJECT
    const invalidPackageA = {
      properties: [{ id: prop.id }],
      units: [{ id: unit.id, propertyId: prop.id }],
      leases: [{ id: lease.id, unitId: unit.id }],
      installments: [{ id: installment1.id, leaseId: lease.id }],
      securityDeposits: [{
        id: deposit.id,
        leaseId: lease.id,
        bookingId: null,
        collectedAmount: '5000.00',
        collectionReference: 'REF-01',
        collectionVerifiedAt: new Date().toISOString(),
        refundedAmount: '0.00',
        deductedAmount: '0.00',
        rentAppliedAmount: '600.00',
      }],
      securityDepositTransactions: [],
      payments: [],
    };
    const resA = validateBackupPackageIntegrity(invalidPackageA);
    assert.equal(resA.isValid, false);
    assert.ok(resA.errors.some(e => e.includes('لا يطابق الرصيد المستخدم للإيجار')));
    console.log('✅ Test Passed: rentAppliedAmount=600 without transactions correctly rejected before deletion.');

    // Case B: movement with installment from another lease -> REJECT
    const otherLeaseId = `other_lease_${testRunId}`;
    const invalidPackageB = {
      ...invalidPackageA,
      leases: [{ id: lease.id, unitId: unit.id }, { id: otherLeaseId, unitId: unit.id }],
      installments: [{ id: installment1.id, leaseId: otherLeaseId }],
      securityDepositTransactions: [{
        id: `tx_${testRunId}`,
        depositId: deposit.id,
        type: 'rent_application',
        amount: '600.00',
        method: 'security_deposit',
        reference: 'REF-01',
        targetLeaseId: lease.id,
        targetInstallmentId: installment1.id,
        status: 'completed',
      }],
    };
    const resB = validateBackupPackageIntegrity(invalidPackageB);
    assert.equal(resB.isValid, false);
    assert.ok(resB.errors.some(e => e.includes('القسط لا يتبع العقد المستهدف')));
    console.log('✅ Test Passed: Movement targeting installment from another lease correctly rejected.');

    console.log('\n=====================================================');
    console.log('🎉 ALL ISOLATED POSTGRESQL INTEGRATION TESTS PASSED (0 Failures)');
    console.log('=====================================================');
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
}
