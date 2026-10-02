import {
  PrismaClient,
  Role,
  RentalType,
  BookingStatus,
  LeaseStatus,
  InstallmentStatus,
  CostCenterLevel,
  ExpenseCategoryType,
  TemporalDistributionType,
  CostAllocationMethod
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from './db.js';

// Safe serialization helper for Decimals & Dates in JSON API responses
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
  const updated = await prisma.companySettings.upsert({
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
  return serializeDecimals(updated);
}

// --- Properties & Floors Repository ---
export async function getPropertiesFromDb(allowedPropertyIds?: string[]) {
  if (!process.env.DATABASE_URL) return [];
  const isUniversal = !allowedPropertyIds || allowedPropertyIds.includes('all');
  const properties = await prisma.property.findMany({
    where: isUniversal ? {} : { id: { in: allowedPropertyIds } },
    include: {
      floors: { orderBy: { number: 'asc' } },
      units: { orderBy: { unitNumber: 'asc' } },
      parkingSpots: true
    },
    orderBy: { createdAt: 'asc' }
  });
  return serializeDecimals(properties);
}

export async function createPropertyInDb(data: {
  name: string;
  code: string;
  address: string;
  city?: string;
  district: string;
  floorsCount?: number;
  unitsCount?: number;
  totalAreaSqm?: number;
  rooftopPayment?: number;
  description?: string;
  images?: string[];
  isActive?: boolean;
}) {
  if (!process.env.DATABASE_URL) return null;
  const fCount = Math.max(1, Number(data.floorsCount) || 1);
  const created = await prisma.property.create({
    data: {
      name: data.name,
      code: data.code,
      address: data.address,
      city: data.city || 'الرياض',
      district: data.district,
      floorsCount: fCount,
      unitsCount: Number(data.unitsCount) || 0,
      totalAreaSqm: Number(data.totalAreaSqm) || 0,
      rooftopPayment: new Decimal(data.rooftopPayment || 0),
      description: data.description || null,
      images: Array.isArray(data.images) ? data.images : [],
      isActive: data.isActive !== false,
      floors: {
        create: [
          { number: -1, name: 'طابق القبو الأول (مواقف سيارات)' },
          { number: 0, name: 'طابق الاستقبال (البهو والبهو المشترك)' },
          ...Array.from({ length: fCount }, (_, i) => ({
            number: i + 1,
            name: `طابق الدور رقم ${i + 1}`
          }))
        ]
      }
    },
    include: { floors: { orderBy: { number: 'asc' } }, units: true, parkingSpots: true }
  });
  return serializeDecimals(created);
}

export async function createFloorInDb(propertyId: string, number: number, name: string) {
  if (!process.env.DATABASE_URL) return null;
  const floor = await prisma.floor.create({
    data: {
      propertyId,
      number,
      name
    }
  });
  return serializeDecimals(floor);
}

export async function updateFloorInDb(id: string, data: { number?: number; name?: string }) {
  if (!process.env.DATABASE_URL) return null;
  const updated = await prisma.floor.update({
    where: { id },
    data
  });
  return serializeDecimals(updated);
}

export async function deleteFloorInDb(id: string) {
  if (!process.env.DATABASE_URL) return null;
  const unitsCount = await prisma.unit.count({ where: { floorId: id } });
  if (unitsCount > 0) {
    throw new Error('لا يمكن حذف الطابق نظراً لوجود وحدات سكنية مرتبطة به.');
  }
  const deleted = await prisma.floor.delete({ where: { id } });
  return serializeDecimals(deleted);
}

export async function updatePropertyInDb(id: string, data: any) {
  if (!process.env.DATABASE_URL) return null;
  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.code !== undefined) updateData.code = data.code;
  if (data.address !== undefined) updateData.address = data.address;
  if (data.city !== undefined) updateData.city = data.city;
  if (data.district !== undefined) updateData.district = data.district;
  if (data.floorsCount !== undefined) updateData.floorsCount = Number(data.floorsCount);
  if (data.unitsCount !== undefined) updateData.unitsCount = Number(data.unitsCount);
  if (data.totalAreaSqm !== undefined) updateData.totalAreaSqm = Number(data.totalAreaSqm);
  if (data.rooftopPayment !== undefined) updateData.rooftopPayment = new Decimal(data.rooftopPayment);
  if (data.description !== undefined) updateData.description = data.description;
  if (data.images !== undefined) updateData.images = Array.isArray(data.images) ? data.images : [];
  if (data.isActive !== undefined) updateData.isActive = Boolean(data.isActive);

  const updated = await prisma.property.update({
    where: { id },
    data: updateData,
    include: { floors: true, units: true, parkingSpots: true }
  });
  return serializeDecimals(updated);
}

export async function deletePropertyInDb(id: string) {
  if (!process.env.DATABASE_URL) return null;
  // Check active allocations across units in this property
  const activeAllocations = await prisma.unitAllocation.findFirst({
    where: {
      unit: { propertyId: id },
      status: 'active',
      endDate: { gte: new Date() }
    }
  });

  if (activeAllocations) {
    throw new Error('لا يمكن حذف العقار لوجود وحدات مرتبطة بحجوزات أو عقود إيجار نشطة حالياً.');
  }

  const deleted = await prisma.property.delete({
    where: { id }
  });
  return serializeDecimals(deleted);
}

// --- Units Repository ---
export async function getUnitsFromDb(allowedPropertyIds?: string[]) {
  if (!process.env.DATABASE_URL) return [];
  const isUniversal = !allowedPropertyIds || allowedPropertyIds.includes('all');
  const units = await prisma.unit.findMany({
    where: isUniversal ? {} : { propertyId: { in: allowedPropertyIds } },
    include: {
      property: true,
      floor: true,
      allocations: {
        where: { status: 'active', endDate: { gte: new Date() } }
      }
    },
    orderBy: { unitNumber: 'asc' }
  });
  return serializeDecimals(units);
}

export async function createUnitInDb(data: {
  propertyId: string;
  floorId?: string;
  unitNumber: string;
  type?: string;
  areaSqm?: number;
  dailyRate?: number;
  monthlyRate?: number;
  annualRate?: number;
  occupancyStatus?: string;
  isClean?: boolean;
  publicationStatus?: string;
  images?: string[];
  spaces?: any;
  fittings?: any;
  smartLockPin?: string;
}) {
  if (!process.env.DATABASE_URL) return null;
  
  // Verify that the property exists in DB
  const property = await prisma.property.findUnique({
    where: { id: data.propertyId }
  });
  if (!property) {
    throw new Error('المبنى المحدد غير موجود في قاعدة البيانات.');
  }

  // Verify unit number uniqueness in property
  const existing = await prisma.unit.findFirst({
    where: {
      propertyId: data.propertyId,
      unitNumber: data.unitNumber
    }
  });
  if (existing) {
    throw new Error(`الوحدة رقم (${data.unitNumber}) موجودة مسبقاً في هذا العقار.`);
  }

  const created = await prisma.unit.create({
    data: {
      propertyId: data.propertyId,
      floorId: data.floorId || null,
      unitNumber: data.unitNumber,
      type: data.type || 'apartment',
      areaSqm: Number(data.areaSqm) || 0,
      dailyRate: new Decimal(data.dailyRate || 0),
      monthlyRate: new Decimal(data.monthlyRate || 0),
      annualRate: new Decimal(data.annualRate || 0),
      occupancyStatus: data.occupancyStatus || 'vacant',
      isClean: data.isClean !== false,
      publicationStatus: data.publicationStatus || 'published',
      images: Array.isArray(data.images) ? data.images : [],
      spaces: data.spaces || null,
      fittings: data.fittings || null,
      smartLockPin: data.smartLockPin || null
    },
    include: { property: true, floor: true }
  });

  // Increment property unitsCount
  await prisma.property.update({
    where: { id: data.propertyId },
    data: { unitsCount: { increment: 1 } }
  }).catch(() => {});

  return serializeDecimals(created);
}

export async function updateUnitInDb(id: string, data: any) {
  if (!process.env.DATABASE_URL) return null;

  const existing = await prisma.unit.findUnique({ where: { id } });
  if (!existing) throw new Error('الوحدة المحددة غير موجودة.');

  if (data.unitNumber && data.unitNumber !== existing.unitNumber) {
    const duplicate = await prisma.unit.findFirst({
      where: {
        id: { not: id },
        propertyId: data.propertyId || existing.propertyId,
        unitNumber: data.unitNumber
      }
    });
    if (duplicate) {
      throw new Error(`الوحدة رقم (${data.unitNumber}) مسجلة سلفاً في نفس العقار.`);
    }
  }

  const updateData: any = {};
  if (data.floorId !== undefined) updateData.floorId = data.floorId || null;
  if (data.unitNumber !== undefined) updateData.unitNumber = data.unitNumber;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.areaSqm !== undefined) updateData.areaSqm = Number(data.areaSqm);
  if (data.dailyRate !== undefined) updateData.dailyRate = new Decimal(data.dailyRate);
  if (data.monthlyRate !== undefined) updateData.monthlyRate = new Decimal(data.monthlyRate);
  if (data.annualRate !== undefined) updateData.annualRate = new Decimal(data.annualRate);
  if (data.occupancyStatus !== undefined) updateData.occupancyStatus = data.occupancyStatus;
  if (data.isClean !== undefined) updateData.isClean = Boolean(data.isClean);
  if (data.publicationStatus !== undefined) updateData.publicationStatus = data.publicationStatus;
  if (data.images !== undefined) updateData.images = Array.isArray(data.images) ? data.images : [];
  if (data.spaces !== undefined) updateData.spaces = data.spaces;
  if (data.fittings !== undefined) updateData.fittings = data.fittings;
  if (data.smartLockPin !== undefined) updateData.smartLockPin = data.smartLockPin;

  const updated = await prisma.unit.update({
    where: { id },
    data: updateData,
    include: { property: true, floor: true }
  });
  return serializeDecimals(updated);
}

export async function deleteUnitInDb(id: string) {
  if (!process.env.DATABASE_URL) return null;
  const activeAlloc = await prisma.unitAllocation.findFirst({
    where: { unitId: id, status: 'active', endDate: { gte: new Date() } }
  });

  if (activeAlloc) {
    throw new Error('لا يمكن حذف أو إلغاء الوحدة لوجود حجز أو عقد نشط مرتبط بها.');
  }

  const unit = await prisma.unit.findUnique({ where: { id } });
  const deleted = await prisma.unit.delete({ where: { id } });

  if (unit?.propertyId) {
    await prisma.property.update({
      where: { id: unit.propertyId },
      data: { unitsCount: { decrement: 1 } }
    }).catch(() => {});
  }

  return serializeDecimals(deleted);
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

export async function createExpenseInDb(data: {
  title: string;
  amount: number;
  costCenterLevel: CostCenterLevel;
  propertyId?: string;
  unitId?: string;
  categoryCode: ExpenseCategoryType;
  subcategory?: string;
  expenseDate?: string;
  startDate?: string;
  endDate?: string;
  temporalType?: TemporalDistributionType;
  allocationMethod?: CostAllocationMethod;
  status?: string;
  isCapitalAsset?: boolean;
  notes?: string;
  createdById?: string;
  allocations?: Array<{ unitId: string; shareAmount: number; percentage: number; monthPeriod: string }>;
  payments?: Array<{ amount: number; paymentMethod: string; referenceNo?: string; notes?: string }>;
}) {
  if (!process.env.DATABASE_URL) return null;

  const expenseNumber = `EXP-${Date.now().toString().slice(-6)}`;
  const now = new Date();
  const start = data.startDate ? new Date(data.startDate) : now;
  const end = data.endDate ? new Date(data.endDate) : now;

  const created = await prisma.operationalExpense.create({
    data: {
      expenseNumber,
      title: data.title,
      amount: new Decimal(data.amount),
      costCenterLevel: data.costCenterLevel || 'PROPERTY',
      propertyId: data.propertyId || null,
      unitId: data.unitId || null,
      categoryCode: data.categoryCode || 'OPERATIONS_OTHER',
      subcategory: data.subcategory || null,
      expenseDate: data.expenseDate ? new Date(data.expenseDate) : now,
      startDate: start,
      endDate: end,
      temporalType: data.temporalType || 'NONE',
      allocationMethod: data.allocationMethod || 'EQUAL_UNITS',
      status: data.status || 'approved',
      isCapitalAsset: Boolean(data.isCapitalAsset),
      notes: data.notes || null,
      createdById: data.createdById || null,
      allocations: data.allocations && data.allocations.length > 0 ? {
        create: data.allocations.map(a => ({
          unitId: a.unitId,
          shareAmount: new Decimal(a.shareAmount),
          percentage: Number(a.percentage) || 0,
          monthPeriod: a.monthPeriod || now.toISOString().slice(0, 7)
        }))
      } : undefined,
      payments: data.payments && data.payments.length > 0 ? {
        create: data.payments.map(p => ({
          amount: new Decimal(p.amount),
          paymentMethod: p.paymentMethod || 'bank_transfer',
          referenceNo: p.referenceNo || null,
          notes: p.notes || null
        }))
      } : undefined
    },
    include: {
      property: true,
      unit: true,
      allocations: { include: { unit: true } },
      payments: true
    }
  });

  return serializeDecimals(created);
}

export async function updateExpenseInDb(id: string, data: any) {
  if (!process.env.DATABASE_URL) return null;
  const updateData: any = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.amount !== undefined) updateData.amount = new Decimal(data.amount);
  if (data.status !== undefined) updateData.status = data.status;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.categoryCode !== undefined) updateData.categoryCode = data.categoryCode;
  if (data.subcategory !== undefined) updateData.subcategory = data.subcategory;

  const updated = await prisma.operationalExpense.update({
    where: { id },
    data: updateData,
    include: {
      property: true,
      unit: true,
      allocations: { include: { unit: true } },
      payments: true
    }
  });
  return serializeDecimals(updated);
}

export async function deleteExpenseInDb(id: string) {
  if (!process.env.DATABASE_URL) return null;
  const deleted = await prisma.operationalExpense.delete({
    where: { id }
  });
  return serializeDecimals(deleted);
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

// --- Import & Backup / Restore Transaction Engine ---
export async function importDataIntoDb(payload: any) {
  if (!process.env.DATABASE_URL) {
    throw new Error('قاعدة بيانات PostgreSQL غير متصلة.');
  }

  const results = {
    properties: { total: 0, imported: 0, duplicatesSkipped: 0 },
    floors: { total: 0, imported: 0, duplicatesSkipped: 0 },
    units: { total: 0, imported: 0, duplicatesSkipped: 0 },
    bookings: { total: 0, imported: 0, duplicatesSkipped: 0 },
    leases: { total: 0, imported: 0, duplicatesSkipped: 0 },
    expenses: { total: 0, imported: 0, duplicatesSkipped: 0 }
  };

  const properties = Array.isArray(payload.properties) ? payload.properties : [];
  const units = Array.isArray(payload.units) ? payload.units : [];
  const bookings = Array.isArray(payload.bookings) ? payload.bookings : [];
  const leases = Array.isArray(payload.leases) ? payload.leases : [];
  const expenses = Array.isArray(payload.expenses) ? payload.expenses : [];

  results.properties.total = properties.length;
  results.units.total = units.length;
  results.bookings.total = bookings.length;
  results.leases.total = leases.length;
  results.expenses.total = expenses.length;

  await prisma.$transaction(async (tx) => {
    // 1. Settings if provided
    if (payload.settings) {
      await tx.companySettings.upsert({
        where: { id: 'default' },
        update: {
          companyName: payload.settings.companyName || undefined,
          companyNameEn: payload.settings.companyNameEn || undefined,
          tagline: payload.settings.tagline || undefined,
          phone: payload.settings.phone || undefined,
          whatsapp: payload.settings.whatsapp || undefined,
          email: payload.settings.email || undefined,
          logoUrl: payload.settings.logoUrl || undefined,
          iconUrl: payload.settings.iconUrl || undefined,
          checkInTime: payload.settings.checkInTime || undefined,
          checkOutTime: payload.settings.checkOutTime || undefined
        },
        create: {
          id: 'default',
          companyName: payload.settings.companyName || 'Luxury home منزل الفخامة',
          companyNameEn: payload.settings.companyNameEn || 'Luxury Home',
          tagline: payload.settings.tagline || 'تجربة سكنية فاخرة',
          phone: payload.settings.phone || '+966 11 000 0000',
          whatsapp: payload.settings.whatsapp || '+966 50 000 0000',
          email: payload.settings.email || 'vip@luxuryhome.sa',
          checkInTime: payload.settings.checkInTime || '15:00',
          checkOutTime: payload.settings.checkOutTime || '12:00'
        }
      });
    }

    // 2. Properties
    for (const prop of properties) {
      const existing = await tx.property.findFirst({
        where: { OR: [{ id: prop.id }, { code: prop.code || prop.id }] }
      });
      if (existing) {
        results.properties.duplicatesSkipped++;
        continue;
      }
      await tx.property.create({
        data: {
          id: prop.id,
          name: prop.name || 'مبنى سكني',
          code: prop.code || prop.id || `P-${Date.now()}`,
          address: prop.address || 'الرياض',
          city: prop.city || 'الرياض',
          district: prop.district || 'حي النرجس',
          floorsCount: Number(prop.floorsCount) || 1,
          unitsCount: Number(prop.unitsCount) || 0,
          totalAreaSqm: Number(prop.totalAreaSqm) || 0,
          rooftopPayment: new Decimal(prop.rooftopPayment || 0),
          description: prop.description || null,
          images: Array.isArray(prop.images) ? prop.images : [],
          isActive: prop.isActive !== false
        }
      });
      results.properties.imported++;
    }

    // 3. Units
    for (const u of units) {
      const existing = await tx.unit.findFirst({
        where: { OR: [{ id: u.id }, { AND: [{ propertyId: u.propertyId }, { unitNumber: u.unitNumber }] }] }
      });
      if (existing) {
        results.units.duplicatesSkipped++;
        continue;
      }
      // Ensure property exists
      const propExists = await tx.property.findUnique({ where: { id: u.propertyId } });
      if (!propExists) {
        results.units.duplicatesSkipped++;
        continue;
      }

      await tx.unit.create({
        data: {
          id: u.id,
          propertyId: u.propertyId,
          floorId: u.floorId || null,
          unitNumber: u.unitNumber || '101',
          type: u.type || 'apartment',
          areaSqm: Number(u.areaSqm) || 0,
          dailyRate: new Decimal(u.dailyRate || 0),
          monthlyRate: new Decimal(u.monthlyRate || 0),
          annualRate: new Decimal(u.annualRate || u.yearlyRate || 0),
          occupancyStatus: u.occupancyStatus || 'vacant',
          isClean: u.isClean !== false,
          publicationStatus: u.publicationStatus || 'published',
          images: Array.isArray(u.images) ? u.images : (u.media ? u.media.map((m: any) => m.url || m) : []),
          spaces: u.spaces || null,
          fittings: u.fittings || null,
          smartLockPin: u.smartLockPin || null
        }
      });
      results.units.imported++;
    }

    // 4. Bookings
    for (const b of bookings) {
      const bNumber = b.bookingNumber || b.id;
      const existing = await tx.booking.findFirst({
        where: { OR: [{ id: b.id }, { bookingNumber: bNumber }] }
      });
      if (existing) {
        results.bookings.duplicatesSkipped++;
        continue;
      }
      const unit = await tx.unit.findUnique({ where: { id: b.unitId } });
      if (!unit) {
        results.bookings.duplicatesSkipped++;
        continue;
      }

      const checkIn = new Date(b.startDate || b.checkIn);
      const checkOut = new Date(b.endDate || b.checkOut);

      await tx.booking.create({
        data: {
          id: b.id,
          bookingNumber: bNumber,
          unitId: b.unitId,
          guestName: b.guestName || b.guest?.fullName || 'نزيل حجز',
          guestPhone: b.guestPhone || b.guest?.phone || '+966500000000',
          guestEmail: b.guestEmail || b.guest?.email || null,
          startDate: checkIn,
          endDate: checkOut,
          rentalType: (b.rentalType || 'daily').toUpperCase() as any,
          totalAmount: new Decimal(b.totalAmount || b.pricing?.total || 0),
          paidAmount: new Decimal(b.paidAmount || 0),
          status: (b.status || 'confirmed').toUpperCase() as any
        }
      });

      // Unit Allocation
      await tx.unitAllocation.create({
        data: {
          unitId: b.unitId,
          startDate: checkIn,
          endDate: checkOut,
          rentalType: 'DAILY',
          referenceId: bNumber,
          purpose: 'booking',
          status: 'active'
        }
      });

      results.bookings.imported++;
    }

    // 5. Leases
    for (const l of leases) {
      const cNumber = l.contractNumber || l.id;
      const existing = await tx.lease.findFirst({
        where: { OR: [{ id: l.id }, { contractNumber: cNumber }] }
      });
      if (existing) {
        results.leases.duplicatesSkipped++;
        continue;
      }
      const unit = await tx.unit.findUnique({ where: { id: l.unitId } });
      if (!unit) {
        results.leases.duplicatesSkipped++;
        continue;
      }

      const start = new Date(l.startDate);
      const end = new Date(l.endDate);

      await tx.lease.create({
        data: {
          id: l.id,
          contractNumber: cNumber,
          unitId: l.unitId,
          tenantName: l.tenantName || l.tenant?.fullName || 'مستأجر معتمد',
          tenantPhone: l.tenantPhone || l.tenant?.phone || '+966500000000',
          tenantEmail: l.tenantEmail || l.tenant?.email || null,
          tenantIdNumber: l.tenantIdNumber || l.tenant?.nationalIdOrPassport || '1000000000',
          startDate: start,
          endDate: end,
          rentalType: (l.rentalType || 'annual').toUpperCase() as any,
          annualRent: new Decimal(l.annualRent || l.totalRent || 0),
          paymentOption: l.paymentOption || '1_payment',
          paymentFrequency: l.paymentFrequency || '1_payment',
          securityDeposit: new Decimal(l.securityDeposit || 0),
          status: (l.status || 'active').toUpperCase() as any
        }
      });

      // Unit Allocation
      await tx.unitAllocation.create({
        data: {
          unitId: l.unitId,
          startDate: start,
          endDate: end,
          rentalType: (l.rentalType || 'annual').toUpperCase() as any,
          referenceId: cNumber,
          purpose: 'lease',
          status: 'active'
        }
      });

      results.leases.imported++;
    }

    // 6. Expenses
    for (const exp of expenses) {
      const expNumber = exp.expenseNumber || exp.id || `EXP-${Date.now()}`;
      const existing = await tx.operationalExpense.findFirst({
        where: { OR: [{ id: exp.id }, { expenseNumber: expNumber }] }
      });
      if (existing) {
        results.expenses.duplicatesSkipped++;
        continue;
      }

      await tx.operationalExpense.create({
        data: {
          id: exp.id,
          expenseNumber: expNumber,
          title: exp.title || exp.description || 'مصروف تشغيلي',
          amount: new Decimal(exp.amount || 0),
          costCenterLevel: (exp.costCenterLevel || exp.level || 'PROPERTY').toUpperCase() as any,
          propertyId: exp.propertyId || null,
          unitId: exp.unitId || null,
          categoryCode: (exp.categoryCode || 'OPERATIONS_OTHER') as any,
          startDate: exp.startDate ? new Date(exp.startDate) : new Date(),
          endDate: exp.endDate ? new Date(exp.endDate) : new Date(),
          status: exp.status || 'approved'
        }
      });

      results.expenses.imported++;
    }
  });

  return results;
}

export async function exportFullDatabase() {
  if (!process.env.DATABASE_URL) return null;
  const [
    settings,
    properties,
    floors,
    units,
    amenities,
    parkingSpots,
    allocations,
    bookings,
    leases,
    installments,
    payments,
    securityDeposits,
    expenses,
    expenseAllocations,
    auditLogs
  ] = await Promise.all([
    prisma.companySettings.findUnique({ where: { id: 'default' } }),
    prisma.property.findMany(),
    prisma.floor.findMany(),
    prisma.unit.findMany(),
    prisma.amenity.findMany(),
    prisma.parkingSpot.findMany(),
    prisma.unitAllocation.findMany(),
    prisma.booking.findMany(),
    prisma.lease.findMany(),
    prisma.leaseInstallment.findMany(),
    prisma.paymentRecord.findMany(),
    prisma.securityDepositRecord.findMany(),
    prisma.operationalExpense.findMany(),
    prisma.expenseAllocation.findMany(),
    prisma.auditLog.findMany({ take: 500, orderBy: { createdAt: 'desc' } })
  ]);

  return serializeDecimals({
    metadata: {
      exportedAt: new Date().toISOString(),
      version: '2.0.0',
      schema: 'PostgreSQL-LuxuryHome'
    },
    settings,
    properties,
    floors,
    units,
    amenities,
    parkingSpots,
    allocations,
    bookings,
    leases,
    installments,
    payments,
    securityDeposits,
    expenses,
    expenseAllocations,
    auditLogs
  });
}
