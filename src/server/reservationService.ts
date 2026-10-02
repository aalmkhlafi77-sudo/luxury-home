import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from './db.js';
import crypto from 'crypto';
import { RentalType, BookingStatus, LeaseStatus, InstallmentStatus } from '@prisma/client';
import { serializeDecimals } from './repository.js';

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
  contractServices?: string[];
  termsConditions?: string;
  idempotencyKey?: string;
}

// Helper to compute calendar end date safely (1 day before start day next year/month)
export function calculateContractEndDate(startDateStr: string, months: number): string {
  const d = new Date(startDateStr);
  d.setMonth(d.getMonth() + months);
  // Subtract 1 day for inclusive end of lease period
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

// Generate installment dates and amounts with exact halala rounding
export function generateInstallments(
  totalAnnualRent: number,
  startDateStr: string,
  frequency: '1_payment' | '2_payments' | '4_payments' | 'monthly',
  monthsCount: number = 12
) {
  const installments = [];
  let count = 1;
  let intervalMonths = 12;

  if (frequency === '2_payments') {
    count = 2;
    intervalMonths = 6;
  } else if (frequency === '4_payments') {
    count = 4;
    intervalMonths = 3;
  } else if (frequency === 'monthly') {
    count = monthsCount;
    intervalMonths = 1;
  }

  const baseAmount = Math.floor((totalAnnualRent / count) * 100) / 100;
  const totalBase = baseAmount * count;
  const roundingDifference = Math.round((totalAnnualRent - totalBase) * 100) / 100;

  for (let i = 0; i < count; i++) {
    const dueDate = new Date(startDateStr);
    dueDate.setMonth(dueDate.getMonth() + (i * intervalMonths));
    
    // Add rounding difference to the last installment to ensure 100% exact total
    const instAmount = i === count - 1 ? (baseAmount + roundingDifference) : baseAmount;

    installments.push({
      number: i + 1,
      label: count === 1 ? 'دفعة العقد الكاملة' : `الدفعة ${i + 1} من ${count}`,
      dueDate: dueDate.toISOString().slice(0, 10),
      amount: instAmount,
      paidAmount: 0,
      remainingAmount: instAmount,
      status: 'UPCOMING' as const
    });
  }

  return installments;
}

// Check unit availability against UnitAllocation
export async function checkUnitConflict(
  unitId: string,
  startDateTime: Date,
  endDateTime: Date,
  excludeAllocationId?: string
): Promise<{ hasConflict: boolean; conflictingAllocation?: any }> {
  // Prep buffer: add 3 hours buffer to checkout for cleaning
  const startWithBuffer = new Date(startDateTime);
  const endWithBuffer = new Date(endDateTime.getTime() + 3 * 60 * 60 * 1000);

  if (process.env.DATABASE_URL) {
    const allocations = await prisma.unitAllocation.findMany({
      where: {
        unitId,
        status: 'active', // ONLY active allocations cause conflict; cancelled/released do not!
        ...(excludeAllocationId ? { id: { not: excludeAllocationId } } : {}),
        AND: [
          { startDate: { lt: endWithBuffer } },
          { endDate: { gt: startWithBuffer } }
        ]
      }
    });

    if (allocations.length > 0) {
      return { hasConflict: true, conflictingAllocation: allocations[0] };
    }
    return { hasConflict: false };
  }

  return { hasConflict: false };
}

// Server-side daily reservation transaction
export async function processDailyReservation(input: DailyBookingInput) {
  const { unitId, checkIn, checkOut, guestName, guestPhone, guestEmail, guestIdNumber, notes, idempotencyKey } = input;

  const start = new Date(`${checkIn}T15:00:00.000Z`);
  const end = new Date(`${checkOut}T12:00:00.000Z`);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
    throw new Error('تواريخ الحجز غير صالحة. يرجى اختيار تاريخ مغادرة بعد تاريخ الوصول.');
  }

  const diffMs = end.getTime() - start.getTime();
  const totalNights = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));

  if (process.env.DATABASE_URL) {
    return await prisma.$transaction(async (tx) => {
      // 0. Idempotency Check: if key already exists, return existing booking
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

      // 1. Fetch unit directly from database
      const unit = await tx.unit.findUnique({
        where: { id: unitId },
        include: { property: true }
      });

      if (!unit) {
        throw new Error('الوحدة السكنية غير موجودة.');
      }

      if (unit.occupancyStatus === 'blocked') {
        throw new Error('الوحدة السكنية محجوبة إدارياً حالياً.');
      }

      // 2. Strict conflict check with active allocations
      const conflict = await tx.unitAllocation.findFirst({
        where: {
          unitId,
          status: 'active',
          startDate: { lt: new Date(end.getTime() + 3 * 3600 * 1000) },
          endDate: { gt: start }
        }
      });

      if (conflict) {
        const err: any = new Error('عذراً، هذه الوحدة السكنية محجوزة بالفعل في الفترة المحددة أو في مرحلة التجهيز الفندقي.');
        err.statusCode = 409;
        throw err;
      }

      // 3. Compute official pricing on server
      const nightlyRate = Number(unit.dailyRate) || 850;
      const subtotal = nightlyRate * totalNights;
      const cleaningFee = 150;
      const taxes = Math.round(subtotal * 0.15 * 100) / 100; // 15% VAT
      const securityDeposit = 500; // refundable deposit
      const totalAmount = subtotal + cleaningFee + taxes + securityDeposit;

      const bookingNumber = `LH-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

      // 4. Create Booking
      const booking = await tx.booking.create({
        data: {
          bookingNumber,
          idempotencyKey: idempotencyKey || null,
          unitId,
          guestName,
          guestPhone,
          guestEmail,
          guestIdNumber,
          startDate: start,
          endDate: end,
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

      // 5. Create UnitAllocation
      const allocation = await tx.unitAllocation.create({
        data: {
          unitId,
          startDate: start,
          endDate: end,
          rentalType: RentalType.DAILY,
          referenceId: booking.id,
          purpose: 'booking',
          status: 'active',
          notes: `حجز يومي ${bookingNumber} - النزيل: ${guestName}`
        }
      });

      // 6. Record Separate Security Deposit Entry (Held, not mixed with rental income)
      await tx.securityDepositRecord.create({
        data: {
          bookingId: booking.id,
          amount: new Decimal(securityDeposit),
          status: 'held',
          notes: `تأمين مسترد لحجز ${bookingNumber}`
        }
      });

      return serializeDecimals({ booking, allocation, totalAmount, subtotal, taxes, cleaningFee, securityDeposit });
    });
  }

  // Standalone fallback
  const nightlyRate = 850;
  const subtotal = nightlyRate * totalNights;
  const cleaningFee = 150;
  const taxes = Math.round(subtotal * 0.15 * 100) / 100;
  const securityDeposit = 500;
  const totalAmount = subtotal + cleaningFee + taxes + securityDeposit;
  const bookingNumber = `LH-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

  return {
    booking: {
      id: `bk_${Date.now()}`,
      bookingNumber,
      unitId,
      guestName,
      guestPhone,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      rentalType: 'daily',
      totalNights,
      totalAmount,
      status: 'confirmed',
      paymentStatus: 'pending',
      identityStatus: 'pending_verification',
      smartLockPin: null
    },
    allocation: {
      id: `alloc_${Date.now()}`,
      unitId,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      rentalType: 'DAILY',
      referenceId: bookingNumber,
      purpose: 'booking',
      status: 'active'
    },
    totalAmount,
    subtotal,
    taxes,
    cleaningFee,
    securityDeposit
  };
}

// Server-side annual/monthly lease contract transaction
export async function processLeaseContract(input: LeaseContractInput) {
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
    termsConditions,
    idempotencyKey
  } = input;

  const durationMonths = rentalType === 'monthly' ? (input.durationMonths || 1) : 12;
  const endDate = input.endDate || calculateContractEndDate(startDate, durationMonths);

  const start = new Date(`${startDate}T15:00:00.000Z`);
  const end = new Date(`${endDate}T12:00:00.000Z`);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
    throw new Error('تواريخ العقد غير صالحة.');
  }

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

      // 1. Fetch unit
      const unit = await tx.unit.findUnique({
        where: { id: unitId },
        include: { property: true }
      });

      if (!unit) {
        throw new Error('الوحدة السكنية غير موجودة.');
      }

      // 2. Strict conflict check with active allocations
      const conflict = await tx.unitAllocation.findFirst({
        where: {
          unitId,
          status: 'active',
          startDate: { lt: end },
          endDate: { gt: start }
        }
      });

      if (conflict) {
        const err: any = new Error('الوحدة السكنية مشغولة بعقد أو حجز آخر خلال الفترة المطلوبة.');
        err.statusCode = 409;
        throw err;
      }

      // 3. Compute annual rent & installments
      const annualRentRate = rentalType === 'annual' 
        ? Number(unit.annualRate) || 85000
        : (Number(unit.monthlyRate) || 8500) * 12;

      const totalRentForPeriod = rentalType === 'annual'
        ? annualRentRate
        : (Number(unit.monthlyRate) || 8500) * durationMonths;

      const installmentsData = generateInstallments(
        totalRentForPeriod,
        startDate,
        paymentFrequency,
        durationMonths
      );

      const contractNumber = `CNT-${rentalType === 'annual' ? 'ANN' : 'MTH'}-${Date.now().toString().slice(-6)}`;
      const securityDeposit = 2500; // Contract security deposit

      // 4. Create Lease
      const lease = await tx.lease.create({
        data: {
          contractNumber,
          idempotencyKey: idempotencyKey || null,
          unitId,
          tenantName,
          tenantPhone,
          tenantEmail,
          tenantIdNumber,
          startDate: start,
          endDate: end,
          rentalType: rentalType === 'annual' ? RentalType.ANNUAL : RentalType.MONTHLY,
          annualRent: new Decimal(totalRentForPeriod),
          paymentOption: paymentFrequency,
          paymentFrequency,
          installmentsCount: installmentsData.length,
          securityDeposit: new Decimal(securityDeposit),
          contractServices: contractServices || ['wifi', 'parking', 'maintenance'],
          termsConditions: termsConditions || 'عقد إيجار سكني رسمي معتمد بنظام إيجار الموحد.',
          status: LeaseStatus.ACTIVE
        }
      });

      // 5. Create Installments
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

      // 6. Create UnitAllocation for entire duration of the lease
      const allocation = await tx.unitAllocation.create({
        data: {
          unitId,
          startDate: start,
          endDate: end,
          rentalType: rentalType === 'annual' ? RentalType.ANNUAL : RentalType.MONTHLY,
          referenceId: lease.id,
          purpose: 'lease',
          status: 'active',
          notes: `عقد ${rentalType === 'annual' ? 'سنوي' : 'شهري'} رقم ${contractNumber} - المستأجر: ${tenantName}`
        }
      });

      // 7. Security Deposit Record
      await tx.securityDepositRecord.create({
        data: {
          leaseId: lease.id,
          amount: new Decimal(securityDeposit),
          status: 'held',
          notes: `تأمين تأجيري لعقد ${contractNumber}`
        }
      });

      return serializeDecimals({ lease, allocation, installments: installmentsData });
    });
  }

  // Standalone preview fallback
  const contractNumber = `CNT-${rentalType === 'annual' ? 'ANN' : 'MTH'}-${Date.now().toString().slice(-6)}`;
  const totalRentForPeriod = rentalType === 'annual' ? 85000 : 8500 * durationMonths;
  const installmentsData = generateInstallments(totalRentForPeriod, startDate, paymentFrequency, durationMonths);

  return {
    lease: {
      id: `lease_${Date.now()}`,
      contractNumber,
      unitId,
      tenantName,
      tenantPhone,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      rentalType,
      annualRent: totalRentForPeriod,
      paymentOption: paymentFrequency,
      status: 'active'
    },
    allocation: {
      id: `alloc_${Date.now()}`,
      unitId,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      rentalType: rentalType.toUpperCase(),
      referenceId: contractNumber,
      purpose: 'lease',
      status: 'active'
    },
    installments: installmentsData
  };
}

export async function cancelBooking(bookingId: string) {
  if (process.env.DATABASE_URL) {
    return await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: { unit: { include: { property: true } } }
      });
      if (!booking) throw new Error('الحجز المطلوب إلغاؤه غير موجود.');

      // Check state machine rules
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

      // Cancel associated allocations to free exclusion constraint
      await tx.unitAllocation.updateMany({
        where: {
          unitId: booking.unitId,
          referenceId: booking.id,
          status: 'active'
        },
        data: { status: 'cancelled' }
      });

      // Move held security deposits to explicit 'pending_refund' status (never auto-refunded)
      await tx.securityDepositRecord.updateMany({
        where: { bookingId: booking.id, status: 'held' },
        data: { status: 'pending_refund' }
      });

      return serializeDecimals(updated);
    });
  }

  return null;
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
  depositId?: string;
  bookingId?: string;
  leaseId?: string;
  refundAmount?: number | string | Decimal;
  deductedAmount?: number | string | Decimal;
  deductionReason?: string;
  refundMethod: string; // bank_transfer, gateway_reversal, cash, mada, card_refund
  refundReference?: string;
  refundType?: string; // actual_payout, preauth_release
  userId?: string;
  userRole?: string;
  userAllowedProperties?: string[];
  idempotencyKey?: string;
  providerConfirmation?: any;
}) {
  const {
    depositId,
    bookingId,
    leaseId,
    deductionReason,
    refundMethod,
    refundReference,
    refundType = 'actual_payout',
    userId,
    userRole = 'SUPER_ADMIN',
    userAllowedProperties = ['all'],
    idempotencyKey,
    providerConfirmation
  } = params;

  // 1. Strict Numeric Validation (Reject NaN, negative, non-finite amounts)
  const rawRefund = params.refundAmount !== undefined && params.refundAmount !== null ? Number(params.refundAmount) : 0;
  const rawDeduct = params.deductedAmount !== undefined && params.deductedAmount !== null ? Number(params.deductedAmount) : 0;

  if (isNaN(rawRefund) || !isFinite(rawRefund) || rawRefund < 0) {
    const err: any = new Error('مبلغ الاسترداد المالي غير صالح أو يحتوي على قيمة سالبة.');
    err.statusCode = 400;
    throw err;
  }

  if (isNaN(rawDeduct) || !isFinite(rawDeduct) || rawDeduct < 0) {
    const err: any = new Error('مبلغ الخصم من التأمين غير صالح أو يحتوي على قيمة سالبة.');
    err.statusCode = 400;
    throw err;
  }

  const refDec = new Decimal(rawRefund.toFixed(2));
  const dedDec = new Decimal(rawDeduct.toFixed(2));
  const totalOperation = refDec.plus(dedDec);

  if (totalOperation.lte(0)) {
    const err: any = new Error('يجب تحديد مبلغ استرداد أو مبلغ خصم موجب أكبر من الصفر.');
    err.statusCode = 400;
    throw err;
  }

  // 2. Deduction Reason Validation
  if (dedDec.gt(0) && (!deductionReason || !deductionReason.trim())) {
    const err: any = new Error('سبب الخصم إلزامي عند تنفيذ أي خصم من رصيد التأمين.');
    err.statusCode = 400;
    throw err;
  }

  // 3. Payment Method & Reference Validation (Never generate random dummy references)
  if (!refundMethod || !refundMethod.trim()) {
    const err: any = new Error('طريقة الاسترداد (refundMethod) إلزامية.');
    err.statusCode = 400;
    throw err;
  }

  const isManual = ['bank_transfer', 'cash', 'mada', 'cheque', 'manual'].includes(refundMethod.toLowerCase());
  const isElectronic = ['gateway_reversal', 'online_gateway', 'card_refund'].includes(refundMethod.toLowerCase());

  if (isManual && (!refundReference || !refundReference.trim())) {
    const err: any = new Error('مرجع الإثبات البنكي / الإيصال مطلوب صراحة للاسترداد اليدوي.');
    err.statusCode = 400;
    throw err;
  }

  if (isElectronic && (!providerConfirmation || !providerConfirmation.confirmed)) {
    const err: any = new Error('لا يمكن تسجيل استرداد إلكتروني ناجح دون تأكيد موثوق من بوابة الدفع أو مزود الخدمة.');
    err.statusCode = 400;
    throw err;
  }

  // 4. Idempotency Key Pre-Check
  const requestHash = computeRefundFingerprint({
    depositId,
    bookingId,
    leaseId,
    refundAmount: refDec.toFixed(2),
    deductedAmount: dedDec.toFixed(2),
    deductionReason,
    refundMethod,
    refundReference,
    refundType
  });

  if (idempotencyKey && process.env.DATABASE_URL) {
    const existingKey = await prisma.idempotencyRecord.findUnique({
      where: {
        key_operationType: {
          key: idempotencyKey,
          operationType: 'security_deposit_refund'
        }
      }
    });

    if (existingKey) {
      if (existingKey.userId && userId && existingKey.userId !== userId && userRole !== 'SUPER_ADMIN') {
        const err: any = new Error('غير مصرح لك بالوصول إلى نتيجة مفتاح عملية يخص مستخدماً آخر.');
        err.statusCode = 403;
        throw err;
      }

      if (existingKey.requestHash === requestHash) {
        return existingKey.responseBody;
      } else {
        const err: any = new Error('تعارض مفتاح منع التكرار: تم استخدام نفس المفتاح مع بيانات استرداد مختلفة.');
        err.statusCode = 409;
        throw err;
      }
    }
  }

  if (process.env.DATABASE_URL) {
    return await prisma.$transaction(async (tx) => {
      // Re-check idempotency record inside transaction to handle concurrency race
      if (idempotencyKey) {
        const txRecord = await tx.idempotencyRecord.findUnique({
          where: {
            key_operationType: {
              key: idempotencyKey,
              operationType: 'security_deposit_refund'
            }
          }
        });
        if (txRecord) {
          if (txRecord.requestHash === requestHash) {
            return txRecord.responseBody;
          } else {
            const err: any = new Error('تعارض مفتاح منع التكرار: تم استخدام نفس المفتاح مع بيانات استرداد مختلفة.');
            err.statusCode = 409;
            throw err;
          }
        }
      }

      // Find the deposit record with full relation tree (Booking -> Unit -> Property OR Lease -> Unit -> Property)
      let deposit: any = null;
      if (depositId) {
        deposit = await tx.securityDepositRecord.findUnique({
          where: { id: depositId },
          include: {
            booking: { include: { unit: true } },
            lease: { include: { unit: true } }
          }
        });
      } else if (bookingId) {
        deposit = await tx.securityDepositRecord.findFirst({
          where: { bookingId, status: { in: ['held', 'pending_refund', 'partially_refunded'] } },
          include: {
            booking: { include: { unit: true } },
            lease: { include: { unit: true } }
          },
          orderBy: { createdAt: 'desc' }
        });
      } else if (leaseId) {
        deposit = await tx.securityDepositRecord.findFirst({
          where: { leaseId, status: { in: ['held', 'pending_refund', 'partially_refunded'] } },
          include: {
            booking: { include: { unit: true } },
            lease: { include: { unit: true } }
          },
          orderBy: { createdAt: 'desc' }
        });
      }

      if (!deposit) {
        const err: any = new Error('سجل التأمين المطلوب استرداده غير موجود أو لا يتطلب إجراء استرداد.');
        err.statusCode = 404;
        throw err;
      }

      // 5. Strict Real Property Scope Verification (Never trust client body)
      const realPropertyId = deposit.booking?.unit?.propertyId || deposit.lease?.unit?.propertyId || null;
      if (userRole !== 'SUPER_ADMIN') {
        const isAllowed = realPropertyId && Array.isArray(userAllowedProperties) && (
          userAllowedProperties.includes('all') || userAllowedProperties.includes(realPropertyId)
        );
        if (!isAllowed) {
          const err: any = new Error('غير مصرح لك بإجراء استرداد تأمين يتبع مبنى خارج نطاق صلاحياتك المعتمدة.');
          err.statusCode = 403;
          throw err;
        }
      }

      // 6. Check Deposit Status & Balance
      if (deposit.status === 'refunded' || deposit.status === 'deducted') {
        const err: any = new Error('تم استرداد أو خصم هذا التأمين بالكامل سلفاً.');
        err.statusCode = 400;
        throw err;
      }

      const totalHeld = new Decimal(deposit.amount);
      const alreadyRefunded = new Decimal(deposit.refundedAmount || 0);
      const alreadyDeducted = new Decimal(deposit.deductedAmount || 0);
      const availableBalance = totalHeld.minus(alreadyRefunded).minus(alreadyDeducted);

      if (totalOperation.gt(availableBalance)) {
        const err: any = new Error(`المبلغ المطلوب استرداده وخصمه (${totalOperation.toFixed(2)} ر.س) يتجاوز الرصيد المتاح من التأمين (${availableBalance.toFixed(2)} ر.س).`);
        err.statusCode = 400;
        throw err;
      }

      const newRefundedTotal = alreadyRefunded.plus(refDec);
      const newDeductedTotal = alreadyDeducted.plus(dedDec);

      let newStatus = deposit.status;
      if (newRefundedTotal.plus(newDeductedTotal).gte(totalHeld)) {
        newStatus = newDeductedTotal.gte(totalHeld) ? 'deducted' : 'refunded';
      } else {
        newStatus = 'partially_refunded';
      }

      // Update SecurityDepositRecord
      const updatedDeposit = await tx.securityDepositRecord.update({
        where: { id: deposit.id },
        data: {
          status: newStatus,
          refundedAmount: newRefundedTotal,
          deductedAmount: newDeductedTotal,
          deductionReason: deductionReason ? deductionReason.trim() : deposit.deductionReason,
          refundMethod,
          refundReference: refundReference ? refundReference.trim() : deposit.refundReference,
          refundType,
          refundedByUserId: userId || null,
          refundedAt: new Date()
        }
      });

      // 7. Insert Itemized Transaction Ledger Record
      const transactionType = dedDec.gt(0) && refDec.eq(0)
        ? 'deduction'
        : (refundType === 'preauth_release' ? 'preauth_release' : 'refund');

      const transAmount = refDec.gt(0) ? refDec : dedDec;

      const transactionRecord = await tx.securityDepositTransaction.create({
        data: {
          depositId: deposit.id,
          type: transactionType,
          amount: transAmount,
          method: refundMethod,
          reference: refundReference ? refundReference.trim() : (refundType === 'preauth_release' ? 'PREAUTH-RELEASE' : 'REF-LEDGER'),
          reason: deductionReason ? deductionReason.trim() : null,
          executedByUserId: userId || null,
          executedAt: new Date(),
          status: 'completed',
          idempotencyKey: idempotencyKey || null,
          notes: refDec.gt(0) && dedDec.gt(0) ? `استرداد بقيمة ${refDec.toFixed(2)} ر.س مع خصم بقيمة ${dedDec.toFixed(2)} ر.س` : null
        }
      });

      const responsePayload = {
        securityDeposit: serializeDecimals(updatedDeposit),
        transaction: serializeDecimals(transactionRecord),
        availableBalance: totalHeld.minus(newRefundedTotal).minus(newDeductedTotal).toNumber(),
        message: 'تمت معالجة استرداد التأمين وتوثيق الحركة المستقلة في سجل الحركات بنجاح.'
      };

      // 8. Atomically Record Idempotency Record
      if (idempotencyKey) {
        await tx.idempotencyRecord.create({
          data: {
            key: idempotencyKey,
            operationType: 'security_deposit_refund',
            userId: userId || null,
            requestHash,
            statusCode: 200,
            responseBody: responsePayload as any
          }
        });
      }

      return responsePayload;
    });
  }

  return null;
}

