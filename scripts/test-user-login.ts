import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_DB_FILE = path.resolve(__dirname, '../server-db.json');

const credentialsToTest = [
  { username: 'admin', password: 'Admin@Luxury2026!', role: 'SUPER_ADMIN' },
  { username: 'manager', password: 'Manager@Luxury2026!', role: 'PROPERTY_MANAGER' },
  { username: 'accountant', password: 'Accountant@Luxury2026!', role: 'ACCOUNTANT' },
  { username: 'reception', password: 'Reception@Luxury2026!', role: 'RECEPTIONIST' },
  { username: 'housekeeping', password: 'Housekeeping@Luxury2026!', role: 'HOUSEKEEPING' },
  { username: 'maintenance', password: 'Maintenance@Luxury2026!', role: 'MAINTENANCE' },
  { username: 'tenant', password: 'Tenant@Luxury2026!', role: 'TENANT' },
];

async function testCredentials() {
  console.log('--- 🧪 Verifying Hashed User Logins ---');
  if (!fs.existsSync(SERVER_DB_FILE)) {
    throw new Error('server-db.json does not exist!');
  }

  const raw = fs.readFileSync(SERVER_DB_FILE, 'utf-8');
  const db = JSON.parse(raw);
  const users = db.users || [];

  let successCount = 0;

  for (const cred of credentialsToTest) {
    const user = users.find((u: any) => u.username === cred.username);
    if (!user) {
      console.error(`❌ User ${cred.username} NOT found in server-db.json`);
      continue;
    }

    const isValid = await bcrypt.compare(cred.password, user.passwordHash);
    if (isValid && user.role === cred.role) {
      console.log(`✅ [${cred.role}] Username: ${cred.username} | Password verified successfully!`);
      successCount++;
    } else {
      console.error(`❌ User ${cred.username} password verification failed!`);
    }
  }

  console.log(`\nVerified ${successCount}/${credentialsToTest.length} user accounts.`);
  if (successCount === credentialsToTest.length) {
    console.log('🎉 ALL USER ACCOUNTS & PASSWORDS ARE ACTIVE AND VERIFIED!');
  } else {
    process.exit(1);
  }
}

testCredentials().catch((e) => {
  console.error('Test error:', e);
  process.exit(1);
});
