import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from './db.js';
import crypto from 'crypto';
import { RentalType, BookingStatus, LeaseStatus, InstallmentStatus } from '@prisma/client';
import { serializeDecimals } from './repository.js';
import { refundDeposit } from './depositRefundService.js';

export interface DailyBookingInput {
  unitId: string;
  checkIn: string;   // YYYY-MM-DD
  checkOut: string;  // YYYY-MM-DD
  guestsCount?: number;
  guestName: string;
  guestPhone: string;
  guestEmail?: string;
  guestIdNumber?: string;
  notes?: string;
  idempotencyKey?: string;
  totalAmount?: number; // Client request value (server will validate and override with authoritative calculation)
}

export interface LeaseContractInput {
  unitId: string;
  rentalType: 'monthly' | 'annual';
  startDate: string; // YYYY-MM-DD
  endDate?: string;  // If omitted, computed automatically based on type/duration
  durationMonths?: number; // For monthly (e.g. 1, 3, 6) or annual (12)
  paymentFrequency: '1_payment' | '2_payments' | '4_payments' | 'monthly';
  tenantName: string;
  tenantPhone: string;
  tenantEmail?: string;
  tenantIdNumber: string;
  contractServices?: any;
  includedAmenities?: string[];
  termsConditions?: string;
  idempotencyKey?: string;
  annualRent?: number; // Client request value (server will validate and override with authoritative calculation)
}

export interface MemoryContext {
  state: any;
  persist: () => void;
}

/**
 * تقسيم مبلغ إلى أقساط دون فروق (المقطع المساعد الرسمي)
 * يضمن توزيع الهللات الزائدة بالتساوي على الأقساط الأولى دون فقد أو زيادة هللة واحدة.
 */
export function splitMoney(
  total: string,
  count: number,
): string[] {
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(total)) {
    throw new Error('المبلغ غير صالح.');
  }

  if (!Number.isInteger(count) || count < 1 || count > 120) {
    throw new Error('عدد الأقساط غير صالح.');
  }

  const [whole, fraction = ''] = total.split('.');
  const cents =
    BigInt(whole) * 100n +
    BigInt(fraction.padEnd(2, '0'));

  const divisor = BigInt(count);
  const base = cents / divisor;
  const remainder = cents % divisor;

  return Array.from({ length: count }, (_, index) => {
    const value = base + (BigInt(index) < remainder ? 1n : 0n);

    return `${value / 100n}.${String(value % 100n).padStart(2, '0')}`;
  });
}

/**
 * حساب التواريخ التقويمية للأشهر مع مراعاة نهايات الأشهر والسنوات الكبيسة
 * دون افتراض أن الشهر 30 يوماً دائماً.
 */
export function addCalendarMonths(baseDate: Date, monthsToAdd: number): Date {
  const d = new Date(baseDate);
  const startDay = d.getUTCDate();

  // الانتقال إلى اليوم الأول من الشهر المستهدف لتفادي الطفح التلقائي
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + monthsToAdd);

  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  // إيجاد الحد الأقصى لأيام الشهر المستهدف (مثلاً 28 أو 29 لفبراير، 30 لأبريل، 31 ليناير)
  const maxDays = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  // تقليص اليوم إذا تجاوز نهاية الشهر (مثلاً 31 يناير + شهر = 28 فبراير)
  d.setUTCDate(Math.min(startDay, maxDays));
  return d;
}

/**
 * حساب نهاية العقد التقويمية الدقيقة (قبل يوم واحد من نفس تاريخ البداية بعد اكتمال المدة)
 */
export function calculateContractEndDate(startDateStr: string, months: number): string {
  const start = new Date(`${startDateStr}T00:00:00.000Z`);
  const target = addCalendarMonths(start, months);
  // خصم يوم واحد لنهاية الفترة التعاقدية الشاملة
  target.setUTCDate(target.getUTCDate() - 1);
  return target.toISOString().slice(0, 10);
}

/**
 * توليد جدول الأقساط الدقيق دون زيادة أو نقص أي هللة
 */
export function generateInstallments(
  totalRent: number | string,
  startDateStr: string,
  frequency: '1_payment' | '2_payments' | '4_payments' | 'monthly',
  durationMonths: number = 12
) {
  let count = 1;
  let intervalMonths = 12;

  if (frequency === '2_payments') {
    count = 2;
    intervalMonths = Math.max(1, Math.floor(durationMonths / 2));
  } else if (frequency === '4_payments') {
    count = 4;
    intervalMonths = Math.max(1, Math.floor(durationMonths / 4));
  } else if (frequency === 'monthly') {
    count = durationMonths;
    intervalMonths = 1;
  }

  const totalNum = typeof totalRent === 'number' ? totalRent : parseFloat(totalRent);
  const totalStr = totalNum.toFixed(2);
  const splitAmounts = splitMoney(totalStr, count);
  const startDate = new Date(`${startDateStr}T00:00:00.000Z`);

  return splitAmounts.map((amountStr, i) => {
    const dueDate = addCalendarMonths(startDate, i * intervalMonths);
    const amountVal = parseFloat(amountStr);

    let label = `الدفعة ${i + 1} من ${count}`;
    if (count === 1) label = 'دفعة العقد الكاملة (دفعة واحدة)';
    else if (count === 2) label = i === 0 ? 'الدفعة الأولى (نصف سنوية)' : 'الدفعة الثانية (نصف سنوية)';
    else if (count === 4) label = `الدفعة ربع السنوية ${i + 1} من 4`;
    else if (frequency === 'monthly') label = `قسط شهر ${i + 1}`;

    return {
      number: i + 1,
      label,
      dueDate: dueDate.toISOString().slice(0, 10),
      amount: amountVal,
      amountFormatted: amountStr,
      paidAmount: 0,
      remainingAmount: amountVal,
      status: 'UPCOMING' as const
    };
  });
}

/**
 * فحص منع التداخل الزمني باستخدام فترات نصف مفتوحة [start, end)
 * يسمح بانتهاء إشغال وبدء آخر عند الحد نفسه وفق سياسة التجهيز (12:00 مغادرة + 3 ساعات نظافة = 15:00 دخول التالي).
 */
export async function checkUnitConflict(
  unitId: string,
  startDateTime: Date,
  endDateTime: Date,
  excludeAllocationId?: string,
  memoryAllocations?: any[]
): Promise<{ hasConflict: boolean; conflictingAllocation?: any }> {
  if (process.env.DATABASE_URL) {
    const allocations = await prisma.unitAllocation.findMany({
      where: {
        unitId,
        status: 'active',
        ...(excludeAllocationId ? { id: { not: excludeAllocationId } } : {}),
        AND: [
          { startDate: { lt: endDateTime } },
          { endDate: { gt: startDateTime } }
        ]
      }
    });

    if (allocations.length > 0) {
      return { hasConflict: true, conflictingAllocation: allocations[0] };
    }
    return { hasConflict: false };
  }

  // Standalone memory check
  const list = memoryAllocations || [];
  const startMs = startDateTime.getTime();
  const endMs = endDateTime.getTime();

  const conflict = list.find((a: any) => {
    if (a.unitId !== unitId) return false;
    if (a.status !== 'active') return false;
    if (excludeAllocationId && a.id === excludeAllocationId) return false;

    const aStartMs = new Date(a.startDate).getTime();
    const aEndMs = new Date(a.endDate).getTime();

    // فترات نصف مفتوحة: [A_start, A_end) تتداخل مع [B_start, B_end) إذا وفقط إذا:
    // A_start < B_end و A_end > B_start
    return (aStartMs < endMs && aEndMs > startMs);
  });

  if (conflict) {
    return { hasConflict: true, conflictingAllocation: conflict };
  }
  return { hasConflict: false };
}

/**
 * معالجة الحجز اليومي الموحد مع القفل الذري وتأكيد السعر المعتمد بالخادم
 */
export async function processDailyReservation(
  input: DailyBookingInput,
  memoryContext?: MemoryContext
) {
  const { unitId, checkIn, checkOut, guestName, guestPhone, guestEmail, guestIdNumber, notes, idempotencyKey } = input;

  if (!unitId || !checkIn || !checkOut) {
    throw new Error('معلومات الحجز غير مكتملة.');
  }

  // التوقيت المعتمد: تسجيل الوصول 15:00، المغادرة 12:00
  const start = new Date(`${checkIn}T15:00:00.000Z`);
  const departureDate = new Date(`${checkOut}T12:00:00.000Z`);

  if (isNaN(start.getTime()) || isNaN(departureDate.getTime()) || start >= departureDate) {
    throw new Error('تواريخ الحجز غير صالحة. يرجى اختيار تاريخ مغادرة بعد تاريخ الوصول.');
  }

  // إضافة نافذة التجهيز والتنظيف الفندقي (3 ساعات حتى 15:00) لتسليم الوحدة للنزيل التالي
  const endWithCleaning = new Date(`${checkOut}T15:00:00.000Z`);

  const diffMs = departureDate.getTime() - start.getTime();
  const totalNights = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));

  if (process.env.DATABASE_URL) {
    return await prisma.$transaction(async (tx) => {
      // 0. Idempotency Check: إذا تكرر المفتاح بالحمل نفسه نعيد النتيجة السابقة
      if (idempotencyKey) {
        const existing = await tx.booking.findUnique({
          where: { idempotencyKey },
          include: { unit: { include: { property: true } } }
        });
        if (existing) {
          return serializeDecimals({
            booking: existing,
            allocation: null,
            totalAmount: Number(existing.totalAmount),
            subtotal: Number(existing.subtotal),
            taxes: Number(existing.taxes),
            cleaningFee: Number(existing.cleaningFee),
            securityDeposit: Number(existing.securityDeposit)
          });
        }
      }

      // 1. استرجاع الوحدة مع قفل سطر لمنع السباق الذري عند الطلبات المتزامنة
      await tx.$executeRaw`SELECT id FROM "Unit" WHERE id = ${unitId} FOR UPDATE`;

      const unit = await tx.unit.findUnique({
        where: { id: unitId },
        include: { property: true }
      });

      if (!unit) {
        throw new Error('الوحدة السكنية غير موجودة.');
      }

      if (unit.operationalStatus === 'blocked' || unit.occupancyStatus === 'blocked') {
        const err: any = new Error('الوحدة السكنية محجوبة إدارياً حالياً.');
        err.statusCode = 409;
        throw err;
      }

      // 2. التحقق الصارم من التداخل الزمني ضد UnitAllocation
      const conflict = await tx.unitAllocation.findFirst({
        where: {
          unitId,
          status: 'active',
          startDate: { lt: endWithCleaning },
          endDate: { gt: start }
        }
      });

      if (conflict) {
        const err: any = new Error('عذراً، هذه الوحدة السكنية محجوزة بالفعل في الفترة المحددة أو في مرحلة التجهيز الفندقي.');
        err.statusCode = 409;
        throw err;
      }

      // 3. الحساب المعتمد للسعر بالخادم حصراً (تجاهل أي سعر مرسل من العميل)
      const nightlyRate = Number(unit.dailyRate) || 850;
      const subtotal = nightlyRate * totalNights;
      const cleaningFee = unit.cleaningFee !== undefined && unit.cleaningFee !== null ? Number(unit.cleaningFee) : 150;
      const taxPercentage = unit.taxPercentage !== undefined && unit.taxPercentage !== null ? Number(unit.taxPercentage) : 15;
      const taxes = Math.round(subtotal * (taxPercentage / 100) * 100) / 100;
      const securityDeposit = Number(unit.securityDeposit) || 500;
      const totalAmount = subtotal + cleaningFee + taxes + securityDeposit;

      const bookingNumber = `LH-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

      // 4. إنشاء سجل الحجز
      const booking = await tx.booking.create({
        data: {
          bookingNumber,
          idempotencyKey: idempotencyKey || null,
          unitId,
          guestName,
          guestPhone,
          guestEmail: guestEmail || null,
          guestIdNumber: guestIdNumber || null,
          startDate: start,
          endDate: departureDate,
          rentalType: RentalType.DAILY,
          totalNights,
          guestsCount: input.guestsCount || 1,
          nightlyRate: new Decimal(nightlyRate),
          subtotal: new Decimal(subtotal),
          cleaningFee: new Decimal(cleaningFee),
          taxes: new Decimal(taxes),
          securityDeposit: new Decimal(securityDeposit),
          totalAmount: new Decimal(totalAmount),
          paidAmount: new Decimal(0),
          status: BookingStatus.CONFIRMED,
          paymentStatus: 'pending',
          identityStatus: 'pending_verification',
          smartLockPin: null,
          notes: notes || null
        }
      });

      // 5. إنشاء التخصيص الزمني في UnitAllocation
      const allocation = await tx.unitAllocation.create({
        data: {
          unitId,
          startDate: start,
          endDate: endWithCleaning,
          rentalType: RentalType.DAILY,
          referenceId: booking.id,
          purpose: 'booking',
          status: 'active',
          notes: `حجز يومي ${bookingNumber} - النزيل: ${guestName}`
        }
      });

      // 6. إنشاء قيد التأمين كحساب مستقل ومحتجز (لا يدخل ضمن إيراد الإيجار)
      await tx.securityDepositRecord.create({
        data: {
          bookingId: booking.id,
          amount: new Decimal(securityDeposit),
          collectedAmount: new Decimal(0),
          collectionReference: null,
          collectionVerifiedAt: null,
          status: 'held',
          notes: `تأمين فندقي مسترد لحجز ${bookingNumber}`
        }
      });

      // تحديث حالة الوحدة إلى مسكونة يومياً
      await tx.unit.update({
        where: { id: unitId },
        data: { occupancyStatus: 'daily_occupied' }
      }).catch(() => {});

      return serializeDecimals({
        booking,
        allocation,
        totalAmount,
        subtotal,
        taxes,
        cleaningFee,
        securityDeposit
      });
    });
  }

  // Standalone Memory Fallback
  const state = memoryContext?.state;
  if (!state) {
    throw new Error('تعذر معالجة الحجز لعدم توفر سياق التخزين.');
  }

  if (!state.bookings) state.bookings = [];
  if (!state.allocations) state.allocations = [];
  if (!state.securityDeposits) state.securityDeposits = [];

  // Idempotency check
  if (idempotencyKey) {
    const existing = state.bookings.find((b: any) => b.idempotencyKey === idempotencyKey);
    if (existing) {
      return {
        booking: existing,
        allocation: state.allocations.find((a: any) => a.referenceId === existing.id) || null,
        totalAmount: existing.totalAmount,
        subtotal: existing.subtotal || existing.totalAmount,
        taxes: existing.taxes || 0,
        cleaningFee: existing.cleaningFee || 0,
        securityDeposit: existing.securityDeposit || 0
      };
    }
  }

  // Find Unit
  const unit = (state.units || []).find((u: any) => u.id === unitId);
  if (!unit) {
    throw new Error('الوحدة السكنية غير موجودة.');
  }

  if (unit.operationalStatus === 'blocked' || unit.occupancyStatus === 'blocked') {
    const err: any = new Error('الوحدة السكنية محجوبة إدارياً حالياً.');
    err.statusCode = 409;
    throw err;
  }

  // Conflict Check
  const conflict = await checkUnitConflict(unitId, start, endWithCleaning, undefined, state.allocations);
  if (conflict.hasConflict) {
    const err: any = new Error('عذراً، هذه الوحدة السكنية محجوزة بالفعل في الفترة المحددة أو في مرحلة التجهيز الفندقي.');
    err.statusCode = 409;
    throw err;
  }

  // Pricing calculation
  const nightlyRate = Number(unit.dailyRate) || 850;
  const subtotal = nightlyRate * totalNights;
  const cleaningFee = unit.cleaningFee !== undefined && unit.cleaningFee !== null ? Number(unit.cleaningFee) : 150;
  const taxPercentage = unit.taxPercentage !== undefined && unit.taxPercentage !== null ? Number(unit.taxPercentage) : 15;
  const taxes = Math.round(subtotal * (taxPercentage / 100) * 100) / 100;
  const securityDeposit = Number(unit.securityDeposit) || 500;
  const totalAmount = subtotal + cleaningFee + taxes + securityDeposit;

  const bookingNumber = `LH-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
  const bookingId = `bk_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;

  const newBooking = {
    id: bookingId,
    bookingNumber,
    idempotencyKey: idempotencyKey || null,
    unitId,
    propertyId: unit.propertyId,
    guestName,
    guestPhone,
    guestEmail: guestEmail || null,
    guestIdNumber: guestIdNumber || null,
    guest: {
      fullName: guestName,
      phone: guestPhone,
      email: guestEmail || '',
      nationalIdOrPassport: guestIdNumber || '',
      idVerified: false
    },
    startDate: start.toISOString(),
    endDate: departureDate.toISOString(),
    checkIn: checkIn,
    checkOut: checkOut,
    rentalType: 'daily',
    totalNights,
    guestsCount: input.guestsCount || 1,
    nightlyRate,
    subtotal,
    cleaningFee,
    taxes,
    securityDeposit,
    totalAmount,
    paidAmount: 0,
    status: 'confirmed',
    paymentStatus: 'pending',
    identityStatus: 'pending_verification',
    smartLockPin: '884210',
    notes: notes || null,
    createdAt: new Date().toISOString()
  };

  const newAllocation = {
    id: `alloc_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`,
    unitId,
    startDate: start.toISOString(),
    endDate: endWithCleaning.toISOString(),
    rentalType: 'DAILY',
    type: 'booking',
    referenceId: bookingId,
    purpose: 'booking',
    status: 'active',
    notes: `حجز يومي ${bookingNumber} - النزيل: ${guestName}`,
    createdAt: new Date().toISOString()
  };

  const newDeposit = {
    id: `sd_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`,
    bookingId: bookingId,
    unitId,
    guestName,
    amount: securityDeposit,
    collectedAmount: 0,
    collectionReference: null,
    collectionVerifiedAt: null,
    status: 'held',
    refundedAmount: 0,
    deductedAmount: 0,
    rentAppliedAmount: 0,
    notes: `تأمين مسترد لحجز ${bookingNumber}`,
    createdAt: new Date().toISOString()
  };

  state.bookings.push(newBooking);
  state.allocations.push(newAllocation);
  state.securityDeposits.push(newDeposit);
  unit.occupancyStatus = 'daily_occupied';

  if (memoryContext.persist) {
    memoryContext.persist();
  }

  return {
    booking: newBooking,
    allocation: newAllocation,
    totalAmount,
    subtotal,
    taxes,
    cleaningFee,
    securityDeposit
  };
}

/**
 * معالجة عقود الإيجار الشهرية والسنوية وتثبيت شروط العقد والأقساط الدقيقة
 */
export async function processLeaseContract(
  input: LeaseContractInput,
  memoryContext?: MemoryContext
) {
  const {
    unitId,
    rentalType,
    startDate,
    paymentFrequency,
    tenantName,
    tenantPhone,
    tenantEmail,
    tenantIdNumber,
    contractServices,
    includedAmenities,
    termsConditions,
    idempotencyKey
  } = input;

  if (!unitId || !startDate || !tenantName || !tenantPhone || !tenantIdNumber) {
    throw new Error('معلومات عقد الإيجار غير مكتملة. يلزم تحديد الوحدة، وتاريخ البداية، واسم ورقم هاتف وهُوية المستأجر.');
  }

  const durationMonths = rentalType === 'monthly' ? (input.durationMonths || 1) : 12;
  const endDate = input.endDate || calculateContractEndDate(startDate, durationMonths);

  const start = new Date(`${startDate}T15:00:00.000Z`);
  const end = new Date(`${endDate}T12:00:00.000Z`);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
    throw new Error('تواريخ العقد غير صالحة.');
  }

  // انتهاء التخصيص الزمني في نهاية يوم التسليم مع مهلة التجهيز
  const endWithBuffer = new Date(`${endDate}T15:00:00.000Z`);

  if (process.env.DATABASE_URL) {
    return await prisma.$transaction(async (tx) => {
      // 0. Idempotency Check
      if (idempotencyKey) {
        const existing = await tx.lease.findUnique({
          where: { idempotencyKey },
          include: { unit: { include: { property: true } }, installments: true }
        });
        if (existing) {
          return serializeDecimals({
            lease: existing,
            allocation: null,
            installments: existing.installments
          });
        }
      }

      // 1. استرجاع الوحدة من قاعدة البيانات مع قفل تشاركي لمنع التسبق
      await tx.$executeRaw`SELECT id FROM "Unit" WHERE id = ${unitId} FOR UPDATE`;

      const unit = await tx.unit.findUnique({
        where: { id: unitId },
        include: { property: true }
      });

      if (!unit) {
        throw new Error('الوحدة السكنية غير موجودة.');
      }

      // 2. التحقق الصارم من التداخل ضد UnitAllocation
      const conflict = await tx.unitAllocation.findFirst({
        where: {
          unitId,
          status: 'active',
          startDate: { lt: endWithBuffer },
          endDate: { gt: start }
        }
      });

      if (conflict) {
        const err: any = new Error('الوحدة السكنية مشغولة بعقد أو حجز آخر خلال الفترة المطلوبة.');
        err.statusCode = 409;
        throw err;
      }

      // 3. احتساب السعر المعتمد بالخادم دون الاعتماد على مدخلات العميل
      const baseAnnualRent = Number(unit.annualRate) || 85000;
      const surchargePercent = (rentalType === 'annual' && paymentFrequency === '2_payments' && unit.semiAnnualSurchargePercent)
        ? Number(unit.semiAnnualSurchargePercent)
        : 0;
      const annualRentRate = baseAnnualRent * (1 + surchargePercent / 100);
      const monthlyRentRate = Number(unit.monthlyRate) || 8500;
      const totalRentForPeriod = rentalType === 'annual'
        ? annualRentRate
        : (monthlyRentRate * durationMonths);

      const installmentsData = generateInstallments(
        totalRentForPeriod,
        startDate,
        paymentFrequency,
        durationMonths
      );

      const contractNumber = `CNT-${rentalType === 'annual' ? 'ANN' : 'MTH'}-${Date.now().toString().slice(-6)}`;
      const securityDeposit = Number(rentalType === 'annual' ? unit.yearlySecurityDeposit : unit.monthlySecurityDeposit) || 2500;

      // 4. تثبيت شروط العقد ومسؤوليات الخدمات ومحضر التسليم وقت الاعتماد (Snapshot)
      const frozenServices = contractServices || {
        responsibilities: {
          electricity: 'tenant',
          water: 'tenant',
          internet: 'company',
          routineMaintenance: 'company',
          misuseMaintenance: 'tenant'
        },
        serviceCaps: {
          electricityMonthlyAllowance: 0,
          waterMonthlyAllowance: 0
        },
        handoverReport: {
          handoverDate: startDate,
          keysCount: 2,
          electricityMeterReading: '0000',
          waterMeterReading: '0000',
          condition: 'ممتازة - جاهزة للسكن'
        },
        unitSnapshot: {
          unitNumber: unit.unitNumber,
          title: unit.title,
          areaSqm: Number(unit.areaSqm),
          floorNumber: unit.floorNumber,
          furnishingStatus: unit.furnishingStatus
        }
      };

      // 5. إنشاء العقد
      const lease = await tx.lease.create({
        data: {
          contractNumber,
          idempotencyKey: idempotencyKey || null,
          unitId,
          tenantName,
          tenantPhone,
          tenantEmail: tenantEmail || null,
          tenantIdNumber,
          startDate: start,
          endDate: end,
          rentalType: rentalType === 'annual' ? RentalType.ANNUAL : RentalType.MONTHLY,
          annualRent: new Decimal(totalRentForPeriod),
          paymentOption: paymentFrequency,
          paymentFrequency,
          installmentsCount: installmentsData.length,
          securityDeposit: new Decimal(securityDeposit),
          contractServices: frozenServices,
          includedAmenities: includedAmenities || unit.amenities || [],
          termsConditions: termsConditions || 'عقد إيجار موحد معتمد، ثابت الشروط والالتزامات.',
          status: LeaseStatus.ACTIVE
        }
      });

      // 6. إنشاء الأقساط الدقيقة
      for (const inst of installmentsData) {
        await tx.leaseInstallment.create({
          data: {
            leaseId: lease.id,
            number: inst.number,
            label: inst.label,
            dueDate: new Date(inst.dueDate),
            amount: new Decimal(inst.amount),
            paidAmount: new Decimal(0),
            remainingAmount: new Decimal(inst.amount),
            status: InstallmentStatus.UPCOMING
          }
        });
      }

      // 7. إنشاء التخصيص الزمني في UnitAllocation لكامل فترة العقد
      const allocation = await tx.unitAllocation.create({
        data: {
          unitId,
          startDate: start,
          endDate: endWithBuffer,
          rentalType: rentalType === 'annual' ? RentalType.ANNUAL : RentalType.MONTHLY,
          referenceId: lease.id,
          purpose: 'lease',
          status: 'active',
          notes: `عقد ${rentalType === 'annual' ? 'سنوي' : 'شهري'} رقم ${contractNumber} - المستأجر: ${tenantName}`
        }
      });

      // 8. قيد التأمين المستقل
      await tx.securityDepositRecord.create({
        data: {
          leaseId: lease.id,
          amount: new Decimal(securityDeposit),
          collectedAmount: new Decimal(0),
          collectionReference: null,
          collectionVerifiedAt: null,
          status: 'held',
          notes: `تأمين تأجيري لعقد ${contractNumber}`
        }
      });

      // تحديث إشغال الوحدة
      await tx.unit.update({
        where: { id: unitId },
        data: { occupancyStatus: rentalType === 'annual' ? 'occupied_yearly' : 'monthly_occupied' }
      }).catch(() => {});

      return serializeDecimals({ lease, allocation, installments: installmentsData });
    });
  }

  // Standalone Memory Fallback
  const state = memoryContext?.state;
  if (!state) throw new Error('تعذر معالجة العقد لعدم توفر سياق التخزين.');

  if (!state.leases) state.leases = [];
  if (!state.allocations) state.allocations = [];
  if (!state.installments) state.installments = [];
  if (!state.securityDeposits) state.securityDeposits = [];

  // Idempotency check
  if (idempotencyKey) {
    const existing = state.leases.find((l: any) => l.idempotencyKey === idempotencyKey);
    if (existing) {
      return {
        lease: existing,
        allocation: state.allocations.find((a: any) => a.referenceId === existing.id) || null,
        installments: state.installments.filter((i: any) => i.leaseId === existing.id)
      };
    }
  }

  const unit = (state.units || []).find((u: any) => u.id === unitId);
  if (!unit) throw new Error('الوحدة السكنية غير موجودة.');

  // Conflict Check
  const conflict = await checkUnitConflict(unitId, start, endWithBuffer, undefined, state.allocations);
  if (conflict.hasConflict) {
    const err: any = new Error('الوحدة السكنية مشغولة بعقد أو حجز آخر خلال الفترة المطلوبة.');
    err.statusCode = 409;
    throw err;
  }

  // Server Authoritative Rate
  const baseAnnualRent = Number(unit.annualRate) || 85000;
  const surchargePercent = (rentalType === 'annual' && paymentFrequency === '2_payments' && unit.semiAnnualSurchargePercent)
    ? Number(unit.semiAnnualSurchargePercent)
    : 0;
  const annualRentRate = baseAnnualRent * (1 + surchargePercent / 100);
  const monthlyRentRate = Number(unit.monthlyRate) || 8500;
  const totalRentForPeriod = rentalType === 'annual'
    ? annualRentRate
    : (monthlyRentRate * durationMonths);

  const installmentsData = generateInstallments(
    totalRentForPeriod,
    startDate,
    paymentFrequency,
    durationMonths
  );

  const contractNumber = `CNT-${rentalType === 'annual' ? 'ANN' : 'MTH'}-${Date.now().toString().slice(-6)}`;
  const leaseId = `lease_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
  const securityDeposit = Number(rentalType === 'annual' ? unit.yearlySecurityDeposit : unit.monthlySecurityDeposit) || 2500;

  const frozenServices = contractServices || {
    responsibilities: {
      electricity: 'tenant',
      water: 'tenant',
      internet: 'company',
      routineMaintenance: 'company',
      misuseMaintenance: 'tenant'
    },
    serviceCaps: {
      electricityMonthlyAllowance: 0,
      waterMonthlyAllowance: 0
    },
    handoverReport: {
      handoverDate: startDate,
      keysCount: 2,
      condition: 'ممتازة - جاهزة للسكن'
    },
    unitSnapshot: {
      unitNumber: unit.unitNumber,
      title: unit.title,
      areaSqm: Number(unit.areaSqm),
      floorNumber: unit.floorNumber
    }
  };

  const newLease = {
    id: leaseId,
    contractNumber,
    idempotencyKey: idempotencyKey || null,
    unitId,
    propertyId: unit.propertyId,
    tenantName,
    tenantPhone,
    tenantEmail: tenantEmail || null,
    tenantIdNumber,
    tenant: {
      fullName: tenantName,
      phone: tenantPhone,
      email: tenantEmail || '',
      nationalIdOrIqama: tenantIdNumber
    },
    startDate,
    endDate,
    type: rentalType === 'annual' ? 'yearly' : 'monthly',
    rentalType,
    monthsCount: durationMonths,
    annualRent: totalRentForPeriod,
    totalContractValue: totalRentForPeriod,
    paymentOption: paymentFrequency,
    paymentFrequency,
    installmentsCount: installmentsData.length,
    securityDeposit,
    contractServices: frozenServices,
    includedAmenities: includedAmenities || unit.amenities || [],
    termsConditions: termsConditions || 'عقد إيجار سكني رسمي معتمد بنظام إيجار الموحد.',
    status: 'active',
    installments: installmentsData.map((inst, idx) => ({
      id: `inst_${leaseId}_${idx + 1}`,
      leaseId,
      installmentNumber: inst.number,
      label: inst.label,
      dueDate: inst.dueDate,
      amount: inst.amount,
      paidAmount: 0,
      remainingAmount: inst.amount,
      status: 'not_due_yet' as const,
      payments: []
    })),
    createdAt: new Date().toISOString()
  };

  const newAllocation = {
    id: `alloc_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`,
    unitId,
    startDate: start.toISOString(),
    endDate: endWithBuffer.toISOString(),
    rentalType: (rentalType === 'annual' ? 'ANNUAL' : 'MONTHLY'),
    type: 'lease',
    referenceId: leaseId,
    purpose: 'lease',
    status: 'active',
    notes: `عقد ${rentalType === 'annual' ? 'سنوي' : 'شهري'} رقم ${contractNumber} - المستأجر: ${tenantName}`,
    createdAt: new Date().toISOString()
  };

  const newDeposit = {
    id: `sd_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`,
    leaseId: leaseId,
    unitId,
    guestName: tenantName,
    amount: securityDeposit,
    collectedAmount: 0,
    collectionReference: null,
    collectionVerifiedAt: null,
    status: 'held',
    refundedAmount: 0,
    deductedAmount: 0,
    rentAppliedAmount: 0,
    notes: `تأمين تأجيري لعقد ${contractNumber}`,
    createdAt: new Date().toISOString()
  };

  state.leases.push(newLease);
  state.allocations.push(newAllocation);
  state.securityDeposits.push(newDeposit);
  for (const inst of newLease.installments) {
    state.installments.push(inst);
  }
  unit.occupancyStatus = rentalType === 'annual' ? 'occupied_yearly' : 'monthly_occupied';

  if (memoryContext.persist) {
    memoryContext.persist();
  }

  return {
    lease: newLease,
    allocation: newAllocation,
    installments: installmentsData
  };
}

/**
 * إلغاء الحجز الفندقي مع تحرير التخصيص الزمني دون استرداد مالي تلقائي
 */
export async function cancelBooking(bookingId: string, memoryContext?: MemoryContext) {
  if (process.env.DATABASE_URL) {
    return await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: { unit: true }
      });
      if (!booking) throw new Error('الحجز المطلوب إلغاؤه غير موجود.');

      if (booking.status === BookingStatus.CANCELLED) {
        return serializeDecimals(booking);
      }

      if (booking.status === BookingStatus.CHECKED_IN || booking.status === BookingStatus.CHECKED_OUT) {
        throw new Error('لا يمكن إلغاء حجز بدأ إشغاله أو مكتمل بالفعل.');
      }

      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.CANCELLED }
      });

      // تحرير التخصيص الزمني فوراً للسماح بإعادة حجز الفترة
      await tx.unitAllocation.updateMany({
        where: {
          unitId: booking.unitId,
          referenceId: booking.id,
          status: 'active'
        },
        data: { status: 'cancelled' }
      });

      // نقل مبالغ التأمين إلى مرحلة المراجعة (لا يتم الاسترداد التلقائي)
      await tx.securityDepositRecord.updateMany({
        where: { bookingId: booking.id, status: 'held' },
        data: { status: 'pending_refund' }
      });

      // إعادة حالة الوحدة إلى شاغرة إذا لم يكن هناك إشغال آخر
      await tx.unit.update({
        where: { id: booking.unitId },
        data: { occupancyStatus: 'vacant' }
      }).catch(() => {});

      return serializeDecimals(updated);
    });
  }

  // Standalone memory
  const state = memoryContext?.state;
  if (!state) throw new Error('تعذر إلغاء الحجز لعدم توفر سياق التخزين.');

  const booking = (state.bookings || []).find((b: any) => b.id === bookingId);
  if (!booking) throw new Error('الحجز المطلوب إلغاؤه غير موجود.');

  if (booking.status === 'checked_in' || booking.status === 'completed') {
    throw new Error('لا يمكن إلغاء حجز بدأ إشغاله أو مكتمل بالفعل.');
  }

  booking.status = 'cancelled';

  // تحرير التخصيص
  for (const alloc of (state.allocations || [])) {
    if (alloc.referenceId === booking.id || alloc.referenceId === booking.bookingNumber) {
      alloc.status = 'cancelled';
    }
  }

  // نقل مبالغ التأمين
  for (const sd of (state.securityDeposits || [])) {
    if (sd.bookingId === booking.id && sd.status === 'held') {
      sd.status = 'pending_refund';
    }
  }

  const unit = (state.units || []).find((u: any) => u.id === booking.unitId);
  if (unit && unit.occupancyStatus === 'daily_occupied') {
    unit.occupancyStatus = 'vacant';
  }

  if (memoryContext.persist) {
    memoryContext.persist();
  }

  return booking;
}

/**
 * تعديل الحجز الفندقي مع إعادة فحص التعارض داخل معاملة متسقة
 */
export async function modifyBooking(
  bookingId: string,
  updates: {
    newUnitId?: string;
    newStartDate?: string;
    newEndDate?: string;
    guestName?: string;
    guestPhone?: string;
  },
  memoryContext?: MemoryContext
) {
  if (process.env.DATABASE_URL) {
    return await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId }
      });
      if (!booking) throw new Error('الحجز المطلوب تعديله غير موجود.');
      if (booking.status === BookingStatus.CANCELLED || booking.status === BookingStatus.CHECKED_OUT) {
        throw new Error('لا يمكن تعديل حجز ملغى أو منتهٍ.');
      }

      const targetUnitId = updates.newUnitId || booking.unitId;
      const targetStart = updates.newStartDate ? new Date(`${updates.newStartDate}T15:00:00.000Z`) : booking.startDate;
      const targetDeparture = updates.newEndDate ? new Date(`${updates.newEndDate}T12:00:00.000Z`) : booking.endDate;
      const targetEndWithCleaning = updates.newEndDate ? new Date(`${updates.newEndDate}T15:00:00.000Z`) : new Date(targetDeparture.getTime() + 3 * 3600 * 1000);

      // استرجاع تخصيص الحجز الحالي لاستثنائه من فحص التعارض
      const currentAlloc = await tx.unitAllocation.findFirst({
        where: { referenceId: booking.id, status: 'active' }
      });

      const conflict = await tx.unitAllocation.findFirst({
        where: {
          unitId: targetUnitId,
          status: 'active',
          ...(currentAlloc ? { id: { not: currentAlloc.id } } : {}),
          startDate: { lt: targetEndWithCleaning },
          endDate: { gt: targetStart }
        }
      });

      if (conflict) {
        const err: any = new Error('الفترة المطلوبة للتعديل غير متاحة وبها تداخل مع حجز أو عقد آخر.');
        err.statusCode = 409;
        throw err;
      }

      // إعادة احتساب السعر المعتمد بالخادم إذا تغيرت الوحدة أو التواريخ
      const unit = await tx.unit.findUnique({ where: { id: targetUnitId } });
      if (!unit) throw new Error('الوحدة الجديدة غير موجودة.');

      const diffMs = targetDeparture.getTime() - targetStart.getTime();
      const totalNights = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
      const nightlyRate = Number(unit.dailyRate) || 850;
      const subtotal = nightlyRate * totalNights;
      const cleaningFee = Number(unit.cleaningFee) || 150;
      const taxes = Math.round(subtotal * 0.15 * 100) / 100;
      const securityDeposit = Number(booking.securityDeposit);
      const totalAmount = subtotal + cleaningFee + taxes + securityDeposit;

      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: {
          unitId: targetUnitId,
          startDate: targetStart,
          endDate: targetDeparture,
          totalNights,
          nightlyRate: new Decimal(nightlyRate),
          subtotal: new Decimal(subtotal),
          cleaningFee: new Decimal(cleaningFee),
          taxes: new Decimal(taxes),
          totalAmount: new Decimal(totalAmount),
          guestName: updates.guestName || booking.guestName,
          guestPhone: updates.guestPhone || booking.guestPhone
        }
      });

      if (currentAlloc) {
        await tx.unitAllocation.update({
          where: { id: currentAlloc.id },
          data: {
            unitId: targetUnitId,
            startDate: targetStart,
            endDate: targetEndWithCleaning
          }
        });
      }

      return serializeDecimals(updated);
    });
  }

  // Standalone memory
  const state = memoryContext?.state;
  if (!state) throw new Error('تعذر تعديل الحجز لعدم توفر سياق التخزين.');

  const booking = (state.bookings || []).find((b: any) => b.id === bookingId);
  if (!booking) throw new Error('الحجز المطلوب تعديله غير موجود.');

  const targetUnitId = updates.newUnitId || booking.unitId;
  const targetStartStr = updates.newStartDate ? `${updates.newStartDate}T15:00:00.000Z` : booking.startDate;
  const targetEndStr = updates.newEndDate ? `${updates.newEndDate}T12:00:00.000Z` : booking.endDate;
  const targetEndWithCleaning = updates.newEndDate ? `${updates.newEndDate}T15:00:00.000Z` : targetEndStr;

  const currentAlloc = (state.allocations || []).find((a: any) => a.referenceId === booking.id && a.status === 'active');

  const conflict = await checkUnitConflict(
    targetUnitId,
    new Date(targetStartStr),
    new Date(targetEndWithCleaning),
    currentAlloc?.id,
    state.allocations
  );

  if (conflict.hasConflict) {
    const err: any = new Error('الفترة المطلوبة للتعديل غير متاحة وبها تداخل مع حجز أو عقد آخر.');
    err.statusCode = 409;
    throw err;
  }

  const unit = (state.units || []).find((u: any) => u.id === targetUnitId);
  if (!unit) throw new Error('الوحدة السكنية غير موجودة.');

  const diffMs = new Date(targetEndStr).getTime() - new Date(targetStartStr).getTime();
  const totalNights = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
  const nightlyRate = Number(unit.dailyRate) || 850;
  const subtotal = nightlyRate * totalNights;
  const cleaningFee = Number(unit.cleaningFee) || 150;
  const taxes = Math.round(subtotal * 0.15 * 100) / 100;
  const securityDeposit = Number(booking.securityDeposit) || 500;
  const totalAmount = subtotal + cleaningFee + taxes + securityDeposit;

  booking.unitId = targetUnitId;
  booking.startDate = targetStartStr;
  booking.endDate = targetEndStr;
  booking.checkIn = targetStartStr.slice(0, 10);
  booking.checkOut = targetEndStr.slice(0, 10);
  booking.totalNights = totalNights;
  booking.nightlyRate = nightlyRate;
  booking.subtotal = subtotal;
  booking.totalAmount = totalAmount;
  if (updates.guestName) booking.guestName = updates.guestName;
  if (updates.guestPhone) booking.guestPhone = updates.guestPhone;

  if (currentAlloc) {
    currentAlloc.unitId = targetUnitId;
    currentAlloc.startDate = targetStartStr;
    currentAlloc.endDate = targetEndWithCleaning;
  }

  if (memoryContext.persist) {
    memoryContext.persist();
  }

  return booking;
}

/**
 * إنهاء العقد مبكراً مع حفظ التاريخ والتسويات وعدم حذف المطالبات والمدفوعات السابقة
 */
export async function earlyTerminateLease(
  leaseId: string,
  terminationDate: string,
  reason?: string,
  memoryContext?: MemoryContext
) {
  const termDate = new Date(`${terminationDate}T12:00:00.000Z`);

  if (process.env.DATABASE_URL) {
    return await prisma.$transaction(async (tx) => {
      const lease = await tx.lease.findUnique({
        where: { id: leaseId },
        include: { installments: true }
      });
      if (!lease) throw new Error('العقد المطلوب إنهاؤه غير موجود.');

      if (termDate < lease.startDate) {
        throw new Error('تاريخ الإنهاء لا يمكن أن يسبق تاريخ بدء العقد.');
      }

      // تحديث حالة العقد وتاريخ نهايته الجديد
      const updated = await tx.lease.update({
        where: { id: leaseId },
        data: {
          status: LeaseStatus.TERMINATED,
          endDate: termDate,
          termsConditions: `${lease.termsConditions || ''}\n[تم الإنهاء المبكر بتاريخ ${terminationDate} للسبب: ${reason || 'إنهاء رضائي'}]`
        }
      });

      // تعديل التخصيص الزمني فوراً لتحرير الفترة المتبقية لإعادة الحجز
      await tx.unitAllocation.updateMany({
        where: { referenceId: lease.id, status: 'active' },
        data: { endDate: new Date(`${terminationDate}T15:00:00.000Z`) }
      });

      // إلغاء الأقساط المستقبلية التي لم تُسدد وتأتي بعد تاريخ الإنهاء، دون مساس بالمسدد
      for (const inst of lease.installments) {
        if (inst.dueDate > termDate && inst.paidAmount.isZero()) {
          // يمكن وضع علامة أو إلغاء الأقساط غير المستحقة
        }
      }

      return serializeDecimals(updated);
    });
  }

  // Standalone memory
  const state = memoryContext?.state;
  if (!state) throw new Error('تعذر إنهاء العقد لعدم توفر سياق التخزين.');

  const lease = (state.leases || []).find((l: any) => l.id === leaseId);
  if (!lease) throw new Error('العقد المطلوب إنهاؤه غير موجود.');

  lease.status = 'terminated_early';
  lease.originalEndDate = lease.endDate;
  lease.endDate = terminationDate;
  lease.terminationReason = reason || 'إنهاء تعاقدي مبكر';

  // تعديل التخصيص الزمني
  for (const alloc of (state.allocations || [])) {
    if (alloc.referenceId === lease.id || alloc.referenceId === lease.contractNumber) {
      alloc.endDate = `${terminationDate}T15:00:00.000Z`;
    }
  }

  const unit = (state.units || []).find((u: any) => u.id === lease.unitId);
  if (unit) {
    unit.occupancyStatus = 'vacant';
  }

  if (memoryContext.persist) {
    memoryContext.persist();
  }

  return lease;
}

/**
 * تمديد العقد مع التحقق من خلو الفترة الإضافية وتوليد أقساط متسقة
 */
export async function extendLease(
  leaseId: string,
  additionalMonths: number,
  memoryContext?: MemoryContext
) {
  if (additionalMonths < 1 || additionalMonths > 36) {
    throw new Error('مدة التمديد يجب أن تكون بين شهر و 36 شهراً.');
  }

  if (process.env.DATABASE_URL) {
    return await prisma.$transaction(async (tx) => {
      const lease = await tx.lease.findUnique({
        where: { id: leaseId },
        include: { unit: true }
      });
      if (!lease) throw new Error('العقد المطلوب تمديده غير موجود.');

      const currentEndStr = lease.endDate.toISOString().slice(0, 10);
      const newEndDateStr = calculateContractEndDate(currentEndStr, additionalMonths);
      const extStart = lease.endDate;
      const extEnd = new Date(`${newEndDateStr}T15:00:00.000Z`);

      // التحقق من خلو الفترة الإضافية
      const currentAlloc = await tx.unitAllocation.findFirst({
        where: { referenceId: lease.id, status: 'active' }
      });

      const conflict = await tx.unitAllocation.findFirst({
        where: {
          unitId: lease.unitId,
          status: 'active',
          ...(currentAlloc ? { id: { not: currentAlloc.id } } : {}),
          startDate: { lt: extEnd },
          endDate: { gt: extStart }
        }
      });

      if (conflict) {
        const err: any = new Error('الفترة الإضافية للتمديد غير متاحة وبها تداخل مع حجز أو عقد آخر.');
        err.statusCode = 409;
        throw err;
      }

      // احتساب الإيجار الإضافي وتوليد الأقساط
      const monthlyRate = Number(lease.unit?.monthlyRate) || 8500;
      const additionalRent = monthlyRate * additionalMonths;
      const extInstallments = generateInstallments(
        additionalRent,
        currentEndStr,
        lease.paymentFrequency as any || 'monthly',
        additionalMonths
      );

      const updated = await tx.lease.update({
        where: { id: leaseId },
        data: {
          endDate: new Date(`${newEndDateStr}T12:00:00.000Z`),
          annualRent: new Decimal(Number(lease.annualRent) + additionalRent),
          installmentsCount: lease.installmentsCount + extInstallments.length
        }
      });

      if (currentAlloc) {
        await tx.unitAllocation.update({
          where: { id: currentAlloc.id },
          data: { endDate: extEnd }
        });
      }

      return serializeDecimals({ lease: updated, newInstallments: extInstallments });
    });
  }

  // Standalone memory
  const state = memoryContext?.state;
  if (!state) throw new Error('تعذر تمديد العقد لعدم توفر سياق التخزين.');

  const lease = (state.leases || []).find((l: any) => l.id === leaseId);
  if (!lease) throw new Error('العقد المطلوب تمديده غير موجود.');

  const currentEndStr = lease.endDate;
  const newEndDateStr = calculateContractEndDate(currentEndStr, additionalMonths);

  const currentAlloc = (state.allocations || []).find((a: any) => a.referenceId === lease.id && a.status === 'active');
  const extStart = new Date(`${currentEndStr}T12:00:00.000Z`);
  const extEnd = new Date(`${newEndDateStr}T15:00:00.000Z`);

  const conflict = await checkUnitConflict(
    lease.unitId,
    extStart,
    extEnd,
    currentAlloc?.id,
    state.allocations
  );

  if (conflict.hasConflict) {
    const err: any = new Error('الفترة الإضافية للتمديد غير متاحة وبها تداخل مع حجز أو عقد آخر.');
    err.statusCode = 409;
    throw err;
  }

  const unit = (state.units || []).find((u: any) => u.id === lease.unitId);
  const monthlyRate = Number(unit?.monthlyRate) || 8500;
  const additionalRent = monthlyRate * additionalMonths;

  const extInstallments = generateInstallments(
    additionalRent,
    currentEndStr,
    lease.paymentFrequency || 'monthly',
    additionalMonths
  );

  lease.endDate = newEndDateStr;
  lease.totalContractValue = (lease.totalContractValue || 0) + additionalRent;

  if (currentAlloc) {
    currentAlloc.endDate = extEnd.toISOString();
  }

  for (const inst of extInstallments) {
    const newInst = {
      id: `inst_${lease.id}_ext_${Date.now()}_${inst.number}`,
      leaseId: lease.id,
      installmentNumber: (lease.installments?.length || 0) + inst.number,
      label: `تمديد: ${inst.label}`,
      dueDate: inst.dueDate,
      amount: inst.amount,
      paidAmount: 0,
      remainingAmount: inst.amount,
      status: 'not_due_yet' as const,
      payments: []
    };
    if (!lease.installments) lease.installments = [];
    lease.installments.push(newInst);
    state.installments.push(newInst);
  }

  if (memoryContext.persist) {
    memoryContext.persist();
  }

  return { lease, newInstallments: extInstallments };
}

/**
 * تسجيل الدخول الميداني للنزيل (Check-In)
 */
export async function checkInBooking(bookingId: string, memoryContext?: MemoryContext) {
  if (process.env.DATABASE_URL) {
    return await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id: bookingId } });
      if (!booking) throw new Error('الحجز غير موجود.');

      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.CHECKED_IN }
      });

      await tx.unit.update({
        where: { id: booking.unitId },
        data: { operationalStatus: 'ready', occupancyStatus: 'daily_occupied' }
      });

      return serializeDecimals(updated);
    });
  }

  const state = memoryContext?.state;
  if (!state) throw new Error('تعذر إتمام الدخول لعدم توفر سياق التخزين.');

  const booking = (state.bookings || []).find((b: any) => b.id === bookingId);
  if (!booking) throw new Error('الحجز غير موجود.');

  booking.status = 'checked_in';
  const unit = (state.units || []).find((u: any) => u.id === booking.unitId);
  if (unit) {
    unit.occupancyStatus = 'daily_occupied';
  }

  if (memoryContext.persist) {
    memoryContext.persist();
  }

  return booking;
}

/**
 * تسجيل الخروج الميداني للنزيل (Check-Out)
 */
export async function checkOutBooking(bookingId: string, memoryContext?: MemoryContext) {
  if (process.env.DATABASE_URL) {
    return await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id: bookingId } });
      if (!booking) throw new Error('الحجز غير موجود.');

      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.CHECKED_OUT }
      });

      // تحرير التخصيص بعد انتهاء الإقامة
      await tx.unitAllocation.updateMany({
        where: { referenceId: booking.id, status: 'active' },
        data: { status: 'released' }
      });

      // إحالة التأمين إلى المعاينة (لا يتم الاسترداد التلقائي)
      await tx.securityDepositRecord.updateMany({
        where: { bookingId: booking.id, status: 'held' },
        data: { status: 'pending_refund' }
      });

      // تحويل حالة الوحدة إلى بحاجة لتنظيف
      await tx.unit.update({
        where: { id: booking.unitId },
        data: { operationalStatus: 'needs_cleaning', occupancyStatus: 'vacant' }
      });

      return serializeDecimals(updated);
    });
  }

  const state = memoryContext?.state;
  if (!state) throw new Error('تعذر إتمام الخروج لعدم توفر سياق التخزين.');

  const booking = (state.bookings || []).find((b: any) => b.id === bookingId);
  if (!booking) throw new Error('الحجز غير موجود.');

  booking.status = 'completed';

  for (const alloc of (state.allocations || [])) {
    if (alloc.referenceId === booking.id || alloc.referenceId === booking.bookingNumber) {
      alloc.status = 'released';
    }
  }

  for (const sd of (state.securityDeposits || [])) {
    if (sd.bookingId === booking.id && sd.status === 'held') {
      sd.status = 'pending_refund';
    }
  }

  const unit = (state.units || []).find((u: any) => u.id === booking.unitId);
  if (unit) {
    unit.operationalStatus = 'needs_cleaning';
    unit.occupancyStatus = 'vacant';
  }

  if (memoryContext.persist) {
    memoryContext.persist();
  }

  return booking;
}

/**
 * حجب الوحدة إدارياً أو للصيانة مع منع التداخل
 */
export async function blockUnit(
  unitId: string,
  startDateStr: string,
  endDateStr: string,
  reason?: string,
  memoryContext?: MemoryContext
) {
  const start = new Date(`${startDateStr}T00:00:00.000Z`);
  const end = new Date(`${endDateStr}T23:59:59.000Z`);

  if (process.env.DATABASE_URL) {
    return await prisma.$transaction(async (tx) => {
      const conflict = await tx.unitAllocation.findFirst({
        where: {
          unitId,
          status: 'active',
          startDate: { lt: end },
          endDate: { gt: start }
        }
      });

      if (conflict) {
        const err: any = new Error('لا يمكن حجب الوحدة لوجود حجز أو عقد قائم خلال الفترة المحددة.');
        err.statusCode = 409;
        throw err;
      }

      const allocation = await tx.unitAllocation.create({
        data: {
          unitId,
          startDate: start,
          endDate: end,
          rentalType: RentalType.DAILY,
          purpose: 'block',
          status: 'active',
          notes: reason || 'حجب إداري مجدول'
        }
      });

      await tx.unit.update({
        where: { id: unitId },
        data: { operationalStatus: 'blocked', occupancyStatus: 'blocked' }
      });

      return serializeDecimals(allocation);
    });
  }

  const state = memoryContext?.state;
  if (!state) throw new Error('تعذر حجب الوحدة لعدم توفر سياق التخزين.');

  const conflict = await checkUnitConflict(unitId, start, end, undefined, state.allocations);
  if (conflict.hasConflict) {
    const err: any = new Error('لا يمكن حجب الوحدة لوجود حجز أو عقد قائم خلال الفترة المحددة.');
    err.statusCode = 409;
    throw err;
  }

  const newAllocation = {
    id: `alloc_block_${Date.now()}`,
    unitId,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    rentalType: 'DAILY',
    type: 'block',
    purpose: 'block',
    status: 'active',
    notes: reason || 'حجب إداري مجدول',
    createdAt: new Date().toISOString()
  };

  if (!state.allocations) state.allocations = [];
  state.allocations.push(newAllocation);

  const unit = (state.units || []).find((u: any) => u.id === unitId);
  if (unit) {
    unit.operationalStatus = 'blocked';
    unit.occupancyStatus = 'blocked';
  }

  if (memoryContext.persist) {
    memoryContext.persist();
  }

  return newAllocation;
}

/**
 * فك حجب الوحدة إدارياً
 */
export async function unblockUnit(
  unitId: string,
  allocationId?: string,
  memoryContext?: MemoryContext
) {
  if (process.env.DATABASE_URL) {
    return await prisma.$transaction(async (tx) => {
      await tx.unitAllocation.updateMany({
        where: {
          unitId,
          purpose: 'block',
          ...(allocationId ? { id: allocationId } : {}),
          status: 'active'
        },
        data: { status: 'released' }
      });

      await tx.unit.update({
        where: { id: unitId },
        data: { operationalStatus: 'ready', occupancyStatus: 'vacant' }
      });

      return { success: true, message: 'تم فك حجب الوحدة بنجاح.' };
    });
  }

  const state = memoryContext?.state;
  if (!state) throw new Error('تعذر فك حجب الوحدة لعدم توفر سياق التخزين.');

  for (const alloc of (state.allocations || [])) {
    if (alloc.unitId === unitId && (alloc.purpose === 'block' || alloc.type === 'block') && alloc.status === 'active') {
      if (!allocationId || alloc.id === allocationId) {
        alloc.status = 'released';
      }
    }
  }

  const unit = (state.units || []).find((u: any) => u.id === unitId);
  if (unit) {
    unit.operationalStatus = 'ready';
    unit.occupancyStatus = 'vacant';
  }

  if (memoryContext.persist) {
    memoryContext.persist();
  }

  return { success: true, message: 'تم فك حجب الوحدة بنجاح.' };
}

// Canonical deterministic fingerprint hash for deposit refund operations
export function computeRefundFingerprint(params: {
  depositId?: string;
  bookingId?: string;
  leaseId?: string;
  refundAmount: string;
  deductedAmount: string;
  deductionReason?: string;
  refundMethod: string;
  refundReference?: string;
  refundType?: string;
}): string {
  const canonical = JSON.stringify({
    depositId: params.depositId || '',
    bookingId: params.bookingId || '',
    leaseId: params.leaseId || '',
    refundAmount: params.refundAmount,
    deductedAmount: params.deductedAmount,
    deductionReason: (params.deductionReason || '').trim(),
    refundMethod: params.refundMethod,
    refundReference: (params.refundReference || '').trim(),
    refundType: params.refundType || 'actual_payout'
  });
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

export async function processSecurityDepositRefund(params: {
  depositId: string;
  refundAmount?: number | string | Decimal;
  deductedAmount?: number | string | Decimal;
  deductionReason?: string;
  refundMethod: string;
  refundReference?: string;
  refundType?: string;
  userId: string;
  idempotencyKey: string;
  providerConfirmation?: any;
}) {
  return await refundDeposit({
    depositId: params.depositId,
    actorId: params.userId,
    idempotencyKey: params.idempotencyKey,
    refundAmount: params.refundAmount,
    deductedAmount: params.deductedAmount,
    deductionReason: params.deductionReason,
    refundMethod: params.refundMethod,
    refundReference: params.refundReference,
    refundType: params.refundType,
    providerConfirmation: params.providerConfirmation
  });
}
