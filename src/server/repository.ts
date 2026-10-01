import { PrismaClient, Role, RentalType, BookingStatus, LeaseStatus, InstallmentStatus, CostCenterLevel, ExpenseCategoryType, TemporalDistributionType, CostAllocationMethod } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from './db.js';

// Safe serialization helper for Decimals in JSON API responses
export function serializeDecimals<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Decimal) return Number(obj.toString()) as any;
  if (obj instanceof Date) return obj.toISOString() as any;
  if (Array.isArray(obj)) return obj.map(serializeDecimals) as any;
  if (typeof obj === 'object') {
    const result: any = {};
    for (const key of Object.keys(obj)) {
      result[key] = serializeDecimals((obj as any)[key]);
    }
    return result;
  }
  return obj;
}

// User representation whitelist
export function sanitizeUserOutput(user: any) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    phone: user.phone || null,
    role: user.role,
    allowedProperties: user.allowedProperties || ['all'],
    isActive: Boolean(user.isActive),
    createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt
  };
}

// --- Company Settings Repository ---
export async function getCompanySettingsFromDb() {
  if (!process.env.DATABASE_URL) return null;
  try {
    let settings = await prisma.companySettings.findUnique({
      where: { id: 'default' }
    });
    if (!settings) {
      settings = await prisma.companySettings.create({
        data: {
          id: 'default',
          companyName: 'Luxury home منزل الفخامة',
          companyNameEn: 'Luxury Home',
          tagline: 'تجربة سكنية فاخرة تدمج بين خصوصية المنزل وخدمات الضيافة الراقية',
          phone: '+966 11 000 0000',
          whatsapp: '+966 50 000 0000',
          email: 'vip@luxuryhome.sa',
          crNumber: '1010000000',
          taxNumber: '300000000000003',
          nationalAddress: 'الرياض - المملكة العربية السعودية',
          checkInTime: '15:00',
          checkOutTime: '12:00'
        }
      });
    }
    return serializeDecimals(settings);
  } catch (e) {
    return null;
  }
}

export async function updateCompanySettingsInDb(data: any) {
  if (!process.env.DATABASE_URL) return null;
  return await prisma.companySettings.upsert({
    where: { id: 'default' },
    update: {
      companyName: data.companyName,
      companyNameEn: data.companyNameEn,
      tagline: data.tagline,
      logoUrl: data.logoUrl,
      iconUrl: data.iconUrl,
      phone: data.phone,
      whatsapp: data.whatsapp,
      email: data.email,
      crNumber: data.crNumber,
      taxNumber: data.taxNumber,
      nationalAddress: data.nationalAddress,
      checkInTime: data.checkInTime,
      checkOutTime: data.checkOutTime,
      navigation: data.navigation,
      themeConfig: data.themeConfig
    },
    create: {
      id: 'default',
      ...data
    }
  });
}

// --- Properties & Units Repository ---
export async function getPropertiesFromDb(allowedPropertyIds?: string[]) {
  if (!process.env.DATABASE_URL) return [];
  const isUniversal = !allowedPropertyIds || allowedPropertyIds.includes('all');
  const properties = await prisma.property.findMany({
    where: isUniversal ? {} : { id: { in: allowedPropertyIds } },
    include: {
      floors: true,
      units: true,
      parkingSpots: true
    },
    orderBy: { createdAt: 'asc' }
  });
  return serializeDecimals(properties);
}

export async function getUnitsFromDb(allowedPropertyIds?: string[]) {
  if (!process.env.DATABASE_URL) return [];
  const isUniversal = !allowedPropertyIds || allowedPropertyIds.includes('all');
  const units = await prisma.unit.findMany({
    where: isUniversal ? {} : { propertyId: { in: allowedPropertyIds } },
    include: {
      property: true,
      floor: true
    },
    orderBy: { unitNumber: 'asc' }
  });
  return serializeDecimals(units);
}

// --- Bookings & Leases Repository ---
export async function getBookingsFromDb(allowedPropertyIds?: string[]) {
  if (!process.env.DATABASE_URL) return [];
  const isUniversal = !allowedPropertyIds || allowedPropertyIds.includes('all');
  const bookings = await prisma.booking.findMany({
    where: isUniversal ? {} : { unit: { propertyId: { in: allowedPropertyIds } } },
    include: {
      unit: { include: { property: true } },
      payments: true
    },
    orderBy: { createdAt: 'desc' }
  });
  return serializeDecimals(bookings);
}

export async function getLeasesFromDb(allowedPropertyIds?: string[]) {
  if (!process.env.DATABASE_URL) return [];
  const isUniversal = !allowedPropertyIds || allowedPropertyIds.includes('all');
  const leases = await prisma.lease.findMany({
    where: isUniversal ? {} : { unit: { propertyId: { in: allowedPropertyIds } } },
    include: {
      unit: { include: { property: true } },
      installments: { orderBy: { number: 'asc' } },
      securityDeposits: true,
      payments: true
    },
    orderBy: { createdAt: 'desc' }
  });
  return serializeDecimals(leases);
}

// --- Expenses Repository ---
export async function getExpensesFromDb(allowedPropertyIds?: string[]) {
  if (!process.env.DATABASE_URL) return [];
  const isUniversal = !allowedPropertyIds || allowedPropertyIds.includes('all');
  const expenses = await prisma.operationalExpense.findMany({
    where: isUniversal ? {} : {
      OR: [
        { propertyId: null },
        { propertyId: { in: allowedPropertyIds } }
      ]
    },
    include: {
      property: true,
      unit: true,
      allocations: { include: { unit: true } },
      payments: true
    },
    orderBy: { expenseDate: 'desc' }
  });
  return serializeDecimals(expenses);
}

// --- Audit Logs Repository ---
export async function recordAuditLogInDb(data: {
  userId?: string;
  userName: string;
  action: string;
  module: string;
  details: string;
  ipAddress?: string;
}) {
  if (!process.env.DATABASE_URL) return null;
  try {
    return await prisma.auditLog.create({
      data: {
        userId: data.userId || null,
        userName: data.userName,
        action: data.action,
        module: data.module,
        details: data.details,
        ipAddress: data.ipAddress || null
      }
    });
  } catch (err) {
    return null;
  }
}

export async function getAuditLogsFromDb(limit: number = 100) {
  if (!process.env.DATABASE_URL) return [];
  try {
    const logs = await prisma.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { user: true }
    });
    return serializeDecimals(logs);
  } catch (e) {
    return [];
  }
}
