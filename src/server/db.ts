import { PrismaClient, Role } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Single PrismaClient instance
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

// Database health check
export async function checkDatabaseHealth(): Promise<{
  connected: boolean;
  type: string;
  details?: string;
}> {
  if (!process.env.DATABASE_URL) {
    return {
      connected: false,
      type: 'postgresql',
      details: 'DATABASE_URL environment variable is not defined'
    };
  }

  try {
    // Perform live query to test connection
    await prisma.$queryRaw`SELECT 1 as health_check`;
    return {
      connected: true,
      type: 'postgresql',
      details: 'PostgreSQL connection verified active'
    };
  } catch (error: any) {
    return {
      connected: false,
      type: 'postgresql',
      details: error?.message || 'Failed to connect to PostgreSQL'
    };
  }
}

// Check if any Super Admin exists in the database
export async function hasSuperAdminInDb(): Promise<boolean> {
  try {
    const adminCount = await prisma.user.count({
      where: {
        role: Role.SUPER_ADMIN,
        isActive: true
      }
    });
    return adminCount > 0;
  } catch (err) {
    return false;
  }
}

// Fallback JSON DB file path for data import / migration preview
export const LEGACY_DB_FILE = path.resolve(__dirname, '../../server-db.json');

export function readLegacyDbFile(): any {
  if (fs.existsSync(LEGACY_DB_FILE)) {
    try {
      const data = fs.readFileSync(LEGACY_DB_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (e) {
      console.error('[DB] Error parsing legacy server-db.json:', e);
    }
  }
  return null;
}
