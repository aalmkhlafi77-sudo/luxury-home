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
  console.log('=====================================================');
  console.log('🚀 Running Server API & Security Verification Suite');
  console.log('=====================================================');

  const server = await startServer(3099);
  const PORT = 3099;

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
    console.log('Response:', JSON.stringify(health.data, null, 2));

    // Test 2: Admin Registration Security Lock
    console.log('\n[Test 2] Testing /api/auth/register-admin Protection...');
    const regAttempt = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/auth/register-admin',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: 'unauthorized_hacker', password: 'password123' });

    console.log(`Status Code: ${regAttempt.status}`);
    console.log('Response:', JSON.stringify(regAttempt.data, null, 2));
    if (regAttempt.status === 403) {
      console.log('✅ PASS: Unauthorized admin creation blocked successfully!');
    } else {
      console.log('❌ FAIL: Admin registration was not blocked.');
    }

    // Test 3: Admin Auth Login
    console.log('\n[Test 3] Testing /api/auth/login...');
    const loginRes = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: 'admin', password: 'admin123' });

    console.log(`Status Code: ${loginRes.status}`);
    console.log('Login Response:', JSON.stringify(loginRes.data, null, 2));

    const token = loginRes.data?.token;

    // Test 4: Booking Concurrency Check (2 Simultaneous Overlapping Requests)
    console.log('\n[Test 4] Testing Booking Concurrency Check (/api/bookings/check-and-reserve)...');
    const testUnitId = `unit_test_${Date.now()}`;
    
    const req1 = makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/bookings/check-and-reserve',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      unitId: testUnitId,
      startDate: '2026-05-01',
      endDate: '2026-05-10',
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
      startDate: '2026-05-05',
      endDate: '2026-05-15',
      guestName: 'العميل الثاني المتزامن',
      totalAmount: 1800
    });

    const [res1, res2] = await Promise.all([req1, req2]);

    console.log(`Request 1 Status: ${res1.status}, Response:`, res1.data.message);
    console.log(`Request 2 Status: ${res2.status}, Response:`, res2.data.message);

    const oneSucceededOneConflict = (res1.status === 200 && res2.status === 409) || (res1.status === 409 && res2.status === 200);

    if (oneSucceededOneConflict) {
      console.log('✅ PASS: Atomic booking lock prevented overlapping reservation!');
    } else {
      console.log('❌ FAIL: Overlapping bookings were permitted.');
    }

    // Test 5: Backup & Restore Execution
    console.log('\n[Test 5] Testing Backup Export & Restore Execution...');
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

    console.log(`Backup Status Code: ${backupRes.status}`);
    console.log('Backup Response:', JSON.stringify(backupRes.data, null, 2));

    if (backupRes.data?.backupFile) {
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

      console.log(`Restore Status Code: ${restoreRes.status}`);
      console.log('Restore Response:', JSON.stringify(restoreRes.data, null, 2));

      if (restoreRes.status === 200) {
        console.log('✅ PASS: Backup created and restored successfully!');
      }
    }

    console.log('\n=====================================================');
    console.log('🎉 Server API Verification Completed!');
    console.log('=====================================================');

  } catch (err) {
    console.error('Error during API test:', err);
  } finally {
    server.close();
    process.exit(0);
  }
}

runApiTests();
