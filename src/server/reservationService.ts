import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from './db.js';
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

export async function processSecurityDepositRefund(params: {
  depositId?: string;
  bookingId?: string;
  leaseId?: string;
  refundAmount?: number;
  deductedAmount?: number;
  deductionReason?: string;
  refundMethod: string; // bank_transfer, gateway_reversal, cash, mada
  refundReference?: string;
  refundType?: string; // actual_payout, preauth_release
  userId?: string;
}) {
  const {
    depositId,
    bookingId,
    leaseId,
    refundAmount = 0,
    deductedAmount = 0,
    deductionReason,
    refundMethod,
    refundReference,
    refundType = 'actual_payout',
    userId
  } = params;

  if (process.env.DATABASE_URL) {
    return await prisma.$transaction(async (tx) => {
      // Find the deposit record
      let deposit = null;
      if (depositId) {
        deposit = await tx.securityDepositRecord.findUnique({ where: { id: depositId } });
      } else if (bookingId) {
        deposit = await tx.securityDepositRecord.findFirst({
          where: { bookingId, status: { in: ['held', 'pending_refund', 'partially_refunded'] } },
          orderBy: { createdAt: 'desc' }
        });
      } else if (leaseId) {
        deposit = await tx.securityDepositRecord.findFirst({
          where: { leaseId, status: { in: ['held', 'pending_refund', 'partially_refunded'] } },
          orderBy: { createdAt: 'desc' }
        });
      }

      if (!deposit) {
        throw new Error('سجل التأمين المطلوب استرداده غير موجود أو لا يتطلب إجراء استرداد.');
      }

      if (deposit.status === 'refunded' || deposit.status === 'deducted') {
        throw new Error('تم استرداد أو خصم هذا التأمين بالكامل سلفاً.');
      }

      const totalDeposit = Number(deposit.amount);
      const currentRefunded = Number(deposit.refundedAmount || 0);
      const currentDeducted = Number(deposit.deductedAmount || 0);
      const availableBalance = Math.max(0, totalDeposit - currentRefunded - currentDeducted);

      const requestedRefund = Number(refundAmount);
      const newDeduction = Number(deductedAmount);

      if (requestedRefund + newDeduction > availableBalance + 0.001) {
        throw new Error(`المبلغ المطلوب استرداده وخصمه (${requestedRefund + newDeduction} ر.س) يتجاوز الرصيد المتاح من التأمين (${availableBalance} ر.س).`);
      }

      const updatedRefundedTotal = currentRefunded + requestedRefund;
      const updatedDeductedTotal = currentDeducted + newDeduction;

      let newStatus = deposit.status;
      if (updatedRefundedTotal + updatedDeductedTotal >= totalDeposit - 0.001) {
        newStatus = updatedDeductedTotal >= totalDeposit - 0.001 ? 'deducted' : 'refunded';
      } else if (updatedRefundedTotal > 0 || updatedDeductedTotal > 0) {
        newStatus = 'partially_refunded';
      }

      const updated = await tx.securityDepositRecord.update({
        where: { id: deposit.id },
        data: {
          status: newStatus,
          refundedAmount: new Decimal(updatedRefundedTotal),
          deductedAmount: new Decimal(updatedDeductedTotal),
          deductionReason: deductionReason || deposit.deductionReason,
          refundMethod,
          refundReference: refundReference || `REF-${Date.now().toString().slice(-6)}`,
          refundType,
          refundedByUserId: userId || null,
          refundedAt: new Date()
        }
      });

      return serializeDecimals(updated);
    });
  }

  return null;
}

