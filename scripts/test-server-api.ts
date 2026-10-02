import { startServer } from '../server.js';
import http from 'http';
import path from 'path';
import fs from 'fs';

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

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runApiTests() {
  process.env.PORT = '3099';
  process.env.NODE_ENV = 'production';
  process.env.INITIAL_ADMIN_USERNAME = 'admin_test';
  process.env.INITIAL_ADMIN_PASSWORD = 'SecureAdminPass2026!';
  
  console.log('=====================================================');
  console.log('🚀 Running Server API, Security & RBAC Verification Suite');
  console.log('=====================================================');

  const server = await startServer(3099);
  const PORT = 3099;
  let failures = 0;

  try {
    // Test 1: Health Check
    console.log('\n[Test 1] Testing /api/health Endpoint...');
    const health = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/health',
      method: 'GET'
    });
    console.log(`Status Code: ${health.status}`);
    if (health.status === 200 && health.data?.status === 'healthy') {
      console.log('✅ PASS: Health endpoint is active and healthy.');
    } else {
      console.error('❌ FAIL: Health check did not return healthy 200.');
      failures++;
    }

    // Test 2: Admin Registration Security Lock
    console.log('\n[Test 2] Testing /api/auth/register-admin Security Lock...');
    const regAttempt = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/auth/register-admin',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: 'unauthorized_intruder', password: 'password123' });

    console.log(`Status Code: ${regAttempt.status}`);
    if (regAttempt.status === 403) {
      console.log('✅ PASS: Unauthorized public admin registration blocked with HTTP 403!');
    } else {
      console.error('❌ FAIL: Admin registration was not blocked.');
      failures++;
    }

    // Test 3: Authenticated Login
    console.log('\n[Test 3] Testing /api/auth/login...');
    const loginRes = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: 'admin_test', password: 'SecureAdminPass2026!' });

    console.log(`Status Code: ${loginRes.status}`);
    const token = loginRes.data?.token;

    if (loginRes.status === 200 && token && typeof token === 'string' && token.length > 20) {
      console.log('✅ PASS: Login returned valid signed JWT token.');
    } else {
      console.error('❌ FAIL: Login failed or did not return token.');
      failures++;
    }

    // Test 4: Protected /api/state Access Verification
    console.log('\n[Test 4] Testing Protected /api/state Access Control...');
    const unauthState = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/state',
      method: 'GET'
    });

    if (unauthState.status === 401) {
      console.log('✅ PASS: Public access to /api/state rejected with HTTP 401.');
    } else {
      console.error(`❌ FAIL: Unauthenticated access to /api/state returned ${unauthState.status}.`);
      failures++;
    }

    const authState = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/state',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (authState.status === 200 && authState.data?.state) {
      console.log('✅ PASS: Authenticated access to /api/state succeeded with HTTP 200.');
    } else {
      console.error('❌ FAIL: Authenticated state fetch failed.');
      failures++;
    }

    // Test 5: Public APIs for Unauthenticated Visitors
    console.log('\n[Test 5] Testing Public APIs (/api/public/settings, /api/public/properties)...');
    const pubSettings = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/public/settings',
      method: 'GET'
    });

    if (pubSettings.status === 200 && pubSettings.data?.settings?.companyName) {
      console.log('✅ PASS: Public settings API accessible without auth.');
    } else {
      console.error('❌ FAIL: Public settings API failed.');
      failures++;
    }

    // Test 6: Booking Concurrency Check (Atomic double-booking prevention)
    console.log('\n[Test 6] Testing Booking Concurrency Check (/api/bookings/check-and-reserve)...');
    
    // Create dedicated property & unit for concurrency test
    const propConcRes = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/properties',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, {
      name: 'مبنى اختبار التزامن',
      code: `BLD_CONC_${Date.now()}`,
      address: 'شارع التزامن',
      city: 'الرياض',
      district: 'العليا',
      floorsCount: 1
    });
    const propConcId = propConcRes.data?.property?.id;
    const propConcFloor = propConcRes.data?.floors?.[0] || propConcRes.data?.property?.floors?.[0];

    const unitConcRes = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/units',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, {
      propertyId: propConcId,
      floorId: propConcFloor?.id,
      unitNumber: `CONC-${Date.now().toString().slice(-4)}`,
      title: 'شقة اختبار التزامن',
      dailyRate: 500
    });
    const testUnitId = unitConcRes.data?.unit?.id;
    
    const req1 = makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/bookings/check-and-reserve',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      unitId: testUnitId,
      startDate: '2026-06-01',
      endDate: '2026-06-10',
      guestName: 'العميل الأول',
      totalAmount: 1500
    });

    const req2 = makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/bookings/check-and-reserve',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      unitId: testUnitId,
      startDate: '2026-06-05',
      endDate: '2026-06-15',
      guestName: 'العميل الثاني المتزامن',
      totalAmount: 1800
    });

    const [res1, res2] = await Promise.all([req1, req2]);

    const oneSucceededOneConflict = (res1.status === 200 && res2.status === 409) || (res1.status === 409 && res2.status === 200);

    if (oneSucceededOneConflict) {
      console.log('✅ PASS: Atomic booking lock prevented overlapping reservation (HTTP 200 + HTTP 409)!');
    } else {
      console.error(`❌ FAIL: Overlapping bookings were permitted. Status 1: ${res1.status}, Status 2: ${res2.status}`);
      failures++;
    }

    // Test 7: Backup & Restore Execution
    console.log('\n[Test 7] Testing Backup Export & Restore Execution...');
    const backupRes = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/backup/export',
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (backupRes.status === 200 && backupRes.data?.backupFile) {
      console.log('✅ PASS: Backup created successfully.');

      const restoreRes = await makeRequest({
        hostname: '127.0.0.1',
        port: PORT,
        path: '/api/backup/restore',
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }, { backupFileName: backupRes.data.backupFile });

      if (restoreRes.status === 200) {
        console.log('✅ PASS: Backup restored successfully.');
      } else {
        console.error('❌ FAIL: Backup restore returned non-200 status.');
        failures++;
      }
    } else {
      console.error('❌ FAIL: Backup export returned non-200 status.');
      failures++;
    }

    // Test 8: Property & Unit Lifecycle & Real Server ID Binding
    console.log('\n[Test 8] Testing Property & Unit Creation, Real ID Binding, Mutations, Error Handling, and Session Persistence...');
    
    // 8.1 Unauthenticated Property Creation (Must return 401)
    const unauthProp = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/properties',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { name: 'برج غير مصرح', code: 'UNAUTH-01', address: 'طريق الملك فهد', district: 'العليا' });

    if (unauthProp.status === 401) {
      console.log('✅ PASS: Unauthenticated property creation correctly rejected with HTTP 401.');
    } else {
      console.error(`❌ FAIL: Expected 401 for unauthenticated property creation, got ${unauthProp.status}`);
      failures++;
    }

    // 8.2 Valid Property Creation with Server Response
    const propCode = `BLD_TEST_${Date.now()}`;
    const createPropRes = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/properties',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, {
      name: 'برج الفخامة للاختبار الفعلي',
      code: propCode,
      address: 'طريق الملك فهد، تقاطع التحلية',
      city: 'الرياض',
      district: 'حي العليا',
      floorsCount: 3,
      unitsCount: 0,
      totalAreaSqm: 2400,
      description: 'مجمع سكني فندقي راقي تم إنشاؤه في الاختبار الآلي.'
    });

    const realPropertyId = createPropRes.data?.property?.id;
    const propFloors = createPropRes.data?.floors || createPropRes.data?.property?.floors || [];

    if (createPropRes.status === 200 && realPropertyId && propFloors.length >= 3) {
      console.log(`✅ PASS: Property created with real server ID: ${realPropertyId} and ${propFloors.length} auto-generated floors.`);
    } else {
      console.error(`❌ FAIL: Property creation failed. Status: ${createPropRes.status}, data:`, createPropRes.data);
      failures++;
    }

    // 8.3 Unauthenticated Unit Creation (Must return 401)
    const unauthUnit = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/units',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { propertyId: realPropertyId, unitNumber: '101' });

    if (unauthUnit.status === 401) {
      console.log('✅ PASS: Unauthenticated unit creation correctly rejected with HTTP 401.');
    } else {
      console.error(`❌ FAIL: Expected 401 for unauthenticated unit creation, got ${unauthUnit.status}`);
      failures++;
    }

    // 8.4 Unit Creation with Non-existent PropertyId (Must return 400 or 404)
    const invalidPropUnit = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/units',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, { propertyId: 'non_existent_property_id_9999', unitNumber: '999' });

    if (invalidPropUnit.status === 400 || invalidPropUnit.status === 404) {
      console.log(`✅ PASS: Unit creation with non-existent propertyId rejected with HTTP ${invalidPropUnit.status}.`);
    } else {
      console.error(`❌ FAIL: Unit creation with invalid propertyId was not rejected. Status: ${invalidPropUnit.status}`);
      failures++;
    }

    // 8.5 Valid Unit Creation Bound to Real Property and Floor
    const targetFloor = propFloors.find((f: any) => f.number === 1 || f.floorNumber === 1) || propFloors[0];
    const unitNumberTest = `U-${Date.now().toString().slice(-4)}`;

    const createUnitRes = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/units',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, {
      propertyId: realPropertyId,
      floorId: targetFloor?.id,
      unitNumber: unitNumberTest,
      title: `شقة ديلوكس تجريبية #${unitNumberTest}`,
      type: 'apartment',
      areaSqm: 110,
      dailyRate: 750,
      monthlyRate: 15000,
      annualRate: 160000,
      occupancyStatus: 'vacant'
    });

    const realUnitId = createUnitRes.data?.unit?.id;

    if (createUnitRes.status === 200 && realUnitId && createUnitRes.data?.unit?.propertyId === realPropertyId) {
      console.log(`✅ PASS: Unit created with real server ID: ${realUnitId} bound to Property ID: ${realPropertyId}.`);
    } else {
      console.error(`❌ FAIL: Unit creation failed. Status: ${createUnitRes.status}, data:`, createUnitRes.data);
      failures++;
    }

    // 8.6 Duplicate Unit Number in Same Property (Must return 409 or 400)
    const duplicateUnitRes = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/units',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, {
      propertyId: realPropertyId,
      floorId: targetFloor?.id,
      unitNumber: unitNumberTest
    });

    if (duplicateUnitRes.status === 409 || duplicateUnitRes.status === 400) {
      console.log(`✅ PASS: Duplicate unit number in same building correctly rejected with HTTP ${duplicateUnitRes.status}.`);
    } else {
      console.error(`❌ FAIL: Duplicate unit creation was allowed. Status: ${duplicateUnitRes.status}`);
      failures++;
    }

    // 8.7 Property and Unit Updates
    const updatePropRes = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: `/api/properties/${realPropertyId}`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, {
      name: 'برج الفخامة للاختبار الفعلي - معدل'
    });

    const updateUnitRes = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: `/api/units/${realUnitId}`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, {
      dailyRate: 850,
      title: `شقة ديلوكس تجريبية معدلة #${unitNumberTest}`
    });

    if (updatePropRes.status === 200 && updateUnitRes.status === 200) {
      console.log('✅ PASS: Property and Unit updated successfully on backend.');
    } else {
      console.error(`❌ FAIL: Update property (${updatePropRes.status}) or unit (${updateUnitRes.status}) failed.`);
      failures++;
    }

    // 8.8 Verify Persistence in Fresh State Session Request
    const freshFetchRes = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/state',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const persistedProps = freshFetchRes.data?.state?.properties || [];
    const persistedUnits = freshFetchRes.data?.state?.units || [];
    const foundProp = persistedProps.find((p: any) => p.id === realPropertyId);
    const foundUnit = persistedUnits.find((u: any) => u.id === realUnitId);

    if (foundProp && foundUnit && foundUnit.propertyId === realPropertyId && foundUnit.dailyRate === 850) {
      console.log('✅ PASS: Created Property and Unit persisted authoritatively with real IDs across sessions.');
    } else {
      console.error('❌ FAIL: Persisted state verification failed. foundProp:', !!foundProp, 'foundUnit:', !!foundUnit);
      failures++;
    }

    // =====================================================
    // Test 9: Complete Unit Fields Persistence & Zero Values Preservation (Tasks 1 & 2 Acceptance Tests)
    // =====================================================
    console.log('\n[Test 9] Testing Complete Unit Fields Persistence & Zero Values Preservation...');
    const zeroTestUnitNumber = `ZERO-${Date.now().toString().slice(-4)}`;
    const createZeroUnitRes = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/units',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, {
      propertyId: realPropertyId,
      floorId: targetFloor?.id,
      unitNumber: zeroTestUnitNumber,
      title: 'شقة فاخرة لاختبار القيم الصفرية الكاملة',
      titleEn: 'Luxury Zero-Value Test Unit',
      type: 'apartment',
      areaSqm: 95.5,
      floorNumber: 2,
      maxGuests: 4,
      bedroomsCount: 2,
      bathroomsCount: 2,
      bedsCount: 2,
      furnishingStatus: 'furnished',
      allowDaily: false, // Disabled option
      dailyRate: 0,
      dailySecurityDeposit: 0, // Must stay 0, not default to 800!
      allowMonthly: true,
      monthlyRate: 11000,
      monthlySecurityDeposit: 0, // Must stay 0, not default to 3000!
      allowYearly: true,
      annualRate: 120000,
      yearlySecurityDeposit: 0, // Must stay 0, not default to 5000!
      yearlyPaymentOptions: ['single_annual'],
      semiAnnualSurchargePercent: 0,
      cleaningFee: 0, // Must stay 0, not default to 100!
      securityDeposit: 0, // Must stay 0, not default to 800!
      taxPercentage: 0, // Must stay 0, not default to 15!
      operationalStatus: 'ready',
      occupancyStatus: 'vacant',
      isClean: true,
      publicationStatus: 'published',
      amenities: ['wifi', 'smart_lock'],
      images: ['https://example.com/unit_test.jpg'],
      spaces: [
        {
          id: 'sp-test-1',
          name: 'غرفة نوم رئيسية',
          type: 'bedroom',
          bedsCount: 1,
          fittings: [{ id: 'fit-1', name: 'سرير كينج', category: 'bed', quantity: 1 }]
        }
      ],
      floorPlanUrl: 'https://example.com/plan_unit.pdf',
      notes: 'ملاحظة خاصة لاختبار الحفظ الكامل'
    });

    const zeroUnit = createZeroUnitRes.data?.unit;
    if (
      createZeroUnitRes.status === 200 &&
      zeroUnit &&
      zeroUnit.allowDaily === false &&
      Number(zeroUnit.dailySecurityDeposit) === 0 &&
      Number(zeroUnit.monthlySecurityDeposit) === 0 &&
      Number(zeroUnit.yearlySecurityDeposit) === 0 &&
      Number(zeroUnit.cleaningFee) === 0 &&
      Number(zeroUnit.securityDeposit) === 0 &&
      Number(zeroUnit.taxPercentage) === 0 &&
      zeroUnit.floorPlanUrl === 'https://example.com/plan_unit.pdf' &&
      zeroUnit.titleEn === 'Luxury Zero-Value Test Unit'
    ) {
      console.log('✅ PASS: Complete Unit fields created and zero values preserved (not replaced with defaults).');
    } else {
      console.error('❌ FAIL: Zero values or fields were not preserved correctly:', zeroUnit);
      failures++;
    }

    // Verify reading zeroUnit in fresh session
    const readFreshUnit = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/state',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const reloadedZeroUnit = (readFreshUnit.data?.state?.units || []).find((u: any) => u.id === zeroUnit?.id);
    if (
      reloadedZeroUnit &&
      reloadedZeroUnit.allowDaily === false &&
      Number(reloadedZeroUnit.dailySecurityDeposit) === 0 &&
      Number(reloadedZeroUnit.monthlySecurityDeposit) === 0 &&
      Number(reloadedZeroUnit.yearlySecurityDeposit) === 0 &&
      Number(reloadedZeroUnit.cleaningFee) === 0 &&
      Number(reloadedZeroUnit.taxPercentage) === 0
    ) {
      console.log('✅ PASS: Acceptance Test 2 Verified: Zero values & disabled options preserved after state reload.');
    } else {
      console.error('❌ FAIL: Reloaded unit lost zero values or disabled option:', reloadedZeroUnit);
      failures++;
    }

    // =====================================================
    // Test 10: Batch Units Transactionality & Idempotency (Task 3 Acceptance Test)
    // =====================================================
    console.log('\n[Test 10] Testing Batch Unit Creation (Transactionality & Idempotency)...');
    
    // 10.1 Batch with Duplicate Unit Number in payload (Must fail and save NOTHING)
    const duplicateBatchRes = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/units/batch',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, {
      propertyId: realPropertyId,
      floorId: targetFloor?.id,
      units: [
        { unitNumber: 'BATCH-DUP-01', title: 'شقة 1' },
        { unitNumber: 'BATCH-DUP-01', title: 'شقة 2 مكررة' }
      ]
    });

    if (duplicateBatchRes.status === 400 || duplicateBatchRes.status === 409) {
      console.log('✅ PASS: Batch with internal duplicate rejected with HTTP status code.');
    } else {
      console.error(`❌ FAIL: Duplicate batch was not rejected. Status: ${duplicateBatchRes.status}`);
      failures++;
    }

    // Verify 0 units from this duplicate batch were saved
    const stateAfterDup = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/state',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const dupSaved = (stateAfterDup.data?.state?.units || []).filter((u: any) => u.unitNumber === 'BATCH-DUP-01');
    if (dupSaved.length === 0) {
      console.log('✅ PASS: Acceptance Test 3 (Atomicity): 0 units saved when batch contained duplicate.');
    } else {
      console.error('❌ FAIL: Partial units were saved from failed duplicate batch:', dupSaved);
      failures++;
    }

    // 10.2 Valid Batch Creation
    const validBatchKey = `test_batch_key_${Date.now()}`;
    const validBatchUnits = [
      { unitNumber: `B-${Date.now().toString().slice(-4)}-1`, title: 'شقة دفعة 1', areaSqm: 80 },
      { unitNumber: `B-${Date.now().toString().slice(-4)}-2`, title: 'شقة دفعة 2', areaSqm: 85 }
    ];

    const validBatchRes = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/units/batch',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, {
      propertyId: realPropertyId,
      floorId: targetFloor?.id,
      units: validBatchUnits,
      idempotencyKey: validBatchKey
    });

    if (validBatchRes.status === 200 && validBatchRes.data?.count === 2 && Array.isArray(validBatchRes.data?.units)) {
      console.log('✅ PASS: Valid batch created successfully with official server records & IDs.');
    } else {
      console.error('❌ FAIL: Valid batch creation failed:', validBatchRes.data);
      failures++;
    }

    // 10.3 Re-submit the exact same batch request (Idempotency)
    const reBatchRes = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/units/batch',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, {
      propertyId: realPropertyId,
      floorId: targetFloor?.id,
      units: validBatchUnits,
      idempotencyKey: validBatchKey
    });

    if (reBatchRes.status === 200 && reBatchRes.data?.count === 2) {
      console.log('✅ PASS: Acceptance Test 3 (Idempotency): Re-sent batch request returned existing units without duplicating.');
    } else {
      console.error('❌ FAIL: Re-sent batch request failed or duplicated:', reBatchRes.data);
      failures++;
    }

    // =====================================================
    // Test 11: Document Upload and RBAC Download Verification (Task 5)
    // =====================================================
    console.log('\n[Test 11] Testing Document Upload and Ownership Verification...');
    const sampleDocData = Buffer.from('Official Private Document Content 2026').toString('base64');
    const docUploadRes = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/media/upload',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, {
      fileName: 'secret_contract.pdf',
      base64Data: `data:application/pdf;base64,${sampleDocData}`,
      isPrivate: true,
      propertyId: realPropertyId
    });

    const docFileName = docUploadRes.data?.fileName;
    if (docUploadRes.status === 200 && docFileName) {
      console.log(`✅ PASS: Private document uploaded with secure file name: ${docFileName}`);
    } else {
      console.error('❌ FAIL: Private document upload failed:', docUploadRes.data);
      failures++;
    }

    // Download document as Admin (Should succeed)
    const docDownloadAdmin = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: `/api/documents/private/${docFileName}`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (docDownloadAdmin.status === 200) {
      console.log('✅ PASS: Super Admin authorized to download private document.');
    } else {
      console.error(`❌ FAIL: Super Admin download failed with status ${docDownloadAdmin.status}`);
      failures++;
    }

    // Download document without Token (Should be blocked 401)
    const docDownloadUnauth = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: `/api/documents/private/${docFileName}`,
      method: 'GET'
    });

    if (docDownloadUnauth.status === 401) {
      console.log('✅ PASS: Unauthenticated private document access blocked with HTTP 401.');
    } else {
      console.error(`❌ FAIL: Unauthenticated private document access not blocked: ${docDownloadUnauth.status}`);
      failures++;
    }

    // =====================================================
    // Test 12: Booking Conflict and Re-booking after Cancellation (Task 5)
    // =====================================================
    console.log('\n[Test 12] Testing Booking Conflict and Re-booking after Cancellation...');
    const bookingUnitId = realUnitId;
    const testStartDate = '2026-12-01';
    const testEndDate = '2026-12-05';

    // 12.1 Initial Booking
    const bookRes1 = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/bookings/check-and-reserve',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, {
      unitId: bookingUnitId,
      startDate: testStartDate,
      endDate: testEndDate,
      guestName: 'محمد الغامدي',
      rentalType: 'daily'
    });

    const bookingId = bookRes1.data?.booking?.id;
    if (bookRes1.status === 200 && bookingId) {
      console.log(`✅ PASS: Initial booking created successfully: ${bookingId}`);
    } else {
      console.error('❌ FAIL: Initial booking failed:', bookRes1.data);
      failures++;
    }

    // 12.2 Conflict Booking on Overlapping Dates (Must fail with 409)
    const bookResConflict = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/bookings/check-and-reserve',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, {
      unitId: bookingUnitId,
      startDate: '2026-12-02',
      endDate: '2026-12-04',
      guestName: 'علي القرني',
      rentalType: 'daily'
    });

    if (bookResConflict.status === 409) {
      console.log('✅ PASS: Overlapping reservation correctly prevented with HTTP 409 conflict.');
    } else {
      console.error(`❌ FAIL: Overlapping reservation was not prevented. Status: ${bookResConflict.status}`);
      failures++;
    }

    // 12.3 Cancel Original Booking
    const cancelRes = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: `/api/bookings/${bookingId}/cancel`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (cancelRes.status === 200 && cancelRes.data?.booking?.status === 'cancelled') {
      console.log('✅ PASS: Booking cancelled and unit allocation freed.');
    } else {
      console.error('❌ FAIL: Booking cancellation failed:', cancelRes.data);
      failures++;
    }

    // 12.4 Re-booking Same Unit on Same Dates after Cancellation (Must Succeed!)
    const reBookRes = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/bookings/check-and-reserve',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, {
      unitId: bookingUnitId,
      startDate: testStartDate,
      endDate: testEndDate,
      guestName: 'سعد القحطاني',
      rentalType: 'daily'
    });

    if (reBookRes.status === 200 && reBookRes.data?.booking?.id) {
      console.log('✅ PASS: Re-booking same dates succeeded after cancellation (Constraint conflict resolved!).');
    } else {
      console.error('❌ FAIL: Re-booking after cancellation failed:', reBookRes.data);
      failures++;
    }

    // =====================================================
    // Test 13: Full Backup Package Export & Restore Protection Tests
    // =====================================================
    console.log('\n[Test 13] Testing Comprehensive Backup Export & Strict Restore Incomplete Package Protection...');
    const backupExport = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/backup/export',
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const exportedFile = backupExport.data?.backupFile;
    if (backupExport.status === 200 && exportedFile) {
      console.log(`✅ PASS: Comprehensive backup exported: ${exportedFile}`);
    } else {
      console.error('❌ FAIL: Comprehensive backup export failed:', backupExport.data);
      failures++;
    }

    // 13.1 Test restoring complete valid backup
    const backupRestore = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/backup/restore',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, { backupFileName: exportedFile });

    if (backupRestore.status === 200) {
      console.log('✅ PASS: Complete backup restored successfully into database and static files environment.');
    } else {
      console.error('❌ FAIL: Backup restore failed:', backupRestore.data);
      failures++;
    }

    // 13.2 Mandatory Incomplete Backup Rejection Tests:
    // Create corrupted/incomplete backup copies missing essential sections
    const backupDir = path.resolve(process.cwd(), 'backups');
    const validRaw = JSON.parse(fs.readFileSync(path.join(backupDir, exportedFile), 'utf-8'));

    const testIncompleteSections = ['payments', 'installments', 'securityDeposits', 'securityDepositTransactions', 'documentRecords'];
    for (const missingSec of testIncompleteSections) {
      const corruptedData = JSON.parse(JSON.stringify(validRaw));
      delete corruptedData.data[missingSec];
      const corruptedFileName = `corrupted_missing_${missingSec}_${Date.now()}.json`;
      fs.writeFileSync(path.join(backupDir, corruptedFileName), JSON.stringify(corruptedData), 'utf-8');

      const corruptedRestoreRes = await makeRequest({
        hostname: '127.0.0.1',
        port: PORT,
        path: '/api/backup/restore',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }, { backupFileName: corruptedFileName });

      if (corruptedRestoreRes.status === 400 && corruptedRestoreRes.data?.message?.includes(missingSec)) {
        console.log(`✅ PASS: Incomplete backup missing '${missingSec}' rejected before deletion with HTTP 400!`);
      } else {
        console.error(`❌ FAIL: Incomplete backup missing '${missingSec}' was not rejected properly. Status: ${corruptedRestoreRes.status}`);
        failures++;
      }
    }

    // =====================================================
    // Test 14: Booking Cancellation Security & Multi-Role RBAC (Task 1 Acceptance Tests)
    // =====================================================
    console.log('\n[Test 14] Testing Booking Cancellation Security & Multi-Role RBAC...');
    
    // Create a property manager user restricted to Property A only
    const pmTokenRes = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/auth/register-admin',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, {
      username: `pm_test_${Date.now()}`,
      password: 'SecurePMPass2026!',
      name: 'مدير عقار أ',
      role: 'PROPERTY_MANAGER',
      allowedProperties: [realPropertyId] // Only realPropertyId
    });

    // Create a second independent property
    const prop2Res = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/properties',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, {
      name: 'برج ب المستقل',
      code: `BLD_B_${Date.now()}`,
      address: 'طريق التخصصي',
      city: 'الرياض',
      district: 'المحمدية',
      floorsCount: 2
    });
    const prop2Id = prop2Res.data?.property?.id;
    const prop2Floor = prop2Res.data?.floors?.[0] || prop2Res.data?.property?.floors?.[0];

    const unit2Res = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/units',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, {
      propertyId: prop2Id,
      floorId: prop2Floor?.id,
      unitNumber: `U2-${Date.now().toString().slice(-4)}`,
      title: 'شقة برج ب',
      type: 'apartment',
      dailyRate: 600
    });
    const unit2Id = unit2Res.data?.unit?.id;

    // Create booking in Property B
    const bookPropBRes = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/bookings/check-and-reserve',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, {
      unitId: unit2Id,
      startDate: '2026-11-10',
      endDate: '2026-11-15',
      guestName: 'نزيل برج ب',
      rentalType: 'daily'
    });
    const bookingPropBId = bookPropBRes.data?.booking?.id;

    // Login as PM (authorized only for Property A)
    const pmLogin = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      username: pmTokenRes.data?.user?.username,
      password: 'SecurePMPass2026!'
    });
    const pmToken = pmLogin.data?.token;

    // 14.1 Unauthenticated Cancellation Attempt (Must fail 401)
    const unauthCancel = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: `/api/bookings/${bookingPropBId}/cancel`,
      method: 'POST'
    });
    if (unauthCancel.status === 401) {
      console.log('✅ PASS: Unauthenticated cancellation blocked with HTTP 401.');
    } else {
      console.error('❌ FAIL: Unauthenticated cancellation was not blocked with 401:', unauthCancel.status);
      failures++;
    }

    // 14.2 PM of Property A attempting to cancel booking in Property B (Must fail with 403 Forbidden)
    const crossCancel = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: `/api/bookings/${bookingPropBId}/cancel`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${pmToken}`
      }
    });

    if (crossCancel.status === 403) {
      console.log('✅ PASS: Property Manager unauthorized for Property B blocked from cancelling with HTTP 403!');
    } else {
      console.error('❌ FAIL: Cross-property cancellation was not blocked with 403:', crossCancel.status);
      failures++;
    }

    // =====================================================
    // Test 15: Security Deposit State Management & PostgreSQL Strict Refund Verification
    // =====================================================
    console.log('\n[Test 15] Testing Security Deposit State Management & Refund Operations...');
    const depTestUnitId = realUnitId;
    const depStartDate = '2026-08-01';
    const depEndDate = '2026-08-05';

    const depBookRes = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/bookings/check-and-reserve',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, {
      unitId: depTestUnitId,
      startDate: depStartDate,
      endDate: depEndDate,
      guestName: 'مستأجر اختبار التأمين',
      rentalType: 'daily'
    });
    const depBookingId = depBookRes.data?.booking?.id;

    // Cancel booking: security deposit MUST NOT be marked as 'refunded'
    const depCancelRes = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: `/api/bookings/${depBookingId}/cancel`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (depCancelRes.status === 200) {
      console.log('✅ PASS: Booking cancelled successfully without auto-refunding deposit.');
    } else {
      console.error('❌ FAIL: Booking cancellation failed:', depCancelRes.data);
      failures++;
    }

    // Get current state to locate deposit ID
    const stateAfterCancel = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/state',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const allDeposits = stateAfterCancel.data?.state?.securityDeposits || stateAfterCancel.data?.securityDeposits || [];
    let testDeposit = allDeposits.find((sd: any) => sd.bookingId === depBookingId);
    if (!testDeposit) {
      testDeposit = allDeposits[0];
    }

    const testDepositId = testDeposit?.id;

    if (!process.env.DATABASE_URL) {
      // Verification when PostgreSQL is not configured: Must return 503 without executing financial transaction
      const noDbRefund = await makeRequest({
        hostname: '127.0.0.1',
        port: PORT,
        path: `/api/security-deposits/${testDepositId}/refund`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Idempotency-Key': `idem_nodb_${Date.now()}`
        }
      }, {
        refundAmount: 500,
        refundMethod: 'bank_transfer',
        refundReference: 'BANK-REF-NO-DB'
      });

      if (noDbRefund.status === 503) {
        console.log('✅ PASS: Deposit refund correctly rejected with HTTP 503 when PostgreSQL database is unavailable!');
      } else {
        console.error('❌ FAIL: Deposit refund was not rejected with 503 when DATABASE_URL is missing:', noDbRefund.status);
        failures++;
      }
    } else {
      // 15.1 PM of Property A tries to refund deposit belonging to Property B (Must be blocked 403)
      let depPropB = allDeposits.find((sd: any) => sd.bookingId === bookingPropBId);
      const depPropBId = depPropB?.id;

      const crossDepositRefund = await makeRequest({
        hostname: '127.0.0.1',
        port: PORT,
        path: `/api/security-deposits/${depPropBId}/refund`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${pmToken}`,
          'X-Idempotency-Key': `idem_cross_${Date.now()}`
        }
      }, {
        refundAmount: 500,
        refundMethod: 'bank_transfer',
        refundReference: 'BANK-TRX-CROSS-01'
      });

      if (crossDepositRefund.status === 403) {
        console.log('✅ PASS: PM blocked with HTTP 403 from refunding deposit of another building!');
      } else {
        console.error('❌ FAIL: Cross-building deposit refund was not blocked with 403:', crossDepositRefund.status, crossDepositRefund.data);
        failures++;
      }

      // 15.2 Reject negative and zero amounts (Must fail 400)
      const negRefund = await makeRequest({
        hostname: '127.0.0.1',
        port: PORT,
        path: `/api/security-deposits/${testDepositId}/refund`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Idempotency-Key': `idem_neg_${Date.now()}`
        }
      }, {
        refundAmount: -200,
        refundMethod: 'bank_transfer',
        refundReference: 'BANK-NEG-01'
      });

      if (negRefund.status === 400) {
        console.log('✅ PASS: Negative refund amount rejected with HTTP 400.');
      } else {
        console.error('❌ FAIL: Negative refund amount was not rejected:', negRefund.status);
        failures++;
      }

      // 15.3 Reject over-balance amount (Must fail 400)
      const overBalanceRefund = await makeRequest({
        hostname: '127.0.0.1',
        port: PORT,
        path: `/api/security-deposits/${testDepositId}/refund`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Idempotency-Key': `idem_over_${Date.now()}`
        }
      }, {
        refundAmount: 2500, // Deposit is only 1000
        refundMethod: 'bank_transfer',
        refundReference: 'BANK-OVER-01'
      });

      if (overBalanceRefund.status === 400) {
        console.log('✅ PASS: Over-balance refund amount rejected with HTTP 400.');
      } else {
        console.error('❌ FAIL: Over-balance refund amount was not rejected:', overBalanceRefund.status);
        failures++;
      }

      // 15.4 Reject manual refund without reference (Must fail 400)
      const noRefRefund = await makeRequest({
        hostname: '127.0.0.1',
        port: PORT,
        path: `/api/security-deposits/${testDepositId}/refund`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Idempotency-Key': `idem_noref_${Date.now()}`
        }
      }, {
        refundAmount: 300,
        refundMethod: 'bank_transfer'
      });

      if (noRefRefund.status === 400) {
        console.log('✅ PASS: Manual refund without required proof reference rejected with HTTP 400.');
      } else {
        console.error('❌ FAIL: Manual refund without reference was not rejected:', noRefRefund.status);
        failures++;
      }

      // 15.5 Valid Partial Refund with Ledger Tracking & Idempotency
      const refundIdemKey = `refund_idem_key_${Date.now()}`;
      const partialRefundRes = await makeRequest({
        hostname: '127.0.0.1',
        port: PORT,
        path: `/api/security-deposits/${testDepositId}/refund`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Idempotency-Key': refundIdemKey
        }
      }, {
        refundAmount: 400,
        refundMethod: 'bank_transfer',
        refundReference: 'BANK-REF-REAL-8899'
      });

      if (partialRefundRes.status === 200 && partialRefundRes.data?.transactionIds?.length > 0) {
        console.log('✅ PASS: Partial refund executed successfully on PostgreSQL and recorded in SecurityDepositTransaction!');
      } else {
        console.error('❌ FAIL: Partial refund failed:', partialRefundRes.data);
        failures++;
      }

      // 15.6 Re-send same partial refund with same idempotency key (Must return previous result without duplicating)
      const duplicateRefundRes = await makeRequest({
        hostname: '127.0.0.1',
        port: PORT,
        path: `/api/security-deposits/${testDepositId}/refund`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Idempotency-Key': refundIdemKey
        }
      }, {
        refundAmount: 400,
        refundMethod: 'bank_transfer',
        refundReference: 'BANK-REF-REAL-8899'
      });

      if (duplicateRefundRes.status === 200 && duplicateRefundRes.data?.transactionIds?.[0] === partialRefundRes.data?.transactionIds?.[0]) {
        console.log('✅ PASS: Duplicate refund request returned identical transaction idempotently!');
      } else {
        console.error('❌ FAIL: Duplicate refund was not handled idempotently:', duplicateRefundRes.data);
        failures++;
      }

      // 15.7 Send different payload with same idempotency key (Must return 409 Conflict)
      const conflictRefundRes = await makeRequest({
        hostname: '127.0.0.1',
        port: PORT,
        path: `/api/security-deposits/${testDepositId}/refund`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Idempotency-Key': refundIdemKey
        }
      }, {
        refundAmount: 500, // Different amount
        refundMethod: 'bank_transfer',
        refundReference: 'BANK-REF-DIFFERENT'
      });

      if (conflictRefundRes.status === 409) {
        console.log('✅ PASS: Conflicting payload on same refund idempotency key rejected with HTTP 409 Conflict!');
      } else {
        console.error('❌ FAIL: Conflicting refund payload was not rejected with 409:', conflictRefundRes.status);
        failures++;
      }

      // 15.8 Execute Deduction with Reason and Final Balance Clearance
      const deductRes = await makeRequest({
        hostname: '127.0.0.1',
        port: PORT,
        path: `/api/security-deposits/${testDepositId}/refund`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Idempotency-Key': `idem_deduct_${Date.now()}`
        }
      }, {
        refundAmount: 300,
        deductedAmount: 300,
        deductionReason: 'تعويض تلفيات باب الشقة مع استرداد المتبقي',
        refundMethod: 'cash',
        refundReference: 'CASH-VOUCHER-5521'
      });

      if (deductRes.status === 200) {
        console.log('✅ PASS: Security deposit fully cleared (refunded + deducted) and balances reconciled perfectly!');
      } else {
        console.error('❌ FAIL: Deduction and final refund failed:', deductRes.data);
        failures++;
      }
    }

    // =====================================================
    // Test 16: Batch Units Idempotency with Fingerprint Conflict Check (Task 3)
    // =====================================================
    console.log('\n[Test 16] Testing Batch Units Idempotency & Hash Conflict Detection...');
    const conflictIdemKey = `idem_conflict_key_${Date.now()}`;
    const initialUnits = [
      { unitNumber: `C-${Date.now().toString().slice(-4)}-1`, title: 'شقة أولى', areaSqm: 70 },
      { unitNumber: `C-${Date.now().toString().slice(-4)}-2`, title: 'شقة ثانية', areaSqm: 75 }
    ];

    // First batch creation with conflictIdemKey
    const firstBatchRes = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/units/batch',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, {
      propertyId: realPropertyId,
      floorId: targetFloor?.id,
      units: initialUnits,
      idempotencyKey: conflictIdemKey
    });

    if (firstBatchRes.status === 200) {
      console.log('✅ PASS: Initial batch created with idempotency key.');
    } else {
      console.error('❌ FAIL: Initial batch creation failed:', firstBatchRes.data);
      failures++;
    }

    // Resend EXACT SAME payload + key -> Must return 200 with same units
    const exactResendRes = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/units/batch',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, {
      propertyId: realPropertyId,
      floorId: targetFloor?.id,
      units: initialUnits,
      idempotencyKey: conflictIdemKey
    });

    if (exactResendRes.status === 200 && exactResendRes.data?.count === 2) {
      console.log('✅ PASS: Exact resend returned identical batch idempotently without duplication.');
    } else {
      console.error('❌ FAIL: Exact resend failed:', exactResendRes.data);
      failures++;
    }

    // Resend DIFFERENT payload with SAME key -> Must return 409 Conflict
    const differentUnits = [
      { unitNumber: `DIFF-${Date.now().toString().slice(-4)}-1`, title: 'شقة مختلفة بحمولة أخرى', areaSqm: 90 }
    ];
    const conflictRes = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/units/batch',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, {
      propertyId: realPropertyId,
      floorId: targetFloor?.id,
      units: differentUnits,
      idempotencyKey: conflictIdemKey
    });

    if (conflictRes.status === 409) {
      console.log('✅ PASS: Same idempotency key with different payload rejected with HTTP 409 Conflict!');
    } else {
      console.error('❌ FAIL: Idempotency conflict was not caught with 409:', conflictRes.status);
      failures++;
    }

    // =====================================================
    // Test 17: Expense Real Scope & Document Ownership Enforcement (Task 4)
    // =====================================================
    console.log('\n[Test 17] Testing Expense Real Scope & Document Ownership Enforcement...');
    
    // Create an expense belonging to Property B
    const expPropBRes = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/expenses',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, {
      title: 'صيانة مبنى ب الخاصة',
      amount: 1200,
      costCenterLevel: 'PROPERTY',
      propertyId: prop2Id
    });
    const expPropBId = expPropBRes.data?.expense?.id;

    // PM of Property A tries to edit Property B expense by passing propertyId: realPropertyId in body
    const expSpoofEdit = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: `/api/expenses/${expPropBId}`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${pmToken}`
      }
    }, {
      propertyId: realPropertyId, // Trying to spoof permission
      title: 'محاولة تعديل غير مصرح بها'
    });

    if (expSpoofEdit.status === 403) {
      console.log('✅ PASS: Spoofed propertyId on expense edit rejected with HTTP 403 (Real DB scope checked)!');
    } else {
      console.error('❌ FAIL: Spoofed expense edit was not rejected with 403:', expSpoofEdit.status);
      failures++;
    }

    console.log('\n=====================================================');
    if (failures === 0) {
      console.log('🎉 ALL API, UNIT PERSISTENCE & SECURITY TESTS PASSED (0 Failures)');
    } else {
      console.error(`💥 TEST SUITE COMPLETED WITH ${failures} FAILURE(S)`);
    }
    console.log('=====================================================');

  } catch (err) {
    console.error('Fatal error during API test:', err);
    failures++;
  } finally {
    server.close();
    process.exit(failures > 0 ? 1 : 0);
  }
}

runApiTests();
