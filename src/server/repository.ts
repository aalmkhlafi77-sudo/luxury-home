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
import crypto from 'crypto';

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
  title?: string;
  titleEn?: string;
  type?: string;
  areaSqm?: number;
  floorNumber?: number;
  maxGuests?: number;
  bedroomsCount?: number;
  bathroomsCount?: number;
  bedsCount?: number;
  furnishingStatus?: string;
  allowDaily?: boolean;
  dailyRate?: number;
  dailySecurityDeposit?: number;
  allowMonthly?: boolean;
  monthlyRate?: number;
  monthlySecurityDeposit?: number;
  allowYearly?: boolean;
  annualRate?: number;
  yearlyRate?: number;
  yearlySecurityDeposit?: number;
  yearlyPaymentOptions?: string[];
  semiAnnualSurchargePercent?: number;
  cleaningFee?: number;
  securityDeposit?: number;
  taxPercentage?: number;
  operationalStatus?: string;
  occupancyStatus?: string;
  isClean?: boolean;
  publicationStatus?: string;
  amenities?: string[];
  images?: string[];
  media?: any;
  spaces?: any;
  fittings?: any;
  floorPlanUrl?: string;
  assignedParkingId?: string;
  notes?: string;
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

  // If floorId provided, verify floor exists and belongs to property
  if (data.floorId) {
    const floor = await prisma.floor.findUnique({ where: { id: data.floorId } });
    if (!floor) throw new Error('الطابق المحدد غير موجود في قاعدة البيانات.');
    if (floor.propertyId !== data.propertyId) throw new Error('الطابق المحدد لا ينتمي إلى هذا المبنى.');
  }

  // Verify unit number uniqueness in property
  const existing = await prisma.unit.findFirst({
    where: {
      propertyId: data.propertyId,
      unitNumber: String(data.unitNumber).trim(),
      publicationStatus: { not: 'archived' }
    }
  });
  if (existing) {
    throw new Error(`الوحدة رقم (${data.unitNumber}) مسجلة سلفاً في هذا العقار.`);
  }

  const created = await prisma.unit.create({
    data: {
      propertyId: data.propertyId,
      floorId: data.floorId || null,
      unitNumber: String(data.unitNumber).trim(),
      title: data.title || `شقة منزل الفخامة رقم #${data.unitNumber}`,
      titleEn: data.titleEn || `Unit #${data.unitNumber}`,
      type: data.type || 'apartment',
      areaSqm: data.areaSqm !== undefined ? Number(data.areaSqm) : 0,
      floorNumber: data.floorNumber !== undefined ? Number(data.floorNumber) : 1,
      maxGuests: data.maxGuests !== undefined ? Number(data.maxGuests) : 3,
      bedroomsCount: data.bedroomsCount !== undefined ? Number(data.bedroomsCount) : 1,
      bathroomsCount: data.bathroomsCount !== undefined ? Number(data.bathroomsCount) : 1,
      bedsCount: data.bedsCount !== undefined ? Number(data.bedsCount) : 1,
      furnishingStatus: data.furnishingStatus || 'furnished',
      allowDaily: data.allowDaily !== false,
      dailyRate: new Decimal(data.dailyRate ?? 0),
      dailySecurityDeposit: new Decimal(data.dailySecurityDeposit ?? 0),
      allowMonthly: data.allowMonthly !== false,
      monthlyRate: new Decimal(data.monthlyRate ?? 0),
      monthlySecurityDeposit: new Decimal(data.monthlySecurityDeposit ?? 0),
      allowYearly: data.allowYearly !== false,
      annualRate: new Decimal(data.annualRate ?? data.yearlyRate ?? 0),
      yearlySecurityDeposit: new Decimal(data.yearlySecurityDeposit ?? 0),
      yearlyPaymentOptions: Array.isArray(data.yearlyPaymentOptions) ? data.yearlyPaymentOptions : ['single_annual', 'semi_annual'],
      semiAnnualSurchargePercent: new Decimal(data.semiAnnualSurchargePercent ?? 0),
      cleaningFee: new Decimal(data.cleaningFee ?? 0),
      securityDeposit: new Decimal(data.securityDeposit ?? 0),
      taxPercentage: new Decimal(data.taxPercentage ?? 15),
      operationalStatus: data.operationalStatus || 'ready',
      occupancyStatus: data.occupancyStatus || 'vacant',
      isClean: data.isClean !== false,
      publicationStatus: data.publicationStatus || 'published',
      amenities: Array.isArray(data.amenities) ? data.amenities : [],
      images: Array.isArray(data.images) ? data.images : [],
      media: data.media || null,
      spaces: data.spaces || null,
      fittings: data.fittings || null,
      floorPlanUrl: data.floorPlanUrl || null,
      assignedParkingId: data.assignedParkingId || null,
      notes: data.notes || null,
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

export function computeServerRoomMetrics(spaces: any[] = []) {
  if (!Array.isArray(spaces) || spaces.length === 0) return null;
  let bedroomsCount = 0;
  let bathroomsCount = 0;
  let bedsCount = 0;

  for (const space of spaces) {
    if (space?.type === 'bedroom') {
      bedroomsCount += 1;
    } else if (space?.type === 'bathroom') {
      bathroomsCount += 1;
    }

    if (space?.bedsCount && Number(space.bedsCount) > 0) {
      bedsCount += Number(space.bedsCount);
    } else if (Array.isArray(space?.fittings) && space.fittings.length > 0) {
      for (const fit of space.fittings) {
        if (fit?.category === 'bed') {
          bedsCount += Number(fit.quantity) || 1;
        }
      }
    }
  }

  return {
    bedroomsCount: Math.max(bedroomsCount, 1),
    bathroomsCount: Math.max(bathroomsCount, 1),
    bedsCount: Math.max(bedsCount, 1),
  };
}

export async function updateUnitInDb(id: string, data: any) {
  if (!process.env.DATABASE_URL) return null;

  const existing = await prisma.unit.findUnique({ where: { id } });
  if (!existing) throw new Error('الوحدة المحددة غير موجودة.');

  const propId = data.propertyId || existing.propertyId;

  // Floor verification if floorId is changed
  if (data.floorId && data.floorId !== existing.floorId) {
    const floor = await prisma.floor.findUnique({ where: { id: data.floorId } });
    if (!floor) throw new Error('الطابق المحدد غير موجود في قاعدة البيانات.');
    if (floor.propertyId !== propId) throw new Error('الطابق المحدد لا ينتمي إلى هذا المبنى.');
  }

  // Duplicate unitNumber verification if changed
  if (data.unitNumber && data.unitNumber.trim() !== existing.unitNumber.trim()) {
    const duplicate = await prisma.unit.findFirst({
      where: {
        id: { not: id },
        propertyId: propId,
        unitNumber: data.unitNumber.trim(),
        publicationStatus: { not: 'archived' }
      }
    });
    if (duplicate) {
      throw new Error(`الوحدة رقم (${data.unitNumber}) مسجلة سلفاً في نفس العقار.`);
    }
  }

  const updateData: any = {};
  if (data.floorId !== undefined) updateData.floorId = data.floorId || null;
  if (data.unitNumber !== undefined) updateData.unitNumber = String(data.unitNumber).trim();
  if (data.title !== undefined) updateData.title = data.title;
  if (data.titleEn !== undefined) updateData.titleEn = data.titleEn;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.areaSqm !== undefined) updateData.areaSqm = Number(data.areaSqm);
  if (data.floorNumber !== undefined) updateData.floorNumber = Number(data.floorNumber);
  if (data.maxGuests !== undefined) updateData.maxGuests = Number(data.maxGuests);
  if (data.bedroomsCount !== undefined) updateData.bedroomsCount = Number(data.bedroomsCount);
  if (data.bathroomsCount !== undefined) updateData.bathroomsCount = Number(data.bathroomsCount);
  if (data.bedsCount !== undefined) updateData.bedsCount = Number(data.bedsCount);
  if (data.furnishingStatus !== undefined) updateData.furnishingStatus = data.furnishingStatus;
  if (data.allowDaily !== undefined) updateData.allowDaily = Boolean(data.allowDaily);
  if (data.dailyRate !== undefined) updateData.dailyRate = new Decimal(data.dailyRate);
  if (data.dailySecurityDeposit !== undefined) updateData.dailySecurityDeposit = new Decimal(data.dailySecurityDeposit);
  if (data.allowMonthly !== undefined) updateData.allowMonthly = Boolean(data.allowMonthly);
  if (data.monthlyRate !== undefined) updateData.monthlyRate = new Decimal(data.monthlyRate);
  if (data.monthlySecurityDeposit !== undefined) updateData.monthlySecurityDeposit = new Decimal(data.monthlySecurityDeposit);
  if (data.allowYearly !== undefined) updateData.allowYearly = Boolean(data.allowYearly);
  if (data.annualRate !== undefined || data.yearlyRate !== undefined) {
    updateData.annualRate = new Decimal(data.annualRate ?? data.yearlyRate);
  }
  if (data.yearlySecurityDeposit !== undefined) updateData.yearlySecurityDeposit = new Decimal(data.yearlySecurityDeposit);
  if (data.yearlyPaymentOptions !== undefined) {
    updateData.yearlyPaymentOptions = Array.isArray(data.yearlyPaymentOptions) ? data.yearlyPaymentOptions : [];
  }
  if (data.semiAnnualSurchargePercent !== undefined) updateData.semiAnnualSurchargePercent = new Decimal(data.semiAnnualSurchargePercent);
  if (data.cleaningFee !== undefined) updateData.cleaningFee = new Decimal(data.cleaningFee);
  if (data.securityDeposit !== undefined) updateData.securityDeposit = new Decimal(data.securityDeposit);
  if (data.taxPercentage !== undefined) updateData.taxPercentage = new Decimal(data.taxPercentage);
  if (data.operationalStatus !== undefined) updateData.operationalStatus = data.operationalStatus;
  if (data.occupancyStatus !== undefined) updateData.occupancyStatus = data.occupancyStatus;
  if (data.isClean !== undefined) updateData.isClean = Boolean(data.isClean);
  if (data.publicationStatus !== undefined) updateData.publicationStatus = data.publicationStatus;
  if (data.amenities !== undefined) updateData.amenities = Array.isArray(data.amenities) ? data.amenities : [];
  if (data.images !== undefined) updateData.images = Array.isArray(data.images) ? data.images : [];
  if (data.media !== undefined) updateData.media = data.media;
  if (data.spaces !== undefined) updateData.spaces = data.spaces;
  if (data.fittings !== undefined) updateData.fittings = data.fittings;
  if (data.floorPlanUrl !== undefined) updateData.floorPlanUrl = data.floorPlanUrl;
  if (data.assignedParkingId !== undefined) updateData.assignedParkingId = data.assignedParkingId;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.smartLockPin !== undefined) updateData.smartLockPin = data.smartLockPin;

  if (Array.isArray(data.spaces)) {
    const metrics = computeServerRoomMetrics(data.spaces);
    if (metrics) {
      updateData.bedroomsCount = metrics.bedroomsCount;
      updateData.bathroomsCount = metrics.bathroomsCount;
      updateData.bedsCount = metrics.bedsCount;
    }
  }

  const updated = await prisma.unit.update({
    where: { id },
    data: updateData,
    include: { property: true, floor: true }
  });
  return serializeDecimals(updated);
}

// Canonical deterministic fingerprint hash computation for batch unit creations
export function computeBatchFingerprint(propertyId: string, floorId: string, units: any[]): string {
  const canonicalUnits = units.map(u => ({
    unitNumber: String(u.unitNumber ?? '').trim(),
    title: String(u.title ?? ''),
    titleEn: String(u.titleEn ?? ''),
    type: String(u.type ?? 'apartment'),
    areaSqm: Number(u.areaSqm ?? 0),
    floorNumber: Number(u.floorNumber ?? 1),
    maxGuests: Number(u.maxGuests ?? 3),
    bedroomsCount: Number(u.bedroomsCount ?? 1),
    bathroomsCount: Number(u.bathroomsCount ?? 1),
    bedsCount: Number(u.bedsCount ?? 1),
    furnishingStatus: String(u.furnishingStatus ?? 'furnished'),
    allowDaily: Boolean(u.allowDaily !== false),
    dailyRate: Number(u.dailyRate ?? 0),
    dailySecurityDeposit: Number(u.dailySecurityDeposit ?? 0),
    allowMonthly: Boolean(u.allowMonthly !== false),
    monthlyRate: Number(u.monthlyRate ?? 0),
    monthlySecurityDeposit: Number(u.monthlySecurityDeposit ?? 0),
    allowYearly: Boolean(u.allowYearly !== false),
    annualRate: Number(u.annualRate ?? u.yearlyRate ?? 0),
    yearlySecurityDeposit: Number(u.yearlySecurityDeposit ?? 0),
    yearlyPaymentOptions: Array.isArray(u.yearlyPaymentOptions) ? [...u.yearlyPaymentOptions].sort() : ['single_annual', 'semi_annual'],
    semiAnnualSurchargePercent: Number(u.semiAnnualSurchargePercent ?? 0),
    cleaningFee: Number(u.cleaningFee ?? 0),
    securityDeposit: Number(u.securityDeposit ?? 0),
    taxPercentage: Number(u.taxPercentage ?? 15),
    operationalStatus: String(u.operationalStatus ?? 'ready'),
    occupancyStatus: String(u.occupancyStatus ?? 'vacant'),
    isClean: Boolean(u.isClean !== false),
    publicationStatus: String(u.publicationStatus ?? 'published'),
    amenities: Array.isArray(u.amenities) ? [...u.amenities].sort() : [],
    images: Array.isArray(u.images) ? [...u.images] : [],
    media: u.media ?? null,
    spaces: u.spaces ?? null,
    fittings: u.fittings ?? null,
    floorPlanUrl: u.floorPlanUrl ?? null,
    assignedParkingId: u.assignedParkingId ?? null,
    notes: u.notes ?? null,
    smartLockPin: u.smartLockPin ?? null
  }));

  const canonicalPayload = JSON.stringify({
    propertyId: String(propertyId),
    floorId: String(floorId),
    units: canonicalUnits
  });

  return crypto.createHash('sha256').update(canonicalPayload).digest('hex');
}

export async function createBatchUnitsInDb(params: {
  propertyId: string;
  floorId: string;
  units: any[];
  idempotencyKey?: string;
  userId?: string;
  userRole?: string;
}) {
  if (!process.env.DATABASE_URL) return null;
  const { propertyId, floorId, units, idempotencyKey, userId, userRole } = params;

  // Calculate comprehensive payload fingerprint hash for idempotency verification
  const requestHash = computeBatchFingerprint(propertyId, floorId, units);

  // If idempotencyKey provided, check existing record
  if (idempotencyKey) {
    const existingRecord = await prisma.idempotencyRecord.findUnique({
      where: {
        key_operationType: {
          key: idempotencyKey,
          operationType: 'batch_units_create'
        }
      }
    });

    if (existingRecord) {
      // Verify user scope: must match creator or be SUPER_ADMIN
      if (existingRecord.userId && userId && existingRecord.userId !== userId && userRole !== 'SUPER_ADMIN') {
        const err: any = new Error('غير مصرح لك بالوصول إلى مفتاح عملية يخص مستخدماً آخر.');
        err.statusCode = 403;
        throw err;
      }

      if (existingRecord.requestHash === requestHash) {
        return existingRecord.responseBody as any[];
      } else {
        const err: any = new Error('تعارض مفتاح منع التكرار: تم استخدام نفس المفتاح مع بيانات حمولة مختلفة.');
        err.statusCode = 409;
        throw err;
      }
    }
  }

  // 1. Verify Property
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) throw new Error('المبنى المحدد غير موجود في قاعدة البيانات.');

  // 2. Verify Floor & Property ownership
  const floor = await prisma.floor.findUnique({ where: { id: floorId } });
  if (!floor) throw new Error('الطابق المحدد غير موجود في قاعدة البيانات.');
  if (floor.propertyId !== propertyId) {
    throw new Error('الطابق المحدد لا ينتمي إلى هذا المبنى.');
  }

  // 3. Check duplicates within incoming batch
  const unitNumbers = units.map(u => String(u.unitNumber).trim());
  const uniqueNums = new Set(unitNumbers);
  if (uniqueNums.size !== unitNumbers.length) {
    throw new Error('تحتوي المجموعة على أرقام وحدات مكررة ضمن نفس الطلب.');
  }

  // 4. Check duplicates against existing DB units for this property (unarchived)
  const existing = await prisma.unit.findMany({
    where: {
      propertyId,
      unitNumber: { in: unitNumbers },
      publicationStatus: { not: 'archived' }
    }
  });

  if (existing.length > 0) {
    const duplicateList = existing.map(u => u.unitNumber).join(', ');
    const err: any = new Error(`تعذر إنشاء المجموعة لوجود وحدات مسجلة سلفاً في المبنى بنفس الأرقام: (${duplicateList}). لم يتم حفظ أي وحدة.`);
    err.statusCode = 409;
    throw err;
  }

  // 5. Execute transactional batch insertion
  const createdUnits = await prisma.$transaction(async (tx) => {
    // If concurrent request race condition occurred with the same idempotency key
    if (idempotencyKey) {
      const concurrentRecord = await tx.idempotencyRecord.findUnique({
        where: {
          key_operationType: {
            key: idempotencyKey,
            operationType: 'batch_units_create'
          }
        }
      });
      if (concurrentRecord) {
        if (concurrentRecord.requestHash === requestHash) {
          return concurrentRecord.responseBody as any[];
        } else {
          const err: any = new Error('تعارض مفتاح منع التكرار: تم استخدام نفس المفتاح مع بيانات حمولة مختلفة.');
          err.statusCode = 409;
          throw err;
        }
      }
    }

    const results = [];
    for (const u of units) {
      const created = await tx.unit.create({
        data: {
          propertyId,
          floorId,
          unitNumber: String(u.unitNumber).trim(),
          title: u.title || `شقة منزل الفخامة رقم #${u.unitNumber}`,
          titleEn: u.titleEn || `Unit #${u.unitNumber}`,
          type: u.type || 'apartment',
          areaSqm: u.areaSqm !== undefined && u.areaSqm !== null ? Number(u.areaSqm) : 0,
          floorNumber: floor.number,
          maxGuests: u.maxGuests !== undefined && u.maxGuests !== null ? Number(u.maxGuests) : 3,
          bedroomsCount: u.bedroomsCount !== undefined && u.bedroomsCount !== null ? Number(u.bedroomsCount) : 1,
          bathroomsCount: u.bathroomsCount !== undefined && u.bathroomsCount !== null ? Number(u.bathroomsCount) : 1,
          bedsCount: u.bedsCount !== undefined && u.bedsCount !== null ? Number(u.bedsCount) : 1,
          furnishingStatus: u.furnishingStatus || 'furnished',
          allowDaily: u.allowDaily !== false,
          dailyRate: new Decimal(u.dailyRate ?? 0),
          dailySecurityDeposit: new Decimal(u.dailySecurityDeposit ?? 0),
          allowMonthly: u.allowMonthly !== false,
          monthlyRate: new Decimal(u.monthlyRate ?? 0),
          monthlySecurityDeposit: new Decimal(u.monthlySecurityDeposit ?? 0),
          allowYearly: u.allowYearly !== false,
          annualRate: new Decimal(u.annualRate ?? u.yearlyRate ?? 0),
          yearlySecurityDeposit: new Decimal(u.yearlySecurityDeposit ?? 0),
          yearlyPaymentOptions: Array.isArray(u.yearlyPaymentOptions) ? u.yearlyPaymentOptions : ['single_annual', 'semi_annual'],
          semiAnnualSurchargePercent: new Decimal(u.semiAnnualSurchargePercent ?? 0),
          cleaningFee: new Decimal(u.cleaningFee ?? 0),
          securityDeposit: new Decimal(u.securityDeposit ?? 0),
          taxPercentage: new Decimal(u.taxPercentage ?? 15),
          operationalStatus: u.operationalStatus || 'ready',
          occupancyStatus: u.occupancyStatus || 'vacant',
          isClean: u.isClean !== false,
          publicationStatus: u.publicationStatus || 'published',
          amenities: Array.isArray(u.amenities) ? u.amenities : [],
          images: Array.isArray(u.images) ? u.images : [],
          media: u.media || null,
          spaces: u.spaces || null,
          fittings: u.fittings || null,
          floorPlanUrl: u.floorPlanUrl || null,
          assignedParkingId: u.assignedParkingId || null,
          notes: u.notes || null,
          smartLockPin: u.smartLockPin || null
        },
        include: { property: true, floor: true }
      });
      results.push(created);
    }

    await tx.property.update({
      where: { id: propertyId },
      data: { unitsCount: { increment: units.length } }
    });

    const serializedResults = serializeDecimals(results);

    if (idempotencyKey) {
      await tx.idempotencyRecord.create({
        data: {
          key: idempotencyKey,
          operationType: 'batch_units_create',
          userId: userId || null,
          requestHash,
          statusCode: 200,
          responseBody: serializedResults as any
        }
      });
    }

    return serializedResults;
  });

  return createdUnits;
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

// --- Parking Spots Repository ---
export async function getParkingSpotsFromDb(allowedPropertyIds?: string[]) {
  if (!process.env.DATABASE_URL) return [];
  const isUniversal = !allowedPropertyIds || allowedPropertyIds.includes('all');
  const spots = await prisma.parkingSpot.findMany({
    where: isUniversal ? {} : { propertyId: { in: allowedPropertyIds } },
    include: { property: true },
    orderBy: { spotNumber: 'asc' }
  });
  return serializeDecimals(spots);
}

export async function createParkingSpotInDb(data: {
  propertyId: string;
  spotNumber: string;
  floor?: string;
  hasEVCharger?: boolean;
  status?: string;
  assignedUnitId?: string;
}) {
  if (!process.env.DATABASE_URL) return null;

  const prop = await prisma.property.findUnique({ where: { id: data.propertyId } });
  if (!prop) throw new Error('المبنى المحدد غير موجود في قاعدة البيانات.');

  const duplicate = await prisma.parkingSpot.findFirst({
    where: {
      propertyId: data.propertyId,
      spotNumber: String(data.spotNumber).trim()
    }
  });
  if (duplicate) {
    throw new Error(`موقف سيارات بالرقم "${data.spotNumber}" مسجل بالفعل في هذا المبنى.`);
  }

  if (data.assignedUnitId) {
    const unit = await prisma.unit.findUnique({ where: { id: data.assignedUnitId } });
    if (!unit) throw new Error('الوحدة المحددة غير موجودة.');
    if (unit.propertyId !== data.propertyId) {
      throw new Error('الموقف والوحدة لا ينتميان إلى نفس المبنى.');
    }
  }

  return await prisma.$transaction(async (tx) => {
    const assignedUnitId = data.assignedUnitId || null;
    const status = data.status || (assignedUnitId ? 'assigned' : 'vacant');

    if (assignedUnitId) {
      const currentSpot = await tx.parkingSpot.findFirst({
        where: { assignedUnitId }
      });
      if (currentSpot) {
        await tx.parkingSpot.update({
          where: { id: currentSpot.id },
          data: { assignedUnitId: null, status: 'vacant' }
        });
      }
    }

    const created = await tx.parkingSpot.create({
      data: {
        propertyId: data.propertyId,
        spotNumber: String(data.spotNumber).trim(),
        floor: data.floor || 'الدور الأرضي',
        hasEVCharger: Boolean(data.hasEVCharger),
        status,
        assignedUnitId
      }
    });

    if (assignedUnitId) {
      await tx.unit.update({
        where: { id: assignedUnitId },
        data: { assignedParkingId: created.id }
      });
    }

    return serializeDecimals(created);
  });
}

export async function updateParkingSpotInDb(id: string, data: any) {
  if (!process.env.DATABASE_URL) return null;

  const existing = await prisma.parkingSpot.findUnique({ where: { id } });
  if (!existing) throw new Error('موقف السيارات المحدد غير موجود.');

  const propId = data.propertyId || existing.propertyId;

  if (data.spotNumber && String(data.spotNumber).trim() !== existing.spotNumber.trim()) {
    const duplicate = await prisma.parkingSpot.findFirst({
      where: {
        id: { not: id },
        propertyId: propId,
        spotNumber: String(data.spotNumber).trim()
      }
    });
    if (duplicate) {
      throw new Error(`موقف سيارات بالرقم "${data.spotNumber}" مسجل بالفعل في هذا المبنى.`);
    }
  }

  const updateData: any = {};
  if (data.spotNumber !== undefined) updateData.spotNumber = String(data.spotNumber).trim();
  if (data.floor !== undefined) updateData.floor = data.floor;
  if (data.hasEVCharger !== undefined) updateData.hasEVCharger = Boolean(data.hasEVCharger);
  if (data.status !== undefined) updateData.status = data.status;

  const updated = await prisma.parkingSpot.update({
    where: { id },
    data: updateData
  });
  return serializeDecimals(updated);
}

export async function deleteParkingSpotInDb(id: string) {
  if (!process.env.DATABASE_URL) return null;

  return await prisma.$transaction(async (tx) => {
    const existing = await tx.parkingSpot.findUnique({ where: { id } });
    if (!existing) throw new Error('موقف السيارات المحدد غير موجود.');

    await tx.unit.updateMany({
      where: { assignedParkingId: id },
      data: { assignedParkingId: null }
    });

    const deleted = await tx.parkingSpot.delete({ where: { id } });
    return serializeDecimals(deleted);
  });
}

export async function assignParkingSpotInDb(spotId: string, unitId: string) {
  if (!process.env.DATABASE_URL) return null;

  return await prisma.$transaction(async (tx) => {
    const spot = await tx.parkingSpot.findUnique({ where: { id: spotId } });
    if (!spot) throw new Error('موقف السيارات المحدد غير موجود.');

    const unit = await tx.unit.findUnique({ where: { id: unitId } });
    if (!unit) throw new Error('الوحدة المحددة غير موجودة.');

    if (spot.propertyId !== unit.propertyId) {
      throw new Error('الموقف والوحدة لا ينتميان إلى نفس المبنى.');
    }

    if (spot.assignedUnitId && spot.assignedUnitId !== unitId) {
      throw new Error(`موقف السيارات (${spot.spotNumber}) مخصص مسبقاً لوحدة أخرى. يجب فك التعيين أولاً.`);
    }

    if (unit.assignedParkingId && unit.assignedParkingId !== spotId) {
      await tx.parkingSpot.update({
        where: { id: unit.assignedParkingId },
        data: { assignedUnitId: null, status: 'vacant' }
      });
    }

    const updatedSpot = await tx.parkingSpot.update({
      where: { id: spotId },
      data: { assignedUnitId: unitId, status: 'assigned' }
    });

    const updatedUnit = await tx.unit.update({
      where: { id: unitId },
      data: { assignedParkingId: spotId }
    });

    return {
      spot: serializeDecimals(updatedSpot),
      unit: serializeDecimals(updatedUnit)
    };
  });
}

export async function unassignParkingSpotInDb(spotId: string) {
  if (!process.env.DATABASE_URL) return null;

  return await prisma.$transaction(async (tx) => {
    const spot = await tx.parkingSpot.findUnique({ where: { id: spotId } });
    if (!spot) throw new Error('موقف السيارات المحدد غير موجود.');

    const currentUnitId = spot.assignedUnitId;

    const updatedSpot = await tx.parkingSpot.update({
      where: { id: spotId },
      data: { assignedUnitId: null, status: 'vacant' }
    });

    if (currentUnitId) {
      await tx.unit.update({
        where: { id: currentUnitId },
        data: { assignedParkingId: null }
      });
    }

    await tx.unit.updateMany({
      where: { assignedParkingId: spotId },
      data: { assignedParkingId: null }
    });

    return serializeDecimals(updatedSpot);
  });
}

// --- Bookings & Leases Repository ---
export async function getBookingsFromDb(allowedPropertyIds?: string[]) {
  if (!process.env.DATABASE_URL) return [];
  const isUniversal = !allowedPropertyIds || allowedPropertyIds.includes('all');
  const bookings = await prisma.booking.findMany({
    where: isUniversal ? {} : { unit: { propertyId: { in: allowedPropertyIds } } },
    include: {
      unit: { include: { property: true } },
      payments: true,
      securityDeposits: {
        include: {
          transactions: true
        }
      }
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
      securityDeposits: {
        include: {
          transactions: true
        }
      },
      payments: true
    },
    orderBy: { createdAt: 'desc' }
  });
  return serializeDecimals(leases);
}

export async function getAllocationsFromDb(allowedPropertyIds?: string[]) {
  if (!process.env.DATABASE_URL) return [];
  const isUniversal = !allowedPropertyIds || allowedPropertyIds.includes('all');
  const allocations = await prisma.unitAllocation.findMany({
    where: isUniversal ? {} : { unit: { propertyId: { in: allowedPropertyIds } } },
    include: {
      unit: { include: { property: true } }
    },
    orderBy: { startDate: 'asc' }
  });
  return serializeDecimals(allocations);
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

export async function saveDocumentRecordInDb(data: {
  fileName: string;
  originalName: string;
  fileSize: number;
  mimeType?: string | null;
  isPrivate: boolean;
  ownerUserId?: string | null;
  propertyId?: string | null;
  unitId?: string | null;
  bookingId?: string | null;
  leaseId?: string | null;
  notes?: string | null;
}) {
  if (!process.env.DATABASE_URL) return null;
  const doc = await prisma.documentRecord.upsert({
    where: { fileName: data.fileName },
    update: data,
    create: data
  });
  return serializeDecimals(doc);
}

export async function getDocumentRecordFromDb(fileName: string) {
  if (!process.env.DATABASE_URL) return null;
  const doc = await prisma.documentRecord.findUnique({
    where: { fileName }
  });
  return serializeDecimals(doc);
}

export async function exportFullDatabase() {
  if (!process.env.DATABASE_URL) return null;
  const [
    users,
    settings,
    properties,
    floors,
    amenities,
    units,
    parkingSpots,
    allocations,
    bookings,
    leases,
    installments,
    securityDeposits,
    securityDepositTransactions,
    payments,
    expenses,
    expenseAllocations,
    expensePayments,
    expenseCategories,
    recurringSchedules,
    tenantAdjustments,
    contentSections,
    documentRecords,
    idempotencyRecords,
    auditLogs
  ] = await Promise.all([
    prisma.user.findMany(),
    prisma.companySettings.findUnique({ where: { id: 'default' } }),
    prisma.property.findMany(),
    prisma.floor.findMany(),
    prisma.amenity.findMany(),
    prisma.unit.findMany(),
    prisma.parkingSpot.findMany(),
    prisma.unitAllocation.findMany(),
    prisma.booking.findMany(),
    prisma.lease.findMany(),
    prisma.leaseInstallment.findMany(),
    prisma.securityDepositRecord.findMany(),
    prisma.securityDepositTransaction.findMany(),
    prisma.paymentRecord.findMany(),
    prisma.operationalExpense.findMany(),
    prisma.expenseAllocation.findMany(),
    prisma.expensePaymentEntry.findMany(),
    prisma.expenseCategoryConfig.findMany(),
    prisma.recurringExpenseSchedule.findMany(),
    prisma.tenantAdjustment.findMany(),
    prisma.contentSection.findMany(),
    prisma.documentRecord.findMany(),
    prisma.idempotencyRecord.findMany(),
    prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' } }) // Complete audit logs (no take limit)
  ]);

  return serializeDecimals({
    metadata: {
      exportedAt: new Date().toISOString(),
      version: '2.0.0',
      schema: 'PostgreSQL-LuxuryHome'
    },
    users,
    settings,
    properties,
    floors,
    amenities,
    units,
    parkingSpots,
    allocations,
    bookings,
    leases,
    installments,
    securityDeposits,
    securityDepositTransactions,
    payments,
    expenses,
    expenseAllocations,
    expensePayments,
    expenseCategories,
    recurringSchedules,
    tenantAdjustments,
    contentSections,
    documentRecords,
    idempotencyRecords,
    auditLogs
  });
}

export const REQUIRED_FULL_BACKUP_COLLECTIONS = [
  'users',
  'properties',
  'floors',
  'amenities',
  'units',
  'parkingSpots',
  'allocations',
  'bookings',
  'leases',
  'installments',
  'securityDeposits',
  'securityDepositTransactions',
  'payments',
  'expenses',
  'expenseAllocations',
  'expensePayments',
  'expenseCategories',
  'recurringSchedules',
  'tenantAdjustments',
  'contentSections',
  'documentRecords',
  'idempotencyRecords',
  'auditLogs'
];

export function validateBackupPackageIntegrity(backupData: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!backupData || typeof backupData !== 'object') {
    return { isValid: false, errors: ['هيكل بيانات النسخة الاحتياطية غير صالح أو فارغ.'] };
  }

  // 1. Validate All Mandatory Collections (Distinguish between empty array [] vs missing/undefined)
  const missingCollections: string[] = [];
  for (const collName of REQUIRED_FULL_BACKUP_COLLECTIONS) {
    if (!Array.isArray(backupData[collName])) {
      missingCollections.push(collName);
    }
  }

  if (missingCollections.length > 0) {
    errors.push(`فشل التحقق من اكتمال النسخة: النسخة الاحتياطية ناقصة وتفتقر للأقسام التالية: (${missingCollections.join(', ')}).`);
  }

  if (backupData.settings === undefined) {
    errors.push('فشل التحقق من اكتمال النسخة: إعدادات المنشأة (settings) مفقودة من حزمة النسخ الاحتياطي.');
  }

  // If missing collections found, abort early with exact list
  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  // 2. Validate Relational Consistency Across Entities Before Any Deletion
  const propIdSet = new Set<string>();
  for (const p of backupData.properties || []) {
    if (propIdSet.has(String(p.id))) errors.push(`معرف مبنى مكرر في الحزمة: ${p.id}`);
    propIdSet.add(String(p.id));
  }

  const unitIdSet = new Set<string>();
  for (const u of backupData.units || []) {
    if (unitIdSet.has(String(u.id))) errors.push(`معرف وحدة مكرر في الحزمة: ${u.id}`);
    unitIdSet.add(String(u.id));
  }

  const bookingIdSet = new Set<string>();
  for (const b of backupData.bookings || []) {
    if (bookingIdSet.has(String(b.id))) errors.push(`معرف حجز مكرر في الحزمة: ${b.id}`);
    bookingIdSet.add(String(b.id));
  }

  const leaseIdSet = new Set<string>();
  for (const l of backupData.leases || []) {
    if (leaseIdSet.has(String(l.id))) errors.push(`معرف عقد مكرر في الحزمة: ${l.id}`);
    leaseIdSet.add(String(l.id));
  }

  const depositIdSet = new Set<string>();
  for (const d of backupData.securityDeposits || []) {
    if (depositIdSet.has(String(d.id))) errors.push(`معرف تأمين مكرر في الحزمة: ${d.id}`);
    depositIdSet.add(String(d.id));
  }

  const installmentIdSet = new Set<string>();
  for (const inst of backupData.installments || []) {
    if (installmentIdSet.has(String(inst.id))) errors.push(`معرف قسط مكرر في الحزمة: ${inst.id}`);
    installmentIdSet.add(String(inst.id));
  }

  const expenseIdSet = new Set<string>((backupData.expenses || []).map((e: any) => String(e.id)));

  type BackupInstallment = { id: string; leaseId: string };
  type BackupDeposit = { id: string; leaseId: string | null; bookingId: string | null };

  const installmentsById = new Map<string, BackupInstallment>(
    (backupData.installments || []).map((item: BackupInstallment) => [item.id, item])
  );

  const depositsById = new Map<string, BackupDeposit>(
    (backupData.securityDeposits || []).map((item: BackupDeposit) => [item.id, item])
  );

  for (const f of backupData.floors || []) {
    if (f.propertyId && !propIdSet.has(String(f.propertyId))) {
      errors.push(`علاقة غير متطابقة: الطابق ${f.id} يشير إلى مبنى غير موجود (${f.propertyId}).`);
    }
  }

  for (const u of backupData.units || []) {
    if (u.propertyId && !propIdSet.has(String(u.propertyId))) {
      errors.push(`علاقة غير متطابقة: الوحدة ${u.id} تشير إلى مبنى غير موجود (${u.propertyId}).`);
    }
  }

  for (const b of backupData.bookings || []) {
    if (b.unitId && !unitIdSet.has(String(b.unitId))) {
      errors.push(`علاقة غير متطابقة: الحجز ${b.id} يشير إلى وحدة غير موجودة (${b.unitId}).`);
    }
  }

  for (const l of backupData.leases || []) {
    if (l.unitId && !unitIdSet.has(String(l.unitId))) {
      errors.push(`علاقة غير متطابقة: العقد ${l.id} يشير إلى وحدة غير موجودة (${l.unitId}).`);
    }
  }

  for (const inst of backupData.installments || []) {
    if (inst.leaseId && !leaseIdSet.has(String(inst.leaseId))) {
      errors.push(`علاقة غير متطابقة: القسط ${inst.id} يشير إلى عقد غير موجود (${inst.leaseId}).`);
    }
  }

  for (const sd of backupData.securityDeposits || []) {
    if (sd.bookingId && !bookingIdSet.has(String(sd.bookingId))) {
      errors.push(`علاقة غير متطابقة: التأمين ${sd.id} يشير إلى حجز غير موجود (${sd.bookingId}).`);
    }
    if (sd.leaseId && !leaseIdSet.has(String(sd.leaseId))) {
      errors.push(`علاقة غير متطابقة: التأمين ${sd.id} يشير إلى عقد غير موجود (${sd.leaseId}).`);
    }

    for (const field of [
      'collectedAmount',
      'collectionReference',
      'collectionVerifiedAt',
      'refundedAmount',
      'deductedAmount',
      'rentAppliedAmount',
    ]) {
      if (!Object.prototype.hasOwnProperty.call(sd, field)) {
        errors.push(`التأمين ${sd.id}: الحقل ${field} مفقود.`);
      }
    }

    const parseAmount = (value: unknown, fieldName: string): Decimal => {
      if (
        !['string', 'number'].includes(typeof value) ||
        !/^\d{1,10}(?:\.\d{1,2})?$/.test(String(value))
      ) {
        errors.push(`التأمين ${sd.id}: حقل ${fieldName} يحتوي على مبلغ غير صالح (${value}).`);
        return new Decimal(0);
      }
      return new Decimal(String(value));
    };

    if (
      Object.prototype.hasOwnProperty.call(sd, 'collectedAmount') &&
      Object.prototype.hasOwnProperty.call(sd, 'refundedAmount') &&
      Object.prototype.hasOwnProperty.call(sd, 'deductedAmount') &&
      Object.prototype.hasOwnProperty.call(sd, 'rentAppliedAmount')
    ) {
      const collected = parseAmount(sd.collectedAmount, 'collectedAmount');
      const refunded = parseAmount(sd.refundedAmount, 'refundedAmount');
      const deducted = parseAmount(sd.deductedAmount, 'deductedAmount');
      const rentApplied = parseAmount(sd.rentAppliedAmount, 'rentAppliedAmount');

      if (refunded.plus(deducted).plus(rentApplied).gt(collected)) {
        errors.push(`التأمين ${sd.id}: مجموع الحركات والتسويات يتجاوز التحصيل.`);
      }

      if (collected.gt(0)) {
        const validReference =
          typeof sd.collectionReference === 'string' &&
          sd.collectionReference.trim().length > 0;

        const validDate =
          typeof sd.collectionVerifiedAt === 'string' &&
          Number.isFinite(Date.parse(sd.collectionVerifiedAt));

        if (!validReference || !validDate) {
          errors.push(`التأمين ${sd.id}: إثبات التحصيل ناقص.`);
        }
      }

      // Check transaction sums matching rentAppliedAmount always (even if empty)
      const settlementMovements = (backupData.securityDepositTransactions || []).filter(
        (movement: any) =>
          movement.depositId === sd.id &&
          movement.type === 'rent_application' &&
          movement.status === 'completed'
      );

      let settlementTotal = new Decimal(0);
      let settlementAmountsValid = true;

      for (const movement of settlementMovements) {
        const value = movement.amount;
        if (
          !['string', 'number'].includes(typeof value) ||
          !/^\d{1,10}(?:\.\d{1,2})?$/.test(String(value))
        ) {
          errors.push(`حركة التسوية ${movement.id}: مبلغ غير صالح.`);
          settlementAmountsValid = false;
          continue;
        }
        const amount = new Decimal(String(value));
        if (amount.lte(0)) {
          errors.push(`حركة التسوية ${movement.id}: المبلغ يجب أن يكون موجباً.`);
          settlementAmountsValid = false;
          continue;
        }
        settlementTotal = settlementTotal.plus(amount);
      }

      if (settlementAmountsValid && !settlementTotal.eq(rentApplied)) {
        errors.push(
          `التأمين ${sd.id}: مجموع التسويات ${settlementTotal.toFixed(2)} لا يطابق الرصيد المستخدم للإيجار ${rentApplied.toFixed(2)}.`
        );
      }
    }
  }

  for (const movement of backupData.securityDepositTransactions || []) {
    if (movement.depositId && !depositIdSet.has(String(movement.depositId))) {
      errors.push(`علاقة غير متطابقة: حركة التأمين ${movement.id} تشير إلى سجل تأمين غير موجود (${movement.depositId}).`);
    }

    if (movement.targetInstallmentId) {
      const installment = installmentsById.get(movement.targetInstallmentId);
      if (!installment) {
        errors.push(`الحركة ${movement.id}: القسط المستهدف غير موجود (${movement.targetInstallmentId}).`);
      } else if (installment.leaseId !== movement.targetLeaseId) {
        errors.push(`الحركة ${movement.id}: القسط لا يتبع العقد المستهدف (${movement.targetLeaseId}).`);
      }
    }

    if (movement.type === 'rent_application') {
      const deposit = depositsById.get(movement.depositId);
      if (
        !movement.targetLeaseId ||
        !movement.targetInstallmentId ||
        !deposit?.leaseId ||
        deposit.bookingId ||
        deposit.leaseId !== movement.targetLeaseId
      ) {
        errors.push(`الحركة ${movement.id}: ارتباطات تسوية التأمين غير متسقة.`);
      }
    }

    if (
      typeof movement.reference !== 'string' ||
      !movement.reference.trim()
    ) {
      errors.push(`الحركة ${movement.id}: مرجع الإثبات مفقود.`);
    }

    for (const field of ['targetLeaseId', 'targetInstallmentId']) {
      if (!Object.prototype.hasOwnProperty.call(movement, field)) {
        errors.push(`حركة التأمين ${movement.id}: الحقل ${field} مفقود.`);
      }
    }
  }

  for (const pay of backupData.payments || []) {
    if (pay.bookingId && !bookingIdSet.has(String(pay.bookingId))) {
      errors.push(`علاقة غير متطابقة: الدفعة ${pay.id} تشير إلى حجز غير موجود (${pay.bookingId}).`);
    }
    if (pay.leaseId && !leaseIdSet.has(String(pay.leaseId))) {
      errors.push(`علاقة غير متطابقة: الدفعة ${pay.id} تشير إلى عقد غير موجود (${pay.leaseId}).`);
    }

    if (pay.installmentId) {
      const installment = installmentsById.get(pay.installmentId);
      if (!installment) {
        errors.push(`السداد ${pay.id}: القسط المرتبط غير موجود (${pay.installmentId}).`);
      } else if (installment.leaseId !== pay.leaseId) {
        errors.push(`السداد ${pay.id}: القسط لا يتبع عقد السداد (${pay.leaseId}).`);
      }
    }

    for (const field of ['installmentId', 'sourceType', 'affectsCash']) {
      if (!Object.prototype.hasOwnProperty.call(pay, field)) {
        errors.push(`السداد ${pay.id}: الحقل ${field} مفقود.`);
      }
    }

    if (typeof pay.affectsCash !== 'boolean') {
      errors.push(`السداد ${pay.id}: affectsCash يجب أن يكون منطقياً (boolean).`);
    }

    if (
      pay.sourceType === 'deposit_application' &&
      (
        pay.affectsCash !== false ||
        pay.paymentMethod !== 'security_deposit' ||
        !pay.installmentId
      )
    ) {
      errors.push(`السداد ${pay.id}: تسوية التأمين غير متسقة (affectsCash=${pay.affectsCash}, method=${pay.paymentMethod}, installmentId=${pay.installmentId}).`);
    }
  }

  for (const ea of backupData.expenseAllocations || []) {
    if (ea.expenseId && !expenseIdSet.has(String(ea.expenseId))) {
      errors.push(`علاقة غير متطابقة: توزيع المصروف ${ea.id} يشير إلى مصروف غير موجود (${ea.expenseId}).`);
    }
  }

  for (const ep of backupData.expensePayments || []) {
    if (ep.expenseId && !expenseIdSet.has(String(ep.expenseId))) {
      errors.push(`علاقة غير متطابقة: سداد المصروف ${ep.id} يشير إلى مصروف غير موجود (${ep.expenseId}).`);
    }
  }

  return { isValid: errors.length === 0, errors };
}

export async function restoreFullDatabaseInDb(backupData: any) {
  if (!process.env.DATABASE_URL) return null;

  // Pre-restoration strict validation across all collections and relations
  const validation = validateBackupPackageIntegrity(backupData);
  if (!validation.isValid) {
    const combinedMessage = validation.errors.join(' | ');
    throw new Error(`تم رفض استعادة النسخة الاحتياطية قبل بدء أي حذف حفاظاً على البيانات: ${combinedMessage}`);
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Clean existing records in reverse dependency order
    await tx.idempotencyRecord.deleteMany();
    await tx.documentRecord.deleteMany();
    await tx.securityDepositTransaction.deleteMany();
    await tx.paymentRecord.deleteMany();
    await tx.securityDepositRecord.deleteMany();
    await tx.leaseInstallment.deleteMany();
    await tx.expensePaymentEntry.deleteMany();
    await tx.expenseAllocation.deleteMany();
    await tx.operationalExpense.deleteMany();
    await tx.recurringExpenseSchedule.deleteMany();
    await tx.expenseCategoryConfig.deleteMany();
    await tx.tenantAdjustment.deleteMany();
    await tx.lease.deleteMany();
    await tx.booking.deleteMany();
    await tx.unitAllocation.deleteMany();
    await tx.parkingSpot.deleteMany();
    await tx.unit.deleteMany();
    await tx.floor.deleteMany();
    await tx.property.deleteMany();
    await tx.amenity.deleteMany();
    await tx.contentSection.deleteMany();
    await tx.auditLog.deleteMany();
    if (Array.isArray(backupData.users) && backupData.users.length > 0) {
      await tx.user.deleteMany();
    }

    // 2. Restore in strict dependency order

    // 2.1 Users
    if (Array.isArray(backupData.users)) {
      for (const u of backupData.users) {
        await tx.user.create({
          data: {
            id: u.id,
            username: u.username,
            email: u.email,
            passwordHash: u.passwordHash,
            name: u.name,
            phone: u.phone ?? null,
            role: u.role as any,
            allowedProperties: Array.isArray(u.allowedProperties) ? u.allowedProperties : ['all'],
            isActive: u.isActive !== false,
            createdAt: u.createdAt ? new Date(u.createdAt) : new Date()
          }
        });
      }
    }

    // 2.2 Company Settings
    if (backupData.settings) {
      const s = backupData.settings;
      await tx.companySettings.upsert({
        where: { id: s.id || 'default' },
        update: {
          companyName: s.companyName,
          companyNameEn: s.companyNameEn,
          tagline: s.tagline,
          logoUrl: s.logoUrl,
          phone: s.phone,
          whatsapp: s.whatsapp,
          email: s.email,
          crNumber: s.crNumber,
          taxNumber: s.taxNumber,
          nationalAddress: s.nationalAddress,
          checkInTime: s.checkInTime,
          checkOutTime: s.checkOutTime,
          navigation: s.navigation ?? null,
          themeConfig: s.themeConfig ?? null
        },
        create: {
          id: s.id || 'default',
          companyName: s.companyName || 'Luxury Home',
          companyNameEn: s.companyNameEn || 'Luxury Home',
          tagline: s.tagline || '',
          logoUrl: s.logoUrl,
          phone: s.phone || '',
          whatsapp: s.whatsapp || '',
          email: s.email || '',
          crNumber: s.crNumber || '',
          taxNumber: s.taxNumber || '',
          nationalAddress: s.nationalAddress || '',
          checkInTime: s.checkInTime || '15:00',
          checkOutTime: s.checkOutTime || '12:00',
          navigation: s.navigation ?? null,
          themeConfig: s.themeConfig ?? null
        }
      });
    }

    // 2.3 Properties
    if (Array.isArray(backupData.properties)) {
      for (const p of backupData.properties) {
        await tx.property.create({
          data: {
            id: p.id,
            name: p.name,
            code: p.code,
            address: p.address,
            city: p.city || 'الرياض',
            district: p.district,
            floorsCount: p.floorsCount !== undefined ? Number(p.floorsCount) : 1,
            unitsCount: p.unitsCount !== undefined ? Number(p.unitsCount) : 0,
            totalAreaSqm: p.totalAreaSqm !== undefined ? Number(p.totalAreaSqm) : 0,
            rooftopPayment: new Decimal(p.rooftopPayment ?? 0),
            description: p.description ?? null,
            images: Array.isArray(p.images) ? p.images : [],
            isActive: p.isActive !== false,
            createdAt: p.createdAt ? new Date(p.createdAt) : new Date()
          }
        });
      }
    }

    // 2.4 Floors
    if (Array.isArray(backupData.floors)) {
      for (const f of backupData.floors) {
        await tx.floor.create({
          data: {
            id: f.id,
            propertyId: f.propertyId,
            number: f.number ?? f.floorNumber ?? 1,
            name: f.name || `الطابق ${f.number || 1}`
          }
        });
      }
    }

    // 2.5 Amenities
    if (Array.isArray(backupData.amenities)) {
      for (const a of backupData.amenities) {
        await tx.amenity.create({
          data: {
            id: a.id,
            name: a.name,
            nameEn: a.nameEn || a.name,
            icon: a.icon || 'star',
            category: a.category || 'general'
          }
        });
      }
    }

    // 2.6 Units
    if (Array.isArray(backupData.units)) {
      for (const u of backupData.units) {
        await tx.unit.create({
          data: {
            id: u.id,
            propertyId: u.propertyId,
            floorId: u.floorId ?? null,
            unitNumber: String(u.unitNumber).trim(),
            title: u.title || '',
            titleEn: u.titleEn || '',
            type: u.type || 'apartment',
            areaSqm: u.areaSqm !== undefined && u.areaSqm !== null ? Number(u.areaSqm) : 0,
            floorNumber: u.floorNumber !== undefined && u.floorNumber !== null ? Number(u.floorNumber) : 1,
            maxGuests: u.maxGuests !== undefined && u.maxGuests !== null ? Number(u.maxGuests) : 3,
            bedroomsCount: u.bedroomsCount !== undefined && u.bedroomsCount !== null ? Number(u.bedroomsCount) : 1,
            bathroomsCount: u.bathroomsCount !== undefined && u.bathroomsCount !== null ? Number(u.bathroomsCount) : 1,
            bedsCount: u.bedsCount !== undefined && u.bedsCount !== null ? Number(u.bedsCount) : 1,
            furnishingStatus: u.furnishingStatus || 'furnished',
            allowDaily: u.allowDaily !== false,
            dailyRate: new Decimal(u.dailyRate ?? 0),
            dailySecurityDeposit: new Decimal(u.dailySecurityDeposit ?? 0),
            allowMonthly: u.allowMonthly !== false,
            monthlyRate: new Decimal(u.monthlyRate ?? 0),
            monthlySecurityDeposit: new Decimal(u.monthlySecurityDeposit ?? 0),
            allowYearly: u.allowYearly !== false,
            annualRate: new Decimal(u.annualRate ?? u.yearlyRate ?? 0),
            yearlySecurityDeposit: new Decimal(u.yearlySecurityDeposit ?? 0),
            yearlyPaymentOptions: Array.isArray(u.yearlyPaymentOptions) ? u.yearlyPaymentOptions : ['single_annual', 'semi_annual'],
            semiAnnualSurchargePercent: new Decimal(u.semiAnnualSurchargePercent ?? 0),
            cleaningFee: new Decimal(u.cleaningFee ?? 0),
            securityDeposit: new Decimal(u.securityDeposit ?? 0),
            taxPercentage: new Decimal(u.taxPercentage ?? 15),
            operationalStatus: u.operationalStatus || 'ready',
            occupancyStatus: u.occupancyStatus || 'vacant',
            isClean: u.isClean !== false,
            publicationStatus: u.publicationStatus || 'published',
            amenities: Array.isArray(u.amenities) ? u.amenities : [],
            images: Array.isArray(u.images) ? u.images : [],
            media: u.media ?? null,
            spaces: u.spaces ?? null,
            fittings: u.fittings ?? null,
            floorPlanUrl: u.floorPlanUrl ?? null,
            assignedParkingId: u.assignedParkingId ?? null,
            notes: u.notes ?? null,
            smartLockPin: u.smartLockPin ?? null,
            createdAt: u.createdAt ? new Date(u.createdAt) : new Date()
          }
        });
      }
    }

    // 2.7 Parking Spots
    if (Array.isArray(backupData.parkingSpots)) {
      for (const ps of backupData.parkingSpots) {
        await tx.parkingSpot.create({
          data: {
            id: ps.id,
            propertyId: ps.propertyId,
            spotNumber: ps.spotNumber,
            floor: ps.floor || 'G',
            hasEVCharger: Boolean(ps.hasEVCharger),
            status: ps.status || 'vacant',
            assignedUnitId: ps.assignedUnitId ?? null
          }
        });
      }
    }

    // 2.8 Allocations
    if (Array.isArray(backupData.allocations)) {
      for (const a of backupData.allocations) {
        await tx.unitAllocation.create({
          data: {
            id: a.id,
            unitId: a.unitId,
            startDate: new Date(a.startDate),
            endDate: new Date(a.endDate),
            rentalType: (a.rentalType || 'daily').toUpperCase() as any,
            referenceId: a.referenceId ?? null,
            purpose: a.purpose || 'booking',
            status: a.status || 'active',
            notes: a.notes ?? null,
            createdAt: a.createdAt ? new Date(a.createdAt) : new Date()
          }
        });
      }
    }

    // 2.9 Bookings
    if (Array.isArray(backupData.bookings)) {
      for (const b of backupData.bookings) {
        await tx.booking.create({
          data: {
            id: b.id,
            bookingNumber: b.bookingNumber || b.id,
            idempotencyKey: b.idempotencyKey ?? null,
            unitId: b.unitId,
            guestName: b.guestName || 'نزيل',
            guestPhone: b.guestPhone || '+966500000000',
            guestEmail: b.guestEmail ?? null,
            guestIdNumber: b.guestIdNumber ?? null,
            userId: b.userId ?? null,
            startDate: new Date(b.startDate || b.checkIn),
            endDate: new Date(b.endDate || b.checkOut),
            rentalType: (b.rentalType || 'daily').toUpperCase() as any,
            totalNights: b.totalNights !== undefined ? Number(b.totalNights) : 1,
            guestsCount: b.guestsCount !== undefined ? Number(b.guestsCount) : 1,
            nightlyRate: new Decimal(b.nightlyRate ?? 0),
            subtotal: new Decimal(b.subtotal ?? 0),
            cleaningFee: new Decimal(b.cleaningFee ?? 0),
            taxes: new Decimal(b.taxes ?? 0),
            securityDeposit: new Decimal(b.securityDeposit ?? 0),
            totalAmount: new Decimal(b.totalAmount ?? 0),
            paidAmount: new Decimal(b.paidAmount ?? 0),
            status: (b.status || 'confirmed').toUpperCase() as any,
            paymentStatus: b.paymentStatus || 'pending',
            identityStatus: b.identityStatus || 'verified',
            smartLockPin: b.smartLockPin ?? null,
            notes: b.notes ?? null,
            createdAt: b.createdAt ? new Date(b.createdAt) : new Date()
          }
        });
      }
    }

    // 2.10 Leases
    if (Array.isArray(backupData.leases)) {
      for (const l of backupData.leases) {
        await tx.lease.create({
          data: {
            id: l.id,
            contractNumber: l.contractNumber || l.id,
            idempotencyKey: l.idempotencyKey ?? null,
            unitId: l.unitId,
            tenantName: l.tenantName || 'مستأجر',
            tenantPhone: l.tenantPhone || '+966500000000',
            tenantEmail: l.tenantEmail ?? null,
            tenantIdNumber: l.tenantIdNumber || '1000000000',
            startDate: new Date(l.startDate),
            endDate: new Date(l.endDate),
            rentalType: (l.rentalType || 'annual').toUpperCase() as any,
            annualRent: new Decimal(l.annualRent ?? 0),
            paymentOption: l.paymentOption || '1_payment',
            paymentFrequency: l.paymentFrequency || '1_payment',
            installmentsCount: l.installmentsCount !== undefined ? Number(l.installmentsCount) : 1,
            securityDeposit: new Decimal(l.securityDeposit ?? 0),
            contractServices: l.contractServices ?? null,
            includedAmenities: Array.isArray(l.includedAmenities) ? l.includedAmenities : [],
            termsConditions: l.termsConditions ?? null,
            status: (l.status || 'active').toUpperCase() as any,
            pdfUrl: l.pdfUrl ?? null,
            createdAt: l.createdAt ? new Date(l.createdAt) : new Date()
          }
        });
      }
    }

    // 2.11 Lease Installments
    if (Array.isArray(backupData.installments)) {
      for (const inst of backupData.installments) {
        await tx.leaseInstallment.create({
          data: {
            id: inst.id,
            leaseId: inst.leaseId,
            number: Number(inst.number || 1),
            label: inst.label ?? null,
            dueDate: new Date(inst.dueDate),
            amount: new Decimal(inst.amount ?? 0),
            paidAmount: new Decimal(inst.paidAmount ?? 0),
            remainingAmount: new Decimal(inst.remainingAmount ?? inst.amount ?? 0),
            status: (inst.status || 'UPCOMING').toUpperCase() as any,
            paidAt: inst.paidAt ? new Date(inst.paidAt) : null
          }
        });
      }
    }

    // 2.12 Security Deposits
    if (Array.isArray(backupData.securityDeposits)) {
      for (const sd of backupData.securityDeposits) {
        await tx.securityDepositRecord.create({
          data: {
            id: sd.id,
            leaseId: sd.leaseId ?? null,
            bookingId: sd.bookingId ?? null,
            amount: new Decimal(sd.amount ?? 0),
            collectedAmount: new Decimal(sd.collectedAmount ?? 0),
            collectionReference: sd.collectionReference ?? null,
            collectionVerifiedAt: sd.collectionVerifiedAt ? new Date(sd.collectionVerifiedAt) : null,
            status: sd.status || 'held',
            deductedAmount: new Decimal(sd.deductedAmount ?? 0),
            refundedAmount: new Decimal(sd.refundedAmount ?? 0),
            rentAppliedAmount: new Decimal(sd.rentAppliedAmount ?? 0),
            deductionReason: sd.deductionReason ?? null,
            refundMethod: sd.refundMethod ?? null,
            refundReference: sd.refundReference ?? null,
            refundType: sd.refundType ?? null,
            refundedByUserId: sd.refundedByUserId ?? null,
            refundedAt: sd.refundedAt ? new Date(sd.refundedAt) : null,
            notes: sd.notes ?? null,
            createdAt: sd.createdAt ? new Date(sd.createdAt) : new Date()
          }
        });
      }
    }

    // 2.13 Security Deposit Transactions (Itemized Ledger)
    if (Array.isArray(backupData.securityDepositTransactions)) {
      for (const sdt of backupData.securityDepositTransactions) {
        await tx.securityDepositTransaction.create({
          data: {
            id: sdt.id,
            depositId: sdt.depositId,
            type: sdt.type || 'refund',
            amount: new Decimal(sdt.amount ?? 0),
            method: sdt.method || 'bank_transfer',
            reference: sdt.reference,
            reason: sdt.reason ?? null,
            targetLeaseId: sdt.targetLeaseId ?? null,
            targetInstallmentId: sdt.targetInstallmentId ?? null,
            executedByUserId: sdt.executedByUserId ?? null,
            executedAt: sdt.executedAt ? new Date(sdt.executedAt) : new Date(),
            status: sdt.status || 'completed',
            idempotencyKey: sdt.idempotencyKey ?? null,
            notes: sdt.notes ?? null,
            createdAt: sdt.createdAt ? new Date(sdt.createdAt) : new Date()
          }
        });
      }
    }

    // 2.14 Payment Records
    if (Array.isArray(backupData.payments)) {
      for (const pay of backupData.payments) {
        await tx.paymentRecord.create({
          data: {
            id: pay.id,
            bookingId: pay.bookingId ?? null,
            leaseId: pay.leaseId ?? null,
            installmentId: pay.installmentId ?? null,
            amount: new Decimal(pay.amount ?? 0),
            paymentMethod: pay.paymentMethod || 'mada',
            sourceType: pay.sourceType ?? 'direct_payment',
            affectsCash: pay.affectsCash !== false,
            receiptNo: pay.receiptNo ?? null,
            referenceNo: pay.referenceNo ?? null,
            status: pay.status || 'completed',
            isVerified: pay.isVerified !== false,
            paidAt: pay.paidAt ? new Date(pay.paidAt) : new Date(),
            notes: pay.notes ?? null
          }
        });
      }
    }

    // 2.15 Category Configs
    if (Array.isArray(backupData.expenseCategories)) {
      for (const ec of backupData.expenseCategories) {
        await tx.expenseCategoryConfig.create({
          data: {
            id: ec.id,
            code: ec.code,
            nameAr: ec.nameAr,
            nameEn: ec.nameEn || ec.nameAr,
            costCenterLevel: (ec.costCenterLevel || 'PROPERTY').toUpperCase() as any,
            temporalDistribution: (ec.temporalDistribution || 'NONE').toUpperCase() as any,
            defaultAllocationMethod: (ec.defaultAllocationMethod || 'EQUAL_UNITS').toUpperCase() as any,
            subcategories: Array.isArray(ec.subcategories) ? ec.subcategories : [],
            isActive: ec.isActive !== false
          }
        });
      }
    }

    // 2.16 Expenses
    if (Array.isArray(backupData.expenses)) {
      for (const exp of backupData.expenses) {
        await tx.operationalExpense.create({
          data: {
            id: exp.id,
            expenseNumber: exp.expenseNumber || exp.id,
            title: exp.title || 'مصروف',
            amount: new Decimal(exp.amount ?? 0),
            costCenterLevel: (exp.costCenterLevel || 'PROPERTY').toUpperCase() as any,
            propertyId: exp.propertyId ?? null,
            unitId: exp.unitId ?? null,
            categoryCode: (exp.categoryCode || 'OPERATIONS_OTHER') as any,
            subcategory: exp.subcategory ?? null,
            expenseDate: exp.expenseDate ? new Date(exp.expenseDate) : new Date(),
            startDate: exp.startDate ? new Date(exp.startDate) : new Date(),
            endDate: exp.endDate ? new Date(exp.endDate) : new Date(),
            temporalType: (exp.temporalType || 'NONE').toUpperCase() as any,
            allocationMethod: (exp.allocationMethod || 'EQUAL_UNITS').toUpperCase() as any,
            status: exp.status || 'approved',
            isCapitalAsset: Boolean(exp.isCapitalAsset),
            notes: exp.notes ?? null,
            createdById: exp.createdById ?? null,
            createdAt: exp.createdAt ? new Date(exp.createdAt) : new Date()
          }
        });
      }
    }

    // 2.17 Expense Allocations
    if (Array.isArray(backupData.expenseAllocations)) {
      for (const ea of backupData.expenseAllocations) {
        await tx.expenseAllocation.create({
          data: {
            id: ea.id,
            expenseId: ea.expenseId,
            unitId: ea.unitId,
            shareAmount: new Decimal(ea.shareAmount ?? 0),
            percentage: Number(ea.percentage ?? 0),
            monthPeriod: ea.monthPeriod || '2026-10'
          }
        });
      }
    }

    // 2.18 Expense Payment Entries
    if (Array.isArray(backupData.expensePayments)) {
      for (const ep of backupData.expensePayments) {
        await tx.expensePaymentEntry.create({
          data: {
            id: ep.id,
            expenseId: ep.expenseId,
            amount: new Decimal(ep.amount ?? 0),
            paymentDate: ep.paymentDate ? new Date(ep.paymentDate) : new Date(),
            paymentMethod: ep.paymentMethod || 'bank_transfer',
            referenceNo: ep.referenceNo ?? null,
            notes: ep.notes ?? null
          }
        });
      }
    }

    // 2.19 Recurring Schedules
    if (Array.isArray(backupData.recurringSchedules)) {
      for (const rs of backupData.recurringSchedules) {
        await tx.recurringExpenseSchedule.create({
          data: {
            id: rs.id,
            title: rs.title,
            categoryCode: rs.categoryCode as any,
            amount: new Decimal(rs.amount ?? 0),
            propertyId: rs.propertyId ?? null,
            unitId: rs.unitId ?? null,
            frequency: rs.frequency || 'monthly',
            nextDueDate: new Date(rs.nextDueDate),
            isActive: rs.isActive !== false
          }
        });
      }
    }

    // 2.20 Tenant Adjustments
    if (Array.isArray(backupData.tenantAdjustments)) {
      for (const ta of backupData.tenantAdjustments) {
        await tx.tenantAdjustment.create({
          data: {
            id: ta.id,
            tenantName: ta.tenantName,
            unitNumber: ta.unitNumber,
            type: ta.type || 'discount',
            amount: new Decimal(ta.amount ?? 0),
            reason: ta.reason || 'تسوية',
            date: ta.date ? new Date(ta.date) : new Date(),
            approvedBy: ta.approvedBy || 'المسؤول'
          }
        });
      }
    }

    // 2.21 Content Sections
    if (Array.isArray(backupData.contentSections)) {
      for (const cs of backupData.contentSections) {
        await tx.contentSection.create({
          data: {
            id: cs.id,
            title: cs.title,
            subtitle: cs.subtitle ?? null,
            enabled: cs.enabled !== false,
            order: Number(cs.order || 0),
            config: cs.config ?? null
          }
        });
      }
    }

    // 2.22 Document Records
    if (Array.isArray(backupData.documentRecords)) {
      for (const d of backupData.documentRecords) {
        await tx.documentRecord.create({
          data: {
            id: d.id,
            fileName: d.fileName,
            originalName: d.originalName || d.fileName,
            fileSize: Number(d.fileSize || 0),
            mimeType: d.mimeType ?? null,
            isPrivate: d.isPrivate !== false,
            ownerUserId: d.ownerUserId ?? null,
            propertyId: d.propertyId ?? null,
            unitId: d.unitId ?? null,
            bookingId: d.bookingId ?? null,
            leaseId: d.leaseId ?? null,
            notes: d.notes ?? null,
            createdAt: d.createdAt ? new Date(d.createdAt) : new Date()
          }
        });
      }
    }

    // 2.23 Idempotency Records
    if (Array.isArray(backupData.idempotencyRecords)) {
      for (const ir of backupData.idempotencyRecords) {
        await tx.idempotencyRecord.create({
          data: {
            id: ir.id,
            key: ir.key,
            operationType: ir.operationType,
            userId: ir.userId ?? null,
            requestHash: ir.requestHash,
            statusCode: Number(ir.statusCode || 200),
            responseBody: ir.responseBody,
            createdAt: ir.createdAt ? new Date(ir.createdAt) : new Date()
          }
        });
      }
    }

    // 2.24 Audit Logs
    if (Array.isArray(backupData.auditLogs)) {
      for (const a of backupData.auditLogs) {
        await tx.auditLog.create({
          data: {
            id: a.id,
            userId: a.userId ?? null,
            userName: a.userName || 'المستخدم',
            action: a.action || 'إجراء',
            module: a.module || 'عام',
            details: a.details || '',
            ipAddress: a.ipAddress ?? null,
            createdAt: a.createdAt ? new Date(a.createdAt) : new Date()
          }
        });
      }
    }

    return {
      usersRestored: backupData.users?.length || 0,
      propertiesRestored: backupData.properties?.length || 0,
      floorsRestored: backupData.floors?.length || 0,
      amenitiesRestored: backupData.amenities?.length || 0,
      unitsRestored: backupData.units?.length || 0,
      parkingSpotsRestored: backupData.parkingSpots?.length || 0,
      allocationsRestored: backupData.allocations?.length || 0,
      bookingsRestored: backupData.bookings?.length || 0,
      leasesRestored: backupData.leases?.length || 0,
      installmentsRestored: backupData.installments?.length || 0,
      securityDepositsRestored: backupData.securityDeposits?.length || 0,
      securityDepositTransactionsRestored: backupData.securityDepositTransactions?.length || 0,
      paymentsRestored: backupData.payments?.length || 0,
      expensesRestored: backupData.expenses?.length || 0,
      expenseAllocationsRestored: backupData.expenseAllocations?.length || 0,
      expensePaymentsRestored: backupData.expensePayments?.length || 0,
      documentRecordsRestored: backupData.documentRecords?.length || 0,
      idempotencyRecordsRestored: backupData.idempotencyRecords?.length || 0,
      auditLogsRestored: backupData.auditLogs?.length || 0
    };
  });
}
