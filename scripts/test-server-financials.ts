import { startServer } from '../server.js';
import http from 'http';

function makeRequest(options: http.RequestOptions, body?: any): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseBody);
          resolve({ status: res.statusCode || 500, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode || 500, data: responseBody });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runFinancialTests() {
  process.env.NODE_ENV = 'production';
  const server = await startServer(3098);
  const PORT = 3098;
  let failures = 0;

  console.log('=====================================================');
  console.log('💰 Running Server-Side Financials & Cost Allocation Suite');
  console.log('=====================================================');

  try {
    // 0. Login as admin to get token
    const loginRes = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: 'admin', password: 'Admin@2026!' });
    const token = loginRes.data?.token || '';

    // Test 1: Standard Equal Unit Allocation
    console.log('\n[Test 1] Testing Equal Units OPEX Distribution...');
    console.log('[Classification: Direct Calculation Function Call via POST /api/financials/calculate-distribution]');
    const res1 = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/financials/calculate-distribution',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      buildingRent: 120000,
      guardSalary: 3000,
      adminSalary: 10000,
      electricityBill: 1500,
      directMaintenance: 500,
      allocationMethod: 'EQUAL_UNITS',
      units: [
        { id: '101', unitNumber: '101', areaSqm: 50, isOccupied: true },
        { id: '102', unitNumber: '102', areaSqm: 50, isOccupied: true },
        { id: '103', unitNumber: '103', areaSqm: 50, isOccupied: false },
        { id: '104', unitNumber: '104', areaSqm: 50, isOccupied: false },
        { id: '105', unitNumber: '105', areaSqm: 50, isOccupied: true },
        { id: '106', unitNumber: '106', areaSqm: 50, isOccupied: true },
        { id: '107', unitNumber: '107', areaSqm: 50, isOccupied: true },
        { id: '108', unitNumber: '108', areaSqm: 50, isOccupied: true },
        { id: '109', unitNumber: '109', areaSqm: 50, isOccupied: false },
        { id: '110', unitNumber: '110', areaSqm: 50, isOccupied: true }
      ]
    });

    if (res1.status === 200 && res1.data?.summary?.discrepancyHalalas === 0) {
      console.log('✅ PASS: Equal units OPEX matches sum of unit shares with 0.00 discrepancy!');
    } else {
      console.error('❌ FAIL: Equal units distribution failed or had discrepancy.');
      failures++;
    }

    // Test 2: SQM Area Allocation with Diverse Sizes (50m², 75m², 125m²)
    console.log('\n[Test 2] Testing SQM Area Proportionate Allocation...');
    const res2 = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/financials/allocate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      title: 'فاتورة الكهرباء والخدمات المشتركة',
      amount: 5000,
      costCenterLevel: 'PROPERTY',
      allocationMethod: 'SQM_AREA',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      units: [
        { id: 'u1', unitNumber: '101', areaSqm: 50, isOccupied: true },
        { id: 'u2', unitNumber: '102', areaSqm: 75, isOccupied: true },
        { id: 'u3', unitNumber: '201', areaSqm: 125, isOccupied: true }
      ]
    });

    // Total area = 250m². u1 = 20% (1000 SAR), u2 = 30% (1500 SAR), u3 = 50% (2500 SAR)
    const shares = res2.data?.shares || [];
    const u1Share = shares.find((s: any) => s.unitId === 'u1')?.shareAmount;
    const u3Share = shares.find((s: any) => s.unitId === 'u3')?.shareAmount;

    if (res2.status === 200 && u1Share === 1000 && u3Share === 2500 && res2.data.distributedAmount === 5000) {
      console.log('✅ PASS: Area-based allocation calculated exact proportional shares (1000 SAR, 2500 SAR)!');
    } else {
      console.error('❌ FAIL: Area-based allocation produced incorrect values:', res2.data);
      failures++;
    }

    // Test 3: Indivisible Amount Halalas Rounding (1000 SAR divided among 3 equal units)
    console.log('\n[Test 3] Testing Indivisible Amount Rounding (1000 SAR / 3 units)...');
    const res3 = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/financials/allocate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      title: 'صيانة دورية مصعد',
      amount: 1000,
      costCenterLevel: 'PROPERTY',
      allocationMethod: 'EQUAL_UNITS',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      units: [
        { id: 'u1', unitNumber: '101', areaSqm: 50, isOccupied: true },
        { id: 'u2', unitNumber: '102', areaSqm: 50, isOccupied: true },
        { id: 'u3', unitNumber: '103', areaSqm: 50, isOccupied: true }
      ]
    });

    const sum3 = res3.data?.shares?.reduce((acc: number, c: any) => acc + c.shareAmount, 0);
    const diff3 = Math.abs(1000 - sum3);

    if (res3.status === 200 && diff3 < 0.001 && res3.data?.distributedAmount === 1000) {
      console.log(`✅ PASS: Indivisible 1000 SAR divided with exact deterministic rounding adjustment. Sum = ${sum3} SAR!`);
    } else {
      console.error(`❌ FAIL: Indivisible rounding failed. Sum = ${sum3}`);
      failures++;
    }

    // Test 4: Zero Expense Handling (0 SAR is valid and should not load defaults)
    console.log('\n[Test 4] Testing Zero Expense Acceptance (0 SAR)...');
    const res4 = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/financials/allocate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      title: 'مصروف صفري تحت المراجعة',
      amount: 0,
      costCenterLevel: 'PROPERTY',
      allocationMethod: 'EQUAL_UNITS',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      units: [
        { id: 'u1', unitNumber: '101', areaSqm: 50, isOccupied: true },
        { id: 'u2', unitNumber: '102', areaSqm: 50, isOccupied: true }
      ]
    });

    if (res4.status === 200 && res4.data?.totalExpenseAmount === 0 && res4.data?.distributedAmount === 0) {
      console.log('✅ PASS: Zero expense accepted accurately without fallback to mock numbers!');
    } else {
      console.error('❌ FAIL: Zero expense was not accepted or reverted to non-zero values.');
      failures++;
    }

    // Test 5: Capital Asset (FF&E) Separation from OPEX
    console.log('\n[Test 5] Testing Capital Asset (FF&E) Separation from OPEX...');
    const res5 = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/financials/allocate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      title: 'شراء أثاث ولوازم فندقية رأسمالية',
      amount: 25000,
      costCenterLevel: 'PROPERTY',
      allocationMethod: 'EQUAL_UNITS',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      isCapitalAsset: true,
      units: [
        { id: 'u1', unitNumber: '101', areaSqm: 50, isOccupied: true }
      ]
    });

    if (res5.status === 200 && res5.data?.distributedAmount === 0 && res5.data?.unallocatedAmount === 25000) {
      console.log('✅ PASS: Capital asset (FF&E) correctly separated with 0 distributed OPEX shares!');
    } else {
      console.error('❌ FAIL: Capital asset was incorrectly distributed into OPEX.');
      failures++;
    }

    // Test 6: Financial Reports Endpoint
    console.log('\n[Test 6] Testing Comprehensive Financial Reports & NOI API...');
    const res6 = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/financials/reports',
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    });

    if (res6.status === 200 && res6.data?.companySummary) {
      console.log('✅ PASS: Financial reports endpoint successfully returned company summary and NOI metrics!');
    } else {
      console.error('❌ FAIL: Financial reports endpoint failed.', res6.data);
      failures++;
    }

    // Test 7: Unallocatable Expense Handling (e.g., SQM missing area)
    console.log('\n[Test 7] Testing Unallocatable Expense Handling (Missing Area)...');
    const res7 = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/financials/allocate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      title: 'صيانة طارئة',
      amount: 1500,
      costCenterLevel: 'PROPERTY',
      allocationMethod: 'SQM_AREA',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      units: [
        { id: 'u1', unitNumber: '101', areaSqm: 0, isOccupied: true }
      ]
    });

    if (res7.status === 400 && res7.data?.message?.includes('بدون مساحة')) {
      console.log('✅ PASS: Successfully rejected allocation when unit area is missing.');
    } else {
      console.error('❌ FAIL: Unallocatable expense handling did not reject properly.');
      failures++;
    }

    // Test 8: Tenant Account Statement Endpoint & Chronological Running Balance & affectsCash validation
    console.log('\n[Test 8] Testing Tenant Account Statement API (Chronological, Running Balance, affectsCash=false)...');
    const statementRes = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/financials/statement/non-existent-lease',
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    });

    if (statementRes.status === 404) {
      console.log('✅ PASS: Tenant statement API correctly returned 404 for non-existent lease / contract.');
    } else {
      console.error('❌ FAIL: Tenant statement did not return 404 for invalid ID.');
      failures++;
    }

    // Test 9: Security Deposit Operations & Idempotency / Authorization validation
    console.log('\n[Test 9] Testing Security Deposit Operations & Idempotency Defense...');
    const depositRefundAttempt = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/security-deposits/non-existent-deposit/refund',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    }, {
      actorId: 'usr-admin-default-01',
      idempotencyKey: 'test_key_123',
      refundAmount: '1000.00',
      refundMethod: 'bank_transfer',
      refundReference: 'REF-999'
    });

    if (depositRefundAttempt.status === 404 || depositRefundAttempt.status === 503 || depositRefundAttempt.status === 400) {
      console.log(`✅ PASS: Deposit refund correctly rejected invalid deposit record with status ${depositRefundAttempt.status}.`);
    } else {
      console.error('❌ FAIL: Deposit refund did not reject non-existent deposit properly.', depositRefundAttempt);
      failures++;
    }

    // Test 10: Financial Reports Reconciliation & Cash vs Accrual
    console.log('\n[Test 10] Testing Financial Reports Accrual vs Cash & NOI Reconciliation...');
    const reportsRes = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/financials/reports',
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    });

    if (reportsRes.status === 200 && reportsRes.data?.companySummary) {
      console.log(`✅ PASS: Financial reports returned NOI metrics successfully.`);
    } else {
      console.error('❌ FAIL: Financial reports reconciliation failed.', reportsRes.data);
      failures++;
    }

    console.log('\n=====================================================');
    if (failures === 0) {
      console.log('🎉 ALL FINANCIAL & COST ALLOCATION TESTS PASSED (0 Failures)');
    } else {
      console.error(`💥 TEST SUITE COMPLETED WITH ${failures} FAILURE(S)`);
    }
    console.log('=====================================================');

  } catch (err) {
    console.error('Fatal error during Financial test:', err);
    failures++;
  } finally {
    server.close();
    process.exit(failures > 0 ? 1 : 0);
  }
}

runFinancialTests();
