/**
 * Comprehensive Isolated PostgreSQL Verification Suite
 * Exported for execution via scripts/run-isolated-postgres.ts
 */

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execSync } from 'node:child_process';
import { prisma } from '../src/server/db.js';
import { RefundError, refundDeposit, applyDepositToRent } from '../src/server/depositRefundService.js';

export async function runPostgresTestSuite() {
  console.log('=====================================================');
  console.log('🐘 Isolated PostgreSQL Financial & Integration Test Suite');
  console.log('=====================================================');

  const testRunId = randomUUID().slice(0, 8);

  console.log('\n[1/6] Applying Prisma migrations to test database...');
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
  });
  console.log('✅ Migrations applied cleanly.');

  console.log('\n[2/6] Setting up isolated user, property, unit, lease, and installments...');
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

  const floor = await prisma.floor.create({
    data: {
      propertyId: prop.id,
      number: 1,
      name: 'الطابق الأول'
    }
  });

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

  console.log(`✅ Real Records created: Lease=${lease.id}, Deposit=${deposit.id}, Installment=${installment1.id}`);

  console.log('\n[3/6] Executing real applyDepositToRent with independent approvalReference...');
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

  console.log('\n[4/6] Verifying internal settlement classification and database records...');
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

  console.log('\n[5/6] Testing concurrency race condition (Row-Level Lock & Over-allocation prevention)...');
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

  console.log('\n[6/6] Verifying final ledger balances in PostgreSQL...');
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

  // Cleanup test data
  await prisma.securityDepositTransaction.deleteMany({ where: { depositId: deposit.id } });
  await prisma.paymentRecord.deleteMany({ where: { leaseId: lease.id } });
  await prisma.securityDepositRecord.deleteMany({ where: { leaseId: lease.id } });
  await prisma.leaseInstallment.deleteMany({ where: { leaseId: lease.id } });
  await prisma.lease.delete({ where: { id: lease.id } });
  await prisma.unit.delete({ where: { id: unit.id } });
  await prisma.floor.delete({ where: { id: floor.id } });
  await prisma.property.delete({ where: { id: prop.id } });
  await prisma.user.delete({ where: { id: testAdmin.id } });

  console.log('\n=====================================================');
  console.log('🎉 ALL ISOLATED POSTGRESQL INTEGRATION TESTS PASSED (0 Failures)');
  console.log('=====================================================');
}
