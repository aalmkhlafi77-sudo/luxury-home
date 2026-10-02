import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from './db.js';

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
  depositId: unknown;
  actorId: unknown;
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
  if (!process.env.DATABASE_URL?.trim()) {
    throw new RefundError(
      503,
      'قاعدة البيانات غير متاحة. لم تُسجّل أي عملية مالية.',
    );
  }

  const depositId = requiredText(input.depositId, 'معرّف التأمين');
  const actorId = requiredText(input.actorId, 'معرّف المستخدم');

  const clientKey = requiredText(
    input.idempotencyKey,
    'مفتاح منع تكرار العملية',
    200,
  );

  const operationType = 'security_deposit_refund_v2';

  const operationKey = sha256(
    JSON.stringify([actorId, operationType, clientKey]),
  );

  const refund = money(input.refundAmount, 'مبلغ الاسترداد');
  const deduction = money(input.deductedAmount, 'مبلغ الخصم');
  const total = refund.plus(deduction);

  if (total.lte(0)) {
    throw new RefundError(400, 'يجب تحديد استرداد أو خصم موجب.');
  }

  const method = requiredText(
    input.refundMethod,
    'طريقة العملية',
    40,
  ).toLowerCase();

  if (!['bank_transfer', 'cash', 'deduction'].includes(method)) {
    throw new RefundError(
      400,
      'المتاح حالياً: توثيق استرداد بنكي أو نقدي، أو خصم.',
    );
  }

  if (
    input.refundType !== undefined &&
    input.refundType !== 'actual_payout'
  ) {
    throw new RefundError(400, 'نوع الاسترداد غير مدعوم حالياً.');
  }

  if (input.providerConfirmation !== undefined) {
    throw new RefundError(
      400,
      'لا يُقبل تأكيد بوابة الدفع من بيانات الطلب.',
    );
  }

  if (refund.gt(0) && method === 'deduction') {
    throw new RefundError(400, 'حدد طريقة صرف مبلغ الاسترداد.');
  }

  if (refund.eq(0) && method !== 'deduction') {
    throw new RefundError(400, 'استخدم deduction للخصم فقط.');
  }

  const reference = requiredText(
    input.refundReference,
    'مرجع إثبات الصرف أو مستند الخصم',
  );

  const reason = deduction.gt(0)
    ? requiredText(input.deductionReason, 'سبب الخصم', 2000)
    : null;

  const requestHash = sha256(
    JSON.stringify({
      depositId,
      refundAmount: refund.toFixed(2),
      deductedAmount: deduction.toFixed(2),
      deductionReason: reason,
      refundMethod: method,
      refundReference: reference,
      refundType: 'actual_payout',
    }),
  );

  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw<Array<{ ok: number }>>`
        SELECT 1 AS ok
        FROM (
          SELECT pg_advisory_xact_lock(
            hashtextextended(${operationKey}, 0)
          )
        ) AS operation_lock
      `;

      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "SecurityDepositRecord"
        WHERE "id" = ${depositId}
        FOR UPDATE
      `;

      if (locked.length !== 1) {
        throw new RefundError(404, 'سجل التأمين غير موجود.');
      }

      // القراءة المعتمدة للحساب تتم بعد الحصول على القفل.
      const deposit = await tx.securityDepositRecord.findUnique({
        where: { id: depositId },
        include: {
          booking: {
            select: { unit: { select: { propertyId: true } } },
          },
          lease: {
            select: { unit: { select: { propertyId: true } } },
          },
        },
      });

      if (!deposit) {
        throw new RefundError(404, 'سجل التأمين غير موجود.');
      }

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

      if (!actor?.isActive) {
        throw new RefundError(401, 'المستخدم غير موجود أو غير نشط.');
      }

      if (
        !['SUPER_ADMIN', 'ACCOUNTANT', 'PROPERTY_MANAGER']
          .includes(actor.role)
      ) {
        throw new RefundError(403, 'غير مخول بتنفيذ العملية.');
      }

      if (Boolean(deposit.bookingId) === Boolean(deposit.leaseId)) {
        throw new RefundError(
          409,
          'يجب ربط التأمين بحجز واحد أو عقد واحد حصراً.',
        );
      }

      const propertyId =
        deposit.booking?.unit?.propertyId ??
        deposit.lease?.unit?.propertyId;

      if (!propertyId) {
        throw new RefundError(409, 'تعذر تحديد المبنى المرتبط بالتأمين.');
      }

      if (
        actor.role !== 'SUPER_ADMIN' &&
        !actor.allowedProperties.includes('all') &&
        !actor.allowedProperties.includes(propertyId)
      ) {
        throw new RefundError(403, 'التأمين خارج نطاق صلاحياتك.');
      }

      // إعادة النتيجة السابقة لا تتم إلا بعد فحص الصلاحية الحالية.
      const previous = await tx.idempotencyRecord.findUnique({
        where: {
          key_operationType: {
            key: operationKey,
            operationType,
          },
        },
      });

      if (previous) {
        if (previous.userId !== actor.id) {
          throw new RefundError(403, 'مفتاح العملية لا يخص المستخدم.');
        }

        if (previous.requestHash !== requestHash) {
          throw new RefundError(
            409,
            'استُخدم مفتاح العملية نفسه مع بيانات مختلفة.',
          );
        }

        return previous.responseBody;
      }

      if (
        !deposit.collectionVerifiedAt ||
        !deposit.collectionReference?.trim()
      ) {
        throw new RefundError(
          409,
          'لم يُوثّق تحصيل هذا التأمين. لا يمكن استرداده أو الخصم منه.',
        );
      }

      if (
        !['held', 'pending_refund', 'partially_refunded']
          .includes(deposit.status)
      ) {
        throw new RefundError(409, 'حالة التأمين لا تسمح بالعملية.');
      }

      const collected = new Prisma.Decimal(deposit.collectedAmount);
      const spent = deposit.refundedAmount.plus(deposit.deductedAmount);

      if (
        collected.lte(0) ||
        deposit.refundedAmount.lt(0) ||
        deposit.deductedAmount.lt(0) ||
        spent.gt(collected)
      ) {
        throw new RefundError(409, 'رصيد التأمين يحتاج مراجعة موثقة.');
      }

      const available = collected.minus(spent);

      if (total.gt(available)) {
        throw new RefundError(
          400,
          `المبلغ المطلوب يتجاوز الرصيد المتاح ${available.toFixed(2)} ر.س.`,
        );
      }

      const refundedTotal = deposit.refundedAmount.plus(refund);
      const deductedTotal = deposit.deductedAmount.plus(deduction);
      const remaining = collected.minus(refundedTotal).minus(deductedTotal);

      const status = remaining.eq(0)
        ? (refundedTotal.eq(0) ? 'deducted' : 'refunded')
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
          refundType: refund.gt(0) ? 'actual_payout' : deposit.refundType,
          refundedByUserId: refund.gt(0) ? actor.id : deposit.refundedByUserId,
          refundedAt: refund.gt(0) ? new Date() : deposit.refundedAt,
        },
      });

      const transactionIds: string[] = [];

      if (refund.gt(0)) {
        const movement = await tx.securityDepositTransaction.create({
          data: {
            depositId: deposit.id,
            type: 'refund',
            amount: refund,
            method,
            reference,
            executedByUserId: actor.id,
            status: 'completed',
            idempotencyKey: sha256(`${operationKey}:refund`),
          },
        });
        transactionIds.push(movement.id);
      }

      if (deduction.gt(0)) {
        const movement = await tx.securityDepositTransaction.create({
          data: {
            depositId: deposit.id,
            type: 'deduction',
            amount: deduction,
            method: 'deduction',
            reference,
            reason,
            executedByUserId: actor.id,
            status: 'completed',
            idempotencyKey: sha256(`${operationKey}:deduction`),
          },
        });
        transactionIds.push(movement.id);
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

      const responsePayload = {
        success: true,
        depositId: deposit.id,
        status: updated.status,
        refundedAmount: refundedTotal.toFixed(2),
        deductedAmount: deductedTotal.toFixed(2),
        availableBalance: remaining.toFixed(2),
        transactionIds,
      };

      await tx.idempotencyRecord.create({
        data: {
          key: operationKey,
          operationType,
          userId: actor.id,
          requestHash,
          responseBody: responsePayload,
        },
      });

      return responsePayload;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      maxWait: 5000,
      timeout: 15000,
    },
  );
}

type ApplyRentInput = {
  depositId: unknown;
  installmentId: unknown;
  amount: unknown;
  reason: unknown;
  actorId: unknown;
  idempotencyKey?: unknown;
};

export async function applyDepositToRent(input: ApplyRentInput) {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new RefundError(
      503,
      'قاعدة البيانات غير متاحة. لم تُسجّل أي عملية مالية.',
    );
  }

  const depositId = requiredText(input.depositId, 'معرّف التأمين');
  const installmentId = requiredText(input.installmentId, 'معرّف القسط المالي المستهدف');
  const actorId = requiredText(input.actorId, 'معرّف المستخدم');
  const clientKey = requiredText(
    input.idempotencyKey,
    'مفتاح منع تكرار العملية',
    200,
  );

  const operationType = 'security_deposit_apply_to_rent_v1';
  const operationKey = sha256(
    JSON.stringify([actorId, operationType, clientKey]),
  );

  const applyAmount = money(input.amount, 'مبلغ التسوية');
  if (applyAmount.lte(0)) {
    throw new RefundError(400, 'يجب تحديد مبلغ تسوية موجب أكبر من الصفر.');
  }

  const reason = requiredText(input.reason, 'سبب ومبرر التسوية المعتمد', 1000);

  const requestHash = sha256(
    JSON.stringify({
      depositId,
      installmentId,
      amount: applyAmount.toFixed(2),
      reason,
    }),
  );

  return prisma.$transaction(
    async (tx) => {
      // 1. Advisory Lock on operationKey
      await tx.$queryRaw<Array<{ ok: number }>>`
        SELECT 1 AS ok
        FROM (
          SELECT pg_advisory_xact_lock(
            hashtextextended(${operationKey}, 0)
          )
        ) AS operation_lock
      `;

      // 2. Lock records in a stable deterministic order to prevent deadlock
      if (depositId < installmentId) {
        await tx.$queryRaw`SELECT "id" FROM "SecurityDepositRecord" WHERE "id" = ${depositId} FOR UPDATE`;
        await tx.$queryRaw`SELECT "id" FROM "LeaseInstallment" WHERE "id" = ${installmentId} FOR UPDATE`;
      } else {
        await tx.$queryRaw`SELECT "id" FROM "LeaseInstallment" WHERE "id" = ${installmentId} FOR UPDATE`;
        await tx.$queryRaw`SELECT "id" FROM "SecurityDepositRecord" WHERE "id" = ${depositId} FOR UPDATE`;
      }

      // 3. Fetch after lock
      const deposit = await tx.securityDepositRecord.findUnique({
        where: { id: depositId },
        include: {
          booking: {
            select: { unit: { select: { propertyId: true } } },
          },
          lease: {
            select: { unit: { select: { propertyId: true } } },
          },
        },
      });

      if (!deposit) {
        throw new RefundError(404, 'سجل التأمين غير موجود.');
      }

      const installment = await tx.leaseInstallment.findUnique({
        where: { id: installmentId },
        include: {
          lease: true,
        },
      });

      if (!installment) {
        throw new RefundError(404, 'الدفعة المالية / القسط المستهدف غير موجود.');
      }

      // 4. Verify Authorization & Roles
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

      if (!actor?.isActive) {
        throw new RefundError(401, 'المستخدم غير موجود أو غير نشط.');
      }

      if (
        !['SUPER_ADMIN', 'ACCOUNTANT', 'PROPERTY_MANAGER']
          .includes(actor.role)
      ) {
        throw new RefundError(403, 'غير مخول بتنفيذ العملية.');
      }

      const propertyId =
        deposit.booking?.unit?.propertyId ??
        deposit.lease?.unit?.propertyId;

      if (!propertyId) {
        throw new RefundError(409, 'تعذر تحديد المبنى المرتبط بالتأمين.');
      }

      if (
        actor.role !== 'SUPER_ADMIN' &&
        !actor.allowedProperties.includes('all') &&
        !actor.allowedProperties.includes(propertyId)
      ) {
        throw new RefundError(403, 'التأمين خارج نطاق صلاحياتك.');
      }

      // 5. Check Idempotency Record
      const previous = await tx.idempotencyRecord.findUnique({
        where: {
          key_operationType: {
            key: operationKey,
            operationType,
          },
        },
      });

      if (previous) {
        if (previous.userId !== actor.id) {
          throw new RefundError(403, 'مفتاح العملية لا يخص المستخدم.');
        }

        if (previous.requestHash !== requestHash) {
          throw new RefundError(
            409,
            'استُخدم مفتاح العملية نفسه مع بيانات مختلفة للطلب المالي.',
          );
        }

        return previous.responseBody;
      }

      // 6. Validate Collection Status
      if (
        !deposit.collectionVerifiedAt ||
        !deposit.collectionReference?.trim()
      ) {
        throw new RefundError(
          409,
          'لم يُوثّق تحصيل هذا التأمين. لا يمكن استرداده أو تسويته.',
        );
      }

      if (
        !['held', 'pending_refund', 'partially_refunded']
          .includes(deposit.status)
      ) {
        throw new RefundError(409, 'حالة التأمين لا تسمح بإجراء تسوية.');
      }

      // 7. Match lease constraints
      if (deposit.leaseId && installment.leaseId !== deposit.leaseId) {
        throw new RefundError(
          409,
          'القسط المالي المستهدف لا يخص عقد الإيجار المرتبط بهذه الوديعة.',
        );
      }

      // 8. Reconcile Balances
      const collected = new Prisma.Decimal(deposit.collectedAmount);
      const spent = deposit.refundedAmount.plus(deposit.deductedAmount);

      if (
        collected.lte(0) ||
        deposit.refundedAmount.lt(0) ||
        deposit.deductedAmount.lt(0) ||
        spent.gt(collected)
      ) {
        throw new RefundError(409, 'رصيد التأمين يحتاج مراجعة موثقة.');
      }

      const available = collected.minus(spent);
      if (applyAmount.gt(available)) {
        throw new RefundError(
          400,
          `المبلغ المطلوب يتجاوز الرصيد المتاح للتأمين وهو ${available.toFixed(2)} ر.س.`,
        );
      }

      const remInstallment = new Prisma.Decimal(installment.remainingAmount);
      if (applyAmount.gt(remInstallment)) {
        throw new RefundError(
          400,
          `مبلغ التسوية المطلوب يتجاوز المبلغ المتبقي على القسط وهو ${remInstallment.toFixed(2)} ر.س.`,
        );
      }

      // 9. Execute Updates
      const refundedTotal = deposit.refundedAmount;
      const deductedTotal = deposit.deductedAmount.plus(applyAmount);
      const remaining = collected.minus(refundedTotal).minus(deductedTotal);

      const depositStatus = remaining.eq(0)
        ? (refundedTotal.eq(0) ? 'claimed_for_damage' : 'fully_refunded')
        : 'partially_refunded';

      const updatedDeposit = await tx.securityDepositRecord.update({
        where: { id: deposit.id },
        data: {
          deductedAmount: deductedTotal,
          status: depositStatus,
          deductionReason: reason,
        },
      });

      // Credit the installment
      const installmentPaid = new Prisma.Decimal(installment.paidAmount).plus(applyAmount);
      const installmentRemaining = new Prisma.Decimal(installment.amount).minus(installmentPaid);
      const installmentStatus = installmentRemaining.eq(0) ? 'PAID' : 'PARTIALLY_PAID';

      await tx.leaseInstallment.update({
        where: { id: installment.id },
        data: {
          paidAmount: installmentPaid,
          remainingAmount: installmentRemaining,
          status: installmentStatus as any,
          paidAt: installmentRemaining.eq(0) ? new Date() : installment.paidAt,
        },
      });

      // 10. Record SecurityDepositTransaction of type 'rent_application'
      const movement = await tx.securityDepositTransaction.create({
        data: {
          depositId: deposit.id,
          type: 'rent_application',
          amount: applyAmount,
          method: 'deduction',
          reference: `SETTLE-LEASE-${installment.lease.contractNumber}`,
          reason,
          executedByUserId: actor.id,
          status: 'completed',
          idempotencyKey: sha256(`${operationKey}:rent_apply`),
        },
      });

      // Record rent payment record too so it shows up in general payments as settled from deposit
      const paymentRec = await tx.paymentRecord.create({
        data: {
          leaseId: installment.leaseId,
          amount: applyAmount,
          paymentMethod: 'bank_transfer',
          referenceNo: `SETTLE-DEP-${deposit.id}`,
          receiptNo: `DEP-SETTLE-${Date.now()}`,
          status: 'completed',
          isVerified: true,
          paidAt: new Date(),
          notes: `تسوية جزء من مبلغ التأمين لسداد قسط العقد #${installment.lease.contractNumber} بسبب (${reason})`,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actor.id,
          userName: actor.username,
          action: 'تسوية تأمين مقابل قسط إيجاري',
          module: 'التأمينات',
          details: JSON.stringify({
            depositId: deposit.id,
            propertyId,
            installmentId: installment.id,
            leaseId: installment.leaseId,
            amount: applyAmount.toFixed(2),
            reason,
            transactionId: movement.id,
            paymentRecordId: paymentRec.id,
          }),
        },
      });

      const responsePayload = {
        success: true,
        depositId: deposit.id,
        installmentId: installment.id,
        status: updatedDeposit.status,
        deductedAmount: deductedTotal.toFixed(2),
        availableBalance: remaining.toFixed(2),
        transactionIds: [movement.id],
      };

      await tx.idempotencyRecord.create({
        data: {
          key: operationKey,
          operationType,
          userId: actor.id,
          requestHash,
          responseBody: responsePayload,
        },
      });

      return responsePayload;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      maxWait: 5000,
      timeout: 15000,
    },
  );
}
