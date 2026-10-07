import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVER_DB_FILE = path.resolve(__dirname, '../server-db.json');

const newUsersConfig = [
  {
    id: 'usr-admin-2026',
    username: 'admin',
    password: 'Admin@Luxury2026!',
    name: 'مدير النظام الرئيسي (Super Admin)',
    email: 'admin@luxuryhome.sa',
    phone: '0501110001',
    role: Role.SUPER_ADMIN,
    allowedProperties: ['all'],
    isActive: true,
    mustChangePassword: false,
  },
  {
    id: 'usr-manager-2026',
    username: 'manager',
    password: 'Manager@Luxury2026!',
    name: 'مدير العقارات والتشغيل',
    email: 'manager@luxuryhome.sa',
    phone: '0501110002',
    role: Role.PROPERTY_MANAGER,
    allowedProperties: ['all'],
    isActive: true,
    mustChangePassword: false,
  },
  {
    id: 'usr-accountant-2026',
    username: 'accountant',
    password: 'Accountant@Luxury2026!',
    name: 'المحاسب المالي الرئيسي',
    email: 'accountant@luxuryhome.sa',
    phone: '0501110003',
    role: Role.ACCOUNTANT,
    allowedProperties: ['all'],
    isActive: true,
    mustChangePassword: false,
  },
  {
    id: 'usr-reception-2026',
    username: 'reception',
    password: 'Reception@Luxury2026!',
    name: 'موظف الاستقبال والضيافة',
    email: 'reception@luxuryhome.sa',
    phone: '0501110004',
    role: Role.RECEPTIONIST,
    allowedProperties: ['all'],
    isActive: true,
    mustChangePassword: false,
  },
  {
    id: 'usr-housekeeping-2026',
    username: 'housekeeping',
    password: 'Housekeeping@Luxury2026!',
    name: 'مشرف النظافة والتجهيز',
    email: 'housekeeping@luxuryhome.sa',
    phone: '0501110005',
    role: Role.HOUSEKEEPING,
    allowedProperties: ['all'],
    isActive: true,
    mustChangePassword: false,
  },
  {
    id: 'usr-maintenance-2026',
    username: 'maintenance',
    password: 'Maintenance@Luxury2026!',
    name: 'فني الصيانة العامة',
    email: 'maintenance@luxuryhome.sa',
    phone: '0501110006',
    role: Role.MAINTENANCE,
    allowedProperties: ['all'],
    isActive: true,
    mustChangePassword: false,
  },
  {
    id: 'usr-tenant-2026',
    username: 'tenant',
    password: 'Tenant@Luxury2026!',
    name: 'النزيل / المستأجر',
    email: 'tenant@luxuryhome.sa',
    phone: '0501110007',
    role: Role.TENANT,
    allowedProperties: ['all'],
    isActive: true,
    mustChangePassword: false,
  },
];

async function main() {
  console.log('--- 🔄 Re-setting User Credentials & Accounts ---');

  // Prepare users with hashed passwords
  const preparedUsers = await Promise.all(
    newUsersConfig.map(async (u) => {
      const passwordHash = await bcrypt.hash(u.password, 10);
      return {
        id: u.id,
        username: u.username,
        email: u.email,
        passwordHash,
        name: u.name,
        phone: u.phone,
        role: u.role,
        allowedProperties: u.allowedProperties,
        isActive: u.isActive,
        mustChangePassword: u.mustChangePassword,
        tokenVersion: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    })
  );

  // 1. Reset PostgreSQL database if DATABASE_URL is available
  if (process.env.DATABASE_URL) {
    const prisma = new PrismaClient();
    try {
      console.log('[PostgreSQL] Connecting to database...');
      await prisma.$connect();
      console.log('[PostgreSQL] Connected successfully. Deleting existing users...');
      
      // Clear existing users
      await prisma.user.deleteMany({});
      
      // Insert new users
      for (const u of preparedUsers) {
        await prisma.user.create({
          data: {
            id: u.id,
            username: u.username,
            email: u.email,
            passwordHash: u.passwordHash,
            name: u.name,
            phone: u.phone,
            role: u.role as Role,
            allowedProperties: u.allowedProperties,
            isActive: u.isActive,
            mustChangePassword: u.mustChangePassword,
            tokenVersion: u.tokenVersion,
          },
        });
      }
      console.log(`[PostgreSQL] Successfully inserted ${preparedUsers.length} users into PostgreSQL!`);
    } catch (err: any) {
      console.warn('[PostgreSQL] Database reset warning:', err.message);
    } finally {
      await prisma.$disconnect();
    }
  } else {
    console.log('[PostgreSQL] DATABASE_URL not defined. Skipping PostgreSQL reset.');
  }

  // 2. Reset or create server-db.json
  let serverDbData: any = {};
  if (fs.existsSync(SERVER_DB_FILE)) {
    try {
      const raw = fs.readFileSync(SERVER_DB_FILE, 'utf-8');
      serverDbData = JSON.parse(raw);
    } catch (e) {
      console.warn('Could not parse existing server-db.json, creating new.');
    }
  }

  serverDbData.users = preparedUsers;
  fs.writeFileSync(SERVER_DB_FILE, JSON.stringify(serverDbData, null, 2), 'utf-8');
  console.log(`[server-db.json] Successfully saved ${preparedUsers.length} users to ${SERVER_DB_FILE}`);

  console.log('\n==================================================');
  console.log('✅ User Reset Completed Successfully!');
  console.log('==================================================\n');
  console.log('New User Credentials:');
  newUsersConfig.forEach((u, i) => {
    console.log(`${i + 1}. [${u.role}]`);
    console.log(`   - Username: ${u.username}`);
    console.log(`   - Password: ${u.password}`);
    console.log(`   - Name: ${u.name}`);
    console.log(`   - Email: ${u.email}\n`);
  });
}

main().catch((err) => {
  console.error('Fatal error during user reset:', err);
  process.exit(1);
});
