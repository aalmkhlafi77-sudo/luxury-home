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

  console.log('=====================================================');
  console.log('💰 Running Server-Side Financials & Allocation Test Suite');
  console.log('=====================================================');

  try {
    const res = await makeRequest({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/financials/calculate-distribution',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      buildingRent: 120000,   // 10,000 / month
      guardSalary: 3000,      // 3,000 / month
      adminSalary: 10000,     // 10,000 / month
      electricityBill: 1500,  // 1,500 / month
      directMaintenance: 500, // 500 / month (direct for Unit 101)
      units: [
        { id: '101', areaSqm: 50, isOccupied: true },
        { id: '102', areaSqm: 50, isOccupied: true },
        { id: '103', areaSqm: 50, isOccupied: false },
        { id: '104', areaSqm: 50, isOccupied: false },
        { id: '105', areaSqm: 50, isOccupied: true },
        { id: '106', areaSqm: 50, isOccupied: true },
        { id: '107', areaSqm: 50, isOccupied: true },
        { id: '108', areaSqm: 50, isOccupied: true },
        { id: '109', areaSqm: 50, isOccupied: false },
        { id: '110', areaSqm: 50, isOccupied: true }
      ]
    });

    console.log(`Status Code: ${res.status}`);
    console.log('Financial Response Summary:', JSON.stringify(res.data.summary, null, 2));

    const summary = res.data.summary;
    if (summary && summary.discrepancyHalalas === 0) {
      console.log('✅ PASS: Company OPEX matches sum of all allocated unit shares with 0.00 SAR discrepancy!');
    } else {
      console.log('❌ FAIL: Discrepancy detected in company aggregation!');
    }

    console.log('\n=====================================================');
    console.log('🎉 Server Financial Test Completed!');
    console.log('=====================================================');

  } catch (err) {
    console.error('Error during Financial test:', err);
  } finally {
    server.close();
    process.exit(0);
  }
}

runFinancialTests();
