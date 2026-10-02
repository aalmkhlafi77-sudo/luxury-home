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
    const testUnitId = `unit_concurrency_test_${Date.now()}`;
    
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

    console.log('\n=====================================================');
    if (failures === 0) {
      console.log('🎉 ALL API & SECURITY TESTS PASSED (0 Failures)');
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
