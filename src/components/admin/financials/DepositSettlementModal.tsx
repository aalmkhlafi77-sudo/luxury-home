import React, { useState } from 'react';
import { useAppStore, loadAuthoritativeServerState } from '../../../store/useAppStore';
import { X, ShieldAlert, AlertCircle, CheckCircle2 } from 'lucide-react';

interface Props {
  initialDepositId?: string;
  initialLeaseId?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

interface SettlementPayload {
  leaseId: string;
  installmentId: string;
  amount: number;
  reason?: string;
  approvalReference: string;
  authorizedBy: string;
}

type PendingOperation<T> = {
  version: 1;
  userId: string;
  depositId: string;
  key: string;
  payload: T;
};

function requireUserId(userId: unknown): string {
  if (typeof userId !== 'string' || !userId.trim()) {
    throw new Error('تعذر التحقق من المستخدم الحالي. سجّل الدخول مجدداً.');
  }
  return userId.trim();
}

function pendingStorageKey(userId: string): string {
  return `luxury:deposit-settlement:pending:v1:${userId}`;
}

function savePending<T>(
  currentUserId: string,
  operation: PendingOperation<T>,
) {
  const userId = requireUserId(currentUserId);
  if (operation.userId !== userId) {
    throw new Error('لا يمكن حفظ طلب يخص مستخدماً آخر.');
  }
  localStorage.setItem(
    pendingStorageKey(userId),
    JSON.stringify(operation),
  );
}

function loadPending<T>(currentUserId: string): PendingOperation<T> | null {
  try {
    const userId = requireUserId(currentUserId);
    const saved = localStorage.getItem(pendingStorageKey(userId));
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    if (parsed.version === 1 && parsed.userId === userId) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function removePending(currentUserId: string) {
  try {
    const userId = requireUserId(currentUserId);
    localStorage.removeItem(pendingStorageKey(userId));
  } catch {
    // Ignore error on invalid user
  }
}

function assertPendingOwner<T>(
  currentUserId: unknown,
  operation: PendingOperation<T>,
) {
  const userId = requireUserId(currentUserId);
  if (operation.userId !== userId) {
    throw new Error('هذه العملية تخص جلسة مستخدم آخر. لم يُرسل أي طلب.');
  }
}

export const DepositSettlementModal: React.FC<Props> = ({
  initialDepositId,
  initialLeaseId,
  onClose,
  onSuccess,
}) => {
  const { state, settleSecurityDepositAgainstRent } = useAppStore();

  const getCurrentUser = () => {
    try {
      const rawProfile = localStorage.getItem('luxury_home_user_profile');
      if (rawProfile) return JSON.parse(rawProfile);
      const raw = localStorage.getItem('luxury_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const getActiveUserId = (user: any): string => {
    if (typeof user?.id === 'string' && user.id.trim()) {
      return user.id.trim();
    }
    if (typeof user?.userId === 'string' && user.userId.trim()) {
      return user.userId.trim();
    }
    return '';
  };

  const currentAuthUser = getCurrentUser();
  const currentUserId = getActiveUserId(currentAuthUser);

  const [pendingSettleOp, setPendingSettleOp] = useState<PendingOperation<SettlementPayload> | null>(() => {
    if (!currentUserId) return null;
    return loadPending<SettlementPayload>(currentUserId);
  });

  const updatePendingSettleOp = (op: PendingOperation<SettlementPayload> | null) => {
    setPendingSettleOp(op);
    const user = getCurrentUser();
    const uid = getActiveUserId(user);
    if (op && uid) {
      savePending(uid, op);
    } else if (uid) {
      removePending(uid);
    }
  };

  const [depositId, setDepositId] = useState<string>(
    pendingSettleOp?.depositId || initialDepositId || state.securityDeposits[0]?.id || ''
  );
  const [installmentId, setInstallmentId] = useState<string>(pendingSettleOp?.payload.installmentId || '');
  const [amount, setAmount] = useState<number>(pendingSettleOp?.payload.amount || 0);
  const [reason, setReason] = useState<string>(
    pendingSettleOp?.payload.reason || 'اقتطاع وديعة التأمين لتغطية المستحقات المتأخرة بالاتفاق'
  );
  const [approvalReference, setApprovalReference] = useState<string>(
    pendingSettleOp?.payload.approvalReference || ''
  );

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [canClearPending, setCanClearPending] = useState(false);

  const selectedDeposit = state.securityDeposits.find(d => d.id === depositId);
  const collected = Number((selectedDeposit as any)?.collectedAmount || 0);
  const refunded = Number((selectedDeposit as any)?.refundedAmount || (selectedDeposit as any)?.refundAmount || 0);
  const deducted = Number((selectedDeposit as any)?.deductedAmount || (selectedDeposit?.deductions || []).reduce((s, x) => s + x.amount, 0));
  const rentApplied = Number((selectedDeposit as any)?.rentAppliedAmount || 0);
  const availableDeposit = selectedDeposit ? Math.max(0, collected - refunded - deducted - rentApplied) : 0;

  // Find target lease
  const targetLease = state.leases.find(
    l => l.id === selectedDeposit?.bookingOrLeaseId || l.id === initialLeaseId
  );
  const pendingInstallments = targetLease?.installments.filter(i => i.remainingAmount > 0) || [];

  const executeSettle = async (op: NonNullable<typeof pendingSettleOp>) => {
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    let isConfirmedRejection = false;

    try {
      const activeUser = getCurrentUser();
      const activeUid = getActiveUserId(activeUser);
      if (!activeUid) {
        throw new Error('تعذر التحقق من معرف المستخدم الحالي. سجّل الدخول مجدداً.');
      }
      assertPendingOwner(activeUid, op);

      await settleSecurityDepositAgainstRent({
        depositId: op.depositId,
        leaseId: op.payload.leaseId,
        installmentId: op.payload.installmentId,
        amount: op.payload.amount,
        reason: op.payload.reason || 'تسوية قسط إيجار',
        approvalReference: op.payload.approvalReference,
        authorizedBy: activeUser?.name || 'المسؤول المالي',
        idempotencyKey: op.key,
      });

      updatePendingSettleOp(null);
      setCanClearPending(true);
      setSuccessMsg('تم تسجيل وتوثيق عملية التسوية والسداد بنجاح في الخادم.');

      try {
        await loadAuthoritativeServerState(true);
      } catch {
        setSuccessMsg(
          'تهانينا، تم تسجيل وحفظ عملية التسوية بنجاح في الخادم، ولكن تعذر تحديث عرض الشاشة تلقائياً بسبب انقطاع اتصال مؤقت. يرجى تحديث الصفحة يدوياً لاحقاً.'
        );
      }

      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 3500);

    } catch (err: any) {
      if (err.status >= 400 && err.status < 500 && err.result && typeof err.result === 'object') {
        isConfirmedRejection = true;
      }

      if (isConfirmedRejection) {
        setCanClearPending(true);
        updatePendingSettleOp(null); // Clear key on absolute terminal rejection
        setErrorMsg(err.message || 'تم رفض عملية التسوية من الخادم.');
      } else {
        setCanClearPending(false);
        setErrorMsg(
          `${err.message || 'تعذر الاتصال بالخادم.'} تم الاحتفاظ بمفتاح العملية الأصلي والحمولة في التخزين المحلي لإعادة المحاولة بأمان دون فقدها.`
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!selectedDeposit || !targetLease) return;

    setErrorMsg(null);
    if (amount <= 0) {
      setErrorMsg('المبلغ المطلوب تسويته يجب أن يكون أكبر من الصفر.');
      return;
    }
    if (amount > availableDeposit) {
      setErrorMsg(
        `تعذر إتمام التسوية، المبلغ الموزع أكبر من رصيد التأمين المحتجز المتاح وهو (${availableDeposit} ر.س)`
      );
      return;
    }
    if (!installmentId) {
      setErrorMsg('يرجى اختيار الدفعة المالية المستهدفة بالسداد.');
      return;
    }
    if (!approvalReference.trim()) {
      setErrorMsg('يرجى إدخال مرجع الاعتماد المالي الرسمي (رقم المحضر / قرار الإدارة).');
      return;
    }

    const activeUser = getCurrentUser();
    const activeUid = getActiveUserId(activeUser);
    if (!activeUid) {
      setErrorMsg('تعذر التحقق من معرف المستخدم الثابت. يرجى تسجيل الدخول مجدداً.');
      return;
    }

    const op: PendingOperation<SettlementPayload> = {
      version: 1,
      userId: activeUid,
      depositId,
      key: crypto.randomUUID(),
      payload: {
        leaseId: targetLease.id,
        installmentId,
        amount,
        reason: reason.trim(),
        approvalReference: approvalReference.trim(),
        authorizedBy: activeUser?.name || 'المسؤول المالي',
      },
    };

    updatePendingSettleOp(op);
    await executeSettle(op);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-3xl border border-[#E3DCCD] shadow-2xl overflow-hidden text-xs text-right">
        {/* Header */}
        <div className="p-5 border-b border-[#E3DCCD] flex items-center justify-between bg-amber-50">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-700" />
            <div>
              <h3 className="text-sm font-bold text-amber-950">تسوية واقتطاع من مبلغ تأمين السكن</h3>
              <p className="text-[11px] text-amber-800">
                تسوية واقتطاع وديعة التأمين الأمنية المعزولة لسداد المتأخرات الإيجارية بالاتفاق مع المستأجر
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="p-1 hover:bg-amber-200/50 rounded-xl cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4 text-[#68675F]" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-center gap-2 text-right">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-center gap-2 text-right">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {pendingSettleOp ? (
            <div className="space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-2 text-right">
                <p className="font-bold text-amber-900 text-xs flex items-center gap-1.5">
                  <AlertCircle className="w-4.5 h-4.5 text-amber-600 shrink-0" />
                  <span>تنبيه: توجد محاولة تسوية معلّقة سابقة لم يتم تأكيد نجاحها!</span>
                </p>
                <div className="text-[11px] text-[#68675F] space-y-1 bg-white p-3 rounded-xl border border-[#E3DCCD]">
                  <div><strong>مبلغ التسوية المطلوبة:</strong> {pendingSettleOp.payload.amount} ر.س</div>
                  <div><strong>المبرر والسبب:</strong> {pendingSettleOp.payload.reason}</div>
                  <div><strong>المسؤول المعتمد:</strong> {pendingSettleOp.payload.authorizedBy}</div>
                  <div className="font-mono text-[9px] text-gray-500 mt-1 border-t border-gray-100 pt-1">
                    <strong>مفتاح المحاولة:</strong> {pendingSettleOp.key}
                  </div>
                </div>
                <p className="text-[10px] text-amber-800 mt-2">
                  يجب إعادة إرسال هذه المحاولة مجدداً بنفس المفتاح والبيانات لضمان عدم حدوث ازدواجية مالية، أو إلغاؤها عند التأكد التام من رفضها.
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-3 border-t border-[#E3DCCD]">
                <button
                  type="button"
                  onClick={async () => {
                    if (pendingSettleOp) {
                      await executeSettle(pendingSettleOp);
                    }
                  }}
                  disabled={saving}
                  className="w-full py-2.5 bg-amber-700 hover:bg-amber-800 text-white rounded-xl font-bold cursor-pointer text-center text-xs disabled:opacity-50"
                >
                  {saving ? 'جاري إعادة الإرسال والاستعلام...' : 'إعادة إرسال الطلب المعلّق بأمان بنفس المفتاح لاسترجاع النتيجة'}
                </button>
                {canClearPending ? (
                  <button
                    type="button"
                    onClick={() => {
                      updatePendingSettleOp(null);
                      setErrorMsg(null);
                      setSuccessMsg(null);
                      setInstallmentId('');
                      setAmount(0);
                    }}
                    className="w-full py-2 border border-[#E3DCCD] bg-white text-gray-700 hover:bg-gray-50 rounded-xl font-semibold cursor-pointer text-center text-xs"
                  >
                    بدء محاولة جديدة (بعد تأكيد انتهاء المحاولة السابقة)
                  </button>
                ) : (
                  <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-[10px] text-gray-600 text-center space-y-1">
                    <p className="font-semibold text-gray-800">
                      لحماية السجلات المحاسبية: لا يمكن مسح مفتاح الطلب المعلق عند وجود نتيجة مجهولة.
                    </p>
                    <p>
                      إغلاق النافذة أو التنقل لا يلغي العملية. أعد إرسال الطلب أعلاه بنفس المفتاح بأمان للتحقق من اعتمادها أو الحصول على رفض قاطع.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-[#282824] mb-1">
                  اختر وديعة التأمين المعلقة الصالحة
                </label>
                <select
                  value={depositId}
                  onChange={(e) => {
                    setDepositId(e.target.value);
                    setInstallmentId('');
                    setAmount(0);
                  }}
                  className="w-full bg-[#FAF8F5] border border-[#E3DCCD] rounded-xl px-3 py-2 text-xs font-semibold cursor-pointer"
                >
                  <option value="">-- اختر وديعة تأمين معلقة --</option>
                  {state.securityDeposits
                    .filter(d => d.status === 'held' || d.status === 'partially_refunded')
                    .map(d => (
                      <option key={d.id} value={d.id}>
                        {d.guestName} - وديعة #{d.id} (المتاح: {d.amount - (d.deductions?.reduce((s: number, x: any) => s + x.amount, 0) || 0)} ر.س)
                      </option>
                    ))}
                </select>
              </div>

              <div className="p-3 bg-[#FAF8F5] rounded-2xl border border-[#E3DCCD] flex items-center justify-between">
                <span className="text-[11px] text-[#68675F]">رصيد التأمين الأمني المتاح للاقتطاع:</span>
                <span className="text-base font-black text-amber-950 tabular-nums">
                  {availableDeposit.toLocaleString('ar-SA')} ر.س
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#282824] mb-1">
                  توجيه وسداد القسط الإيجاري المستهدف
                </label>
                <select
                  value={installmentId}
                  onChange={(e) => {
                    setInstallmentId(e.target.value);
                    const inst = pendingInstallments.find(i => i.id === e.target.value);
                    if (inst) {
                      setAmount(Math.min(inst.remainingAmount, availableDeposit));
                    }
                  }}
                  className="w-full bg-[#FAF8F5] border border-[#E3DCCD] rounded-xl px-3 py-2 text-xs cursor-pointer"
                  required
                >
                  <option value="">-- اختر قسط متأخر من القائمة للتغطية --</option>
                  {pendingInstallments.map(i => (
                    <option key={i.id} value={i.id}>
                      {i.label || `الدفعة رقم #${i.installmentNumber}`} (المستحق: {i.remainingAmount} ر.س | الموعد: {i.dueDate})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#282824] mb-1">
                  المبلغ المراد اقتطاعه وتسويته (ر.س) *
                </label>
                <input
                  type="number"
                  min="0.01"
                  max={availableDeposit}
                  step="0.01"
                  value={amount || ''}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-sm font-black text-[#282824] text-left focus:outline-none"
                  required
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#282824] mb-1">
                  سبب ومبرر تسوية التأمين المعتمد
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E3DCCD] rounded-xl px-3 py-2 text-xs text-right focus:outline-none focus:border-[#B69A68]"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#282824] mb-1">
                  مرجع الاعتماد المالي الرسمي (رقم المحضر / قرار الإدارة) *
                </label>
                <input
                  type="text"
                  placeholder="مثال: محضر تسوية رقم DEC-2026-088"
                  value={approvalReference}
                  onChange={(e) => setApprovalReference(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E3DCCD] rounded-xl px-3 py-2 text-xs text-right focus:outline-none focus:border-[#B69A68]"
                  required
                />
                <span className="text-[10px] text-[#68675F] block mt-0.5">
                  المنفذ المسجل: مسؤول الجلسة الحالي النشط (موثق تلقائياً في سجل التدقيق المالي)
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E3DCCD]">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="px-4 py-2 bg-[#F7F3EB] text-[#282824] rounded-xl font-medium cursor-pointer disabled:opacity-50"
                >
                  تراجع وإلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving || !selectedDeposit || !installmentId}
                  className="px-5 py-2 bg-amber-800 hover:bg-amber-900 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <span>{saving ? 'جاري الاتصال بالخادم...' : 'تأكيد اقتطاع رصيد التأمين'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
