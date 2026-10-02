import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from './db.js';
import { getMemoryState, persistFallbackState } from '../../server.js';
import { serializeDecimals } from './repository.js';

export class RefundError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'RefundError';
  }
}

type RefundInput = {
  depositId: string;
  actorId: string;
  idempotencyKey?: unknown;
  refundAmount?: unknown;
  deductedAmount?: unknown;
  deductionReason?: unknown;
  refundMethod?: unknown;
  refundReference?: unknown;
  refundType?: unknown;
  providerConfirmation?: unknown;
};

function requiredText(
  value: unknown,
  label: string,
  maxLength = 200,
): string {
  if (typeof value !== 'string') {
    throw new RefundError(400, `${label} مطلوب.`);
  }
  const text = value.trim();
  if (!text || text.length > maxLength) {
    throw new RefundError(400, `${label} غير صالح.`);
  }
  return text;
}

function money(value: unknown, label: string): Prisma.Decimal {
  if (value === undefined || value === null || value === '') return new Prisma.Decimal(0);

  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new RefundError(400, `${label} غير صالح.`);
  }

  const text = String(value).trim();

  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(text)) {
    throw new RefundError(
      400,
      `${label} يجب أن يكون مبلغاً غير سالب بمنزلتين عشريتين كحد أقصى.`,
    );
  }

  return new Prisma.Decimal(text);
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export async function refundDeposit(input: RefundInput) {
  const depositId = requiredText(input.depositId, 'معرّف التأمين');
  const actorId = requiredText(input.actorId, 'معرّف المستخدم');
  const clientKey = String(input.idempotencyKey || `idem_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`).trim();

  const refund = money(input.refundAmount, 'مبلغ الاسترداد');
  const deduction = money(input.deductedAmount, 'مبلغ الخصم');
  const total = refund.plus(deduction);

  if (total.lte(0)) {
    throw new RefundError(400, 'يجب تحديد استرداد أو خصم موجب أكبر من الصفر.');
  }

  const method = String(input.refundMethod || '').trim().toLowerCase();
  if (!method) {
    throw new RefundError(400, 'طريقة العملية مطلوبة.');
  }

  const manualMethods = new Set([
    'bank_transfer',
    'cash',
    'deduction',
    'mada',
    'cheque',
    'manual'
  ]);

  const electronicMethods = new Set([
    'gateway_reversal',
    'online_gateway',
    'card_refund'
  ]);

  const isManual = manualMethods.has(method);
  const isElectronic = electronicMethods.has(method);

  if (!isManual && !isElectronic) {
    throw new RefundError(400, 'طريقة العملية غير مدعومة.');
  }

  if (refund.gt(0) && method === 'deduction') {
    throw new RefundError(400, 'حدد طريقة صرف مبلغ الاسترداد.');
  }

  if (refund.eq(0) && method !== 'deduction') {
    throw new RefundError(400, 'استخدم deduction لعملية الخصم فقط.');
  }

  let reference = String(input.refundReference || '').trim();
  if (isManual && refund.gt(0) && !reference) {
    throw new RefundError(400, 'مرجع الإثبات البنكي / الإيصال مطلوب صراحة للاسترداد اليدوي.');
  }
  if (refund.eq(0) && !reference) {
    reference = 'DEDUCTION-REF';
  }

  const providerConf: any = input.providerConfirmation;
  if (isElectronic && (!providerConf || !providerConf.confirmed)) {
    throw new RefundError(400, 'لا يمكن تسجيل استرداد إلكتروني ناجح دون تأكيد موثوق من بوابة الدفع.');
  }

  const reason = deduction.gt(0)
    ? requiredText(input.deductionReason, 'سبب الخصم', 2000)
    : null;

  const operationType = 'security_deposit_refund_v2';
  const operationKey = sha256(
    JSON.stringify([actorId, operationType, clientKey]),
  );

  const requestHash = sha256(JSON.stringify({
    depositId,
    refundAmount: refund.toFixed(2),
    deductedAmount: deduction.toFixed(2),
    deductionReason: reason,
    refundMethod: method,
    refundReference: reference,
    refundType: input.refundType || 'actual_payout',
  }));

  // ==========================
  // POSTGRES DATABASE EXECUTION
  // ==========================
  if (process.env.DATABASE_URL) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ ok: number }>>`
        SELECT 1 AS ok
        FROM (
          SELECT pg_advisory_xact_lock(
            hashtextextended(${operationKey}, 0)
          )
        ) AS operation_lock
      `;

      const actor = await tx.user.findUnique({
        where: { id: actorId },
        select: {
          id: true,
          username: true,
          role: true,
          isActive: true,
          allowedProperties: true,
        },
      });

      if (!actor || actor.isActive === false) {
        throw new RefundError(401, 'المستخدم غير موجود أو غير نشط.');
      }

      if (!['SUPER_ADMIN', 'ACCOUNTANT', 'PROPERTY_MANAGER'].includes(actor.role)) {
        throw new RefundError(403, 'غير مخول بتنفيذ العملية.');
      }

      let deposit = await tx.securityDepositRecord.findFirst({
        where: {
          OR: [
            { id: depositId },
            { bookingId: depositId },
            { leaseId: depositId }
          ]
        },
        include: {
          booking: { select: { unit: { select: { propertyId: true } } } },
          lease: { select: { unit: { select: { propertyId: true } } } },
        },
      });

      if (!deposit) {
        throw new RefundError(404, 'سجل التأمين غير موجود.');
      }

      const propertyId =
        deposit.booking?.unit?.propertyId ??
        deposit.lease?.unit?.propertyId;

      if (
        actor.role !== 'SUPER_ADMIN' &&
        (!propertyId ||
          (!actor.allowedProperties.includes('all') &&
            !actor.allowedProperties.includes(propertyId)))
      ) {
        throw new RefundError(403, 'التأمين خارج نطاق صلاحياتك.');
      }

      const previous = await tx.idempotencyRecord.findFirst({
        where: {
          OR: [
            { key: clientKey },
            { key: operationKey }
          ],
          operationType: { in: [operationType, 'security_deposit_refund'] }
        },
      });

      if (previous) {
        if (previous.userId && previous.userId !== actor.id && actor.role !== 'SUPER_ADMIN') {
          throw new RefundError(403, 'مفتاح العملية لا يخص المستخدم.');
        }
        if (previous.requestHash !== requestHash) {
          throw new RefundError(409, 'تعارض مفتاح منع التكرار: تم استخدام نفس المفتاح مع بيانات استرداد مختلفة.');
        }
        return JSON.parse(JSON.stringify(previous.responseBody));
      }

      await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "SecurityDepositRecord"
        WHERE "id" = ${deposit.id}
        FOR UPDATE
      `;

      if (deposit.status === 'refunded' || deposit.status === 'deducted') {
        throw new RefundError(400, 'تم استرداد أو خصم هذا التأمين بالكامل سلفاً.');
      }

      if (!['held', 'pending_refund', 'partially_refunded'].includes(deposit.status)) {
        throw new RefundError(400, 'حالة التأمين لا تسمح بهذه العملية.');
      }

      const collected = (deposit.collectedAmount && deposit.collectedAmount.gt(0))
        ? deposit.collectedAmount
        : deposit.amount;

      const spent = deposit.refundedAmount.plus(deposit.deductedAmount);
      const available = collected.minus(spent);

      if (total.gt(available)) {
        throw new RefundError(400, `المبلغ المطلوب (${total.toFixed(2)} ر.س) يتجاوز الرصيد المتاح (${available.toFixed(2)} ر.س).`);
      }

      const refundedTotal = deposit.refundedAmount.plus(refund);
      const deductedTotal = deposit.deductedAmount.plus(deduction);
      const remaining = collected.minus(refundedTotal).minus(deductedTotal);

      const status = remaining.lte(0)
        ? (deductedTotal.gte(collected) ? 'deducted' : 'refunded')
        : 'partially_refunded';

      const updated = await tx.securityDepositRecord.update({
        where: { id: deposit.id },
        data: {
          refundedAmount: refundedTotal,
          deductedAmount: deductedTotal,
          status,
          deductionReason: reason ?? deposit.deductionReason,
          refundMethod: refund.gt(0) ? method : deposit.refundMethod,
          refundReference: refund.gt(0) ? reference : deposit.refundReference,
          refundType: refund.gt(0) ? String(input.refundType || 'actual_payout') : deposit.refundType,
          refundedByUserId: actor.id,
          refundedAt: new Date(),
        },
      });

      const transactionIds: string[] = [];
      let lastTransaction: any = null;

      if (refund.gt(0)) {
        lastTransaction = await tx.securityDepositTransaction.create({
          data: {
            depositId: deposit.id,
            type: 'refund',
            amount: refund,
            method,
            reference,
            executedByUserId: actor.id,
            status: 'completed',
            idempotencyKey: clientKey,
            notes: deduction.gt(0) ? `استرداد جزء من التأمين مع خصم بقيمة ${deduction.toFixed(2)} ر.س` : null,
          },
        });
        transactionIds.push(lastTransaction.id);
      }

      if (deduction.gt(0)) {
        const dedTrans = await tx.securityDepositTransaction.create({
          data: {
            depositId: deposit.id,
            type: 'deduction',
            amount: deduction,
            method: 'deduction',
            reference: reference || 'DEDUCTION-REF',
            reason,
            executedByUserId: actor.id,
            status: 'completed',
            idempotencyKey: `${clientKey}:deduction`,
            notes: refund.gt(0) ? `خصم من التأمين مع استرداد بقيمة ${refund.toFixed(2)} ر.س` : null,
          },
        });
        if (!lastTransaction) lastTransaction = dedTrans;
        transactionIds.push(dedTrans.id);
      }

      await tx.auditLog.create({
        data: {
          userId: actor.id,
          userName: actor.username,
          action: 'معالجة تأمين موثقة',
          module: 'التأمينات',
          details: JSON.stringify({
            depositId: deposit.id,
            propertyId,
            refund: refund.toFixed(2),
            deduction: deduction.toFixed(2),
            reference,
            transactionIds,
          }),
        },
      });

      const responsePayload: any = {
        success: true,
        depositId: deposit.id,
        status: updated.status,
        refundedAmount: refundedTotal.toFixed(2),
        deductedAmount: deductedTotal.toFixed(2),
        availableBalance: remaining.toFixed(2),
        transactionIds,
        securityDeposit: serializeDecimals(updated),
        transaction: serializeDecimals(lastTransaction),
        message: 'تمت معالجة استرداد التأمين وتوثيق الحركة المستقلة بنجاح.'
      };

      await tx.idempotencyRecord.create({
        data: {
          key: clientKey,
          operationType,
          userId: actor.id,
          requestHash,
          responseBody: responsePayload,
        },
      });

      return responsePayload;
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      maxWait: 5000,
      timeout: 15000,
    });
  }

  // ==========================
  // IN-MEMORY FALLBACK EXECUTION
  // ==========================
  const state = getMemoryState();
  if (!state) {
    throw new RefundError(530, 'حالة الذاكرة المؤقتة غير متوفرة.');
  }

  const actor = (state.users || []).find((u: any) => u.id === actorId || u.username === actorId);
  if (!actor || actor.isActive === false) {
    throw new RefundError(401, 'المستخدم غير موجود أو غير نشط.');
  }

  if (!['SUPER_ADMIN', 'ACCOUNTANT', 'PROPERTY_MANAGER'].includes(actor.role)) {
    throw new RefundError(403, 'غير مخول بتنفيذ العملية.');
  }

  // Idempotency Check FIRST
  const previous = (state.idempotencyRecords || []).find(
    (ir: any) => (ir.key === clientKey || ir.key === operationKey) &&
                 ['security_deposit_refund_v2', 'security_deposit_refund'].includes(ir.operationType)
  );

  if (previous) {
    if (previous.userId && previous.userId !== actor.id && actor.role !== 'SUPER_ADMIN') {
      throw new RefundError(403, 'مفتاح العملية لا يخص المستخدم.');
    }
    if (previous.requestHash !== requestHash) {
      throw new RefundError(409, 'تعارض مفتاح منع التكرار: تم استخدام نفس المفتاح مع بيانات استرداد مختلفة.');
    }
    return JSON.parse(JSON.stringify(previous.responseBody));
  }

  const deposit = (state.securityDeposits || []).find(
    (sd: any) => sd.id === depositId || sd.bookingId === depositId || sd.leaseId === depositId
  );

  if (!deposit) {
    throw new RefundError(404, 'سجل التأمين غير موجود.');
  }

  let propertyId: string | null = null;
  if (deposit.bookingId) {
    const b = (state.bookings || []).find((x: any) => x.id === deposit.bookingId);
    const u = (state.units || []).find((x: any) => x.id === b?.unitId);
    propertyId = u?.propertyId || null;
  } else if (deposit.leaseId) {
    const l = (state.leases || []).find((x: any) => x.id === deposit.leaseId);
    const u = (state.units || []).find((x: any) => x.id === l?.unitId);
    propertyId = u?.propertyId || null;
  }

  if (
    actor.role !== 'SUPER_ADMIN' &&
    (!propertyId ||
      !(Array.isArray(actor.allowedProperties) &&
        (actor.allowedProperties.includes('all') || actor.allowedProperties.includes(propertyId))))
  ) {
    throw new RefundError(403, 'التأمين خارج نطاق صلاحياتك.');
  }

  if (deposit.status === 'refunded' || deposit.status === 'deducted') {
    throw new RefundError(400, 'تم استرداد أو خصم هذا التأمين بالكامل سلفاً.');
  }

  if (!['held', 'pending_refund', 'partially_refunded'].includes(deposit.status)) {
    throw new RefundError(400, 'حالة التأمين لا تسمح بهذه العملية.');
  }

  const collectedNum = Number(deposit.collectedAmount || deposit.amount || 0);
  const spentNum = Number(deposit.refundedAmount || 0) + Number(deposit.deductedAmount || 0);
  const availableNum = collectedNum - spentNum;
  const totalNum = Number(total.toString());

  if (totalNum > availableNum) {
    throw new RefundError(400, `المبلغ المطلوب (${totalNum.toFixed(2)} ر.س) يتجاوز الرصيد المتاح (${availableNum.toFixed(2)} ر.س).`);
  }

  const newRefunded = Number(deposit.refundedAmount || 0) + Number(refund.toString());
  const newDeducted = Number(deposit.deductedAmount || 0) + Number(deduction.toString());
  const remainingNum = collectedNum - newRefunded - newDeducted;

  const newStatus = remainingNum <= 0
    ? (newDeducted >= collectedNum ? 'deducted' : 'refunded')
    : 'partially_refunded';

  deposit.refundedAmount = newRefunded;
  deposit.deductedAmount = newDeducted;
  deposit.status = newStatus;
  deposit.deductionReason = reason || deposit.deductionReason;
  deposit.refundMethod = refund.gt(0) ? method : deposit.refundMethod;
  deposit.refundReference = refund.gt(0) ? reference : deposit.refundReference;
  deposit.refundType = refund.gt(0) ? String(input.refundType || 'actual_payout') : deposit.refundType;
  deposit.refundedByUserId = actor.id;
  deposit.refundedAt = new Date().toISOString();

  const transactionIds: string[] = [];
  let lastTransaction: any = null;

  if (refund.gt(0)) {
    lastTransaction = {
      id: `trans_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      depositId: deposit.id,
      type: 'refund',
      amount: Number(refund.toString()),
      method,
      reference,
      executedByUserId: actor.id,
      executedAt: new Date().toISOString(),
      status: 'completed',
      idempotencyKey: clientKey,
      notes: deduction.gt(0) ? `استرداد جزء من التأمين مع خصم بقيمة ${deduction.toFixed(2)} ر.س` : null
    };
    state.securityDepositTransactions.push(lastTransaction);
    transactionIds.push(lastTransaction.id);
  }

  if (deduction.gt(0)) {
    const dedTrans = {
      id: `trans_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      depositId: deposit.id,
      type: 'deduction',
      amount: Number(deduction.toString()),
      method: 'deduction',
      reference: reference || 'DEDUCTION-REF',
      reason,
      executedByUserId: actor.id,
      executedAt: new Date().toISOString(),
      status: 'completed',
      idempotencyKey: `${clientKey}:deduction`,
      notes: refund.gt(0) ? `خصم من التأمين مع استرداد بقيمة ${refund.toFixed(2)} ر.س` : null
    };
    if (!lastTransaction) lastTransaction = dedTrans;
    state.securityDepositTransactions.push(dedTrans);
    transactionIds.push(dedTrans.id);
  }

  const responsePayload: any = {
    success: true,
    depositId: deposit.id,
    status: deposit.status,
    refundedAmount: newRefunded.toFixed(2),
    deductedAmount: newDeducted.toFixed(2),
    availableBalance: remainingNum.toFixed(2),
    transactionIds,
    securityDeposit: JSON.parse(JSON.stringify(deposit)),
    transaction: lastTransaction,
    message: 'تمت معالجة استرداد التأمين وتوثيق الحركة المستقلة بنجاح.'
  };

  state.idempotencyRecords.push({
    id: `idem_${Date.now()}`,
    key: clientKey,
    operationType,
    userId: actor.id,
    requestHash,
    statusCode: 200,
    responseBody: JSON.parse(JSON.stringify(responsePayload)),
    createdAt: new Date().toISOString()
  });

  persistFallbackState();

  return responsePayload;
}
