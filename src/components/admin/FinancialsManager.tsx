import React, { useState } from 'react';
import { useAppStore, loadAuthoritativeServerState } from '../../store/useAppStore';
import {
  CreditCard,
  ShieldCheck,
  FileText,
  TrendingUp,
  Building2,
  AlertCircle,
  Plus,
  Receipt,
  TrendingDown,
  Sliders
} from 'lucide-react';
import { TenantStatementView } from './financials/TenantStatementView';
import { OversightReportsView } from './financials/OversightReportsView';
import { NOIProfitabilityView } from './financials/NOIProfitabilityView';
import { ExpenseLedgerView } from './financials/ExpenseLedgerView';
import { CashOutflowView } from './financials/CashOutflowView';
import { ExpenseCategoriesManager } from './financials/ExpenseCategoriesManager';
import { PaymentAllocationModal } from './financials/PaymentAllocationModal';
import { AdjustmentModal } from './financials/AdjustmentModal';
import { DepositSettlementModal } from './financials/DepositSettlementModal';
import { CurrencyAmount, formatDate } from '../../utils/formatters';

export const FinancialsManager: React.FC = () => {
  const { state } = useAppStore();
  const [activeTab, setActiveTab] = useState<
    'statement' | 'oversight' | 'profitability' | 'expenses' | 'cash_outflow' | 'categories_rules' | 'deposits' | 'payments'
  >('statement');

  // Modals state
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState<boolean>(false);
  const [showDepositSettleModal, setShowDepositSettleModal] = useState<boolean>(false);
  const [modalTenantId, setModalTenantId] = useState<string | undefined>(undefined);
  const [modalLeaseId, setModalLeaseId] = useState<string | undefined>(undefined);
  const [modalDepositId, setModalDepositId] = useState<string | undefined>(undefined);

  // Deposit deduction modal state
  const [deductModalDepositId, setDeductModalDepositId] = useState<string | null>(null);
  const [deductAmount, setDeductAmount] = useState<string>('');
  const [deductReason, setDeductReason] = useState<string>('');
  const [deductReference, setDeductReference] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const pendingOperation = React.useRef<{
    depositId: string;
    key: string;
    payload: {
      refundAmount: string;
      deductedAmount: string;
      deductionReason?: string;
      refundMethod: 'bank_transfer' | 'cash' | 'deduction';
      refundReference: string;
      refundType: 'actual_payout';
    };
  } | null>(null);

  const submitting = React.useRef(false);

  const selectedDeposit = state.securityDeposits.find(d => d.id === deductModalDepositId);

  const openDeductionModal = (depositId: string) => {
    if (pendingOperation.current && pendingOperation.current.depositId !== depositId) {
      alert('يوجد عملية معلّقة لتأمين آخر. يرجى إكمالها أو حلها أولاً.');
      return;
    }
    // Only reset fields if there is no pending operation for this deposit!
    if (!pendingOperation.current) {
      setDeductAmount('');
      setDeductReason('');
      setDeductReference('');
    }
    setErrorMsg(null);
    setSuccessMsg(null);
    setDeductModalDepositId(depositId);
  };

  async function submitDepositOp(payload: {
    depositId: string;
    refundAmount: string;
    deductedAmount: string;
    deductionReason?: string;
    refundMethod: 'bank_transfer' | 'cash' | 'deduction';
    refundReference: string;
    refundType: 'actual_payout';
  }) {
    if (submitting.current) return;

    if (!pendingOperation.current || pendingOperation.current.depositId !== payload.depositId) {
      pendingOperation.current = {
        depositId: payload.depositId,
        key: crypto.randomUUID(),
        payload: {
          refundAmount: payload.refundAmount,
          deductedAmount: payload.deductedAmount,
          deductionReason: payload.deductionReason,
          refundMethod: payload.refundMethod,
          refundReference: payload.refundReference,
          refundType: payload.refundType,
        },
      };
    }

    submitting.current = true;
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    let isConfirmedRejection = false;
    try {
      const op = pendingOperation.current;
      const token = localStorage.getItem('luxury_token') || '';

      let response;
      try {
        response = await fetch(
          `/api/security-deposits/${encodeURIComponent(op.depositId)}/refund`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
              'X-Idempotency-Key': op.key,
            },
            body: JSON.stringify(op.payload),
          },
        );
      } catch (netErr) {
        throw new Error('فشل في الاتصال بالخادم. يرجى المحاولة مرة أخرى لإرسال نفس مفتاح العملية بأمان.');
      }

      const result = await response.json().catch(() => null);

      if (response.status >= 400 && response.status < 500) {
        // Only treat as confirmed rejection if the response contains a JSON body with success indicator
        if (result && typeof result === 'object' && ('success' in result || 'message' in result)) {
          isConfirmedRejection = true;
        }
      }

      if (!response.ok || result?.success !== true) {
        throw new Error(result?.message ?? `خطأ من الخادم (رمز الحالة: ${response.status})`);
      }

      pendingOperation.current = null;
      setDeductModalDepositId(null);
      setSuccessMsg('تم تسجيل وتوثيق العملية في الخادم بنجاح.');

      try {
        await loadAuthoritativeServerState(true);
      } catch (stateErr) {
        setSuccessMsg('تهانينا، تم تسجيل وحفظ العملية المالية بنجاح في الخادم، ولكن تعذر تحديث قائمة البيانات المعروضة حالياً بسبب فشل شبكة مؤقت. يرجى تحديث الصفحة يدوياً لاحقاً.');
      }
    } catch (error) {
      if (isConfirmedRejection) {
        pendingOperation.current = null;
        setErrorMsg(
          error instanceof Error ? error.message : 'تم رفض العملية من الخادم.',
        );
      } else {
        setErrorMsg(
          `${error instanceof Error ? error.message : 'تعذر الاتصال بالخادم.'} تم الاحتفاظ بمفتاح العملية الأصلي لإعادة المحاولة بأمان.`
        );
      }
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  const handleDeductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deductModalDepositId) return;

    const parsedAmount = parseFloat(deductAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg('الرجاء إدخال مبلغ اقتطاع صحيح أكبر من الصفر.');
      return;
    }

    if (!deductReason.trim()) {
      setErrorMsg('الرجاء إدخال وصف مبرر الاقتطاع.');
      return;
    }

    if (!deductReference.trim()) {
      setErrorMsg('الرجاء إدخال مرجع إثبات الصرف أو مستند الخصم.');
      return;
    }

    await submitDepositOp({
      depositId: deductModalDepositId,
      refundAmount: '0.00',
      deductedAmount: parsedAmount.toFixed(2),
      deductionReason: deductReason.trim(),
      refundMethod: 'deduction',
      refundReference: deductReference.trim(),
      refundType: 'actual_payout',
    });
  };

  const handleRefundFull = async (depositId: string, fullAmount: number) => {
    if (pendingOperation.current && pendingOperation.current.depositId !== depositId) {
      alert('يوجد عملية معلّقة لتأمين آخر. يرجى إكمالها أو حلها أولاً.');
      return;
    }

    const ref = prompt('أدخل رقم مرجع الإثبات البنكي أو سند الصرف:', '');
    if (ref === null) return; // User cancelled prompt
    
    if (!ref.trim()) {
      alert('مرجع إثبات الصرف مطلوب لإتمام تسوية وإرجاع الوديعة.');
      return;
    }

    if (confirm(`هل أنت متأكد من تسوية وإعادة كامل وديعة التأمين وقدرها ${fullAmount} ر.س للعميل؟`)) {
      await submitDepositOp({
        depositId,
        refundAmount: fullAmount.toFixed(2),
        deductedAmount: '0.00',
        refundMethod: 'bank_transfer',
        refundReference: ref.trim(),
        refundType: 'actual_payout',
      });
    }
  };

  const handleOpenPayment = (tenantId?: string, leaseId?: string) => {
    setModalTenantId(tenantId);
    setModalLeaseId(leaseId);
    setShowPaymentModal(true);
  };

  const handleOpenAdjustment = (tenantId?: string, leaseId?: string) => {
    setModalTenantId(tenantId);
    setModalLeaseId(leaseId);
    setShowAdjustmentModal(true);
  };

  const handleOpenDepositSettle = (depositId?: string, leaseId?: string) => {
    setModalDepositId(depositId);
    setModalLeaseId(leaseId);
    setShowDepositSettleModal(true);
  };

  return (
    <div className="space-y-6 text-xs text-right">
      
      {/* Header Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-white rounded-2xl border border-[#E3DCCD] w-fit shadow-xs select-none">
        <button
          onClick={() => setActiveTab('statement')}
          className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'statement' ? 'bg-[#282824] text-white shadow-xs' : 'text-[#68675F] hover:text-[#282824]'
          }`}
        >
          <FileText className="w-4 h-4 text-[#B69A68]" />
          <span>كشف حساب النزيل</span>
        </button>
        <button
          onClick={() => setActiveTab('oversight')}
          className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'oversight' ? 'bg-[#282824] text-white shadow-xs' : 'text-[#68675F] hover:text-[#282824]'
          }`}
        >
          <TrendingUp className="w-4 h-4 text-[#B69A68]" />
          <span>الرقابة والديون والسيولة</span>
        </button>
        <button
          onClick={() => setActiveTab('profitability')}
          className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'profitability' ? 'bg-[#282824] text-white shadow-xs' : 'text-[#68675F] hover:text-[#282824]'
          }`}
        >
          <Building2 className="w-4 h-4 text-[#B69A68]" />
          <span>مبيعات وأرباح المجمعات (NOI)</span>
        </button>
        <button
          onClick={() => setActiveTab('expenses')}
          className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'expenses' ? 'bg-[#282824] text-white shadow-xs' : 'text-[#68675F] hover:text-[#282824]'
          }`}
        >
          <Receipt className="w-4 h-4 text-[#B69A68]" />
          <span>دفتر يومية المصاريف والتوزيع ({state.expenses?.length || 0})</span>
        </button>
        <button
          onClick={() => setActiveTab('cash_outflow')}
          className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'cash_outflow' ? 'bg-[#282824] text-white shadow-xs' : 'text-[#68675F] hover:text-[#282824]'
          }`}
        >
          <TrendingDown className="w-4 h-4 text-rose-700" />
          <span>التدفق النقدي والمدفوعات</span>
        </button>
        <button
          onClick={() => setActiveTab('categories_rules')}
          className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'categories_rules' ? 'bg-[#282824] text-white shadow-xs' : 'text-[#68675F] hover:text-[#282824]'
          }`}
        >
          <Sliders className="w-4 h-4 text-[#B69A68]" />
          <span>شجرة التصنيفات والقواعد</span>
        </button>
        <button
          onClick={() => setActiveTab('deposits')}
          className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'deposits' ? 'bg-[#282824] text-white shadow-xs' : 'text-[#68675F] hover:text-[#282824]'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-[#B69A68]" />
          <span>ودائع تأمين السكن ({state.securityDeposits.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('payments')}
          className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'payments' ? 'bg-[#282824] text-white shadow-xs' : 'text-[#68675F] hover:text-[#282824]'
          }`}
        >
          <CreditCard className="w-4 h-4 text-[#B69A68]" />
          <span>سجل المقبوضات الكلية ({state.payments.length})</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-center gap-2 text-right">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 1. UNIFIED TENANT STATEMENT OF ACCOUNT */}
      {activeTab === 'statement' && (
        <TenantStatementView
          onOpenPaymentModal={handleOpenPayment}
          onOpenAdjustmentModal={handleOpenAdjustment}
          onOpenDepositSettleModal={handleOpenDepositSettle}
        />
      )}

      {/* 2. OVERSIGHT & AGING OF RECEIVABLES */}
      {activeTab === 'oversight' && (
        <OversightReportsView />
      )}

      {/* 3. NOI & UNIT/BUILDING PROFITABILITY */}
      {activeTab === 'profitability' && (
        <NOIProfitabilityView />
      )}

      {/* 4. EXPENSES LEDGER & COST ALLOCATION */}
      {activeTab === 'expenses' && (
        <ExpenseLedgerView />
      )}

      {/* 5. DECOUPLED CASH OUTFLOW & DISBURSEMENTS */}
      {activeTab === 'cash_outflow' && (
        <CashOutflowView />
      )}

      {/* 6. EXPENSE CATEGORIES & ALLOCATION RULES */}
      {activeTab === 'categories_rules' && (
        <ExpenseCategoriesManager />
      )}

      {/* 7. SECURITY DEPOSITS (Standalone Management) */}
      {activeTab === 'deposits' && (
        <div className="bg-white rounded-3xl border border-[#E3DCCD] overflow-hidden shadow-xs">
          <div className="p-4 bg-[#FAF8F5] border-b border-[#E3DCCD] flex items-center justify-between select-none">
            <div>
              <h4 className="font-bold text-[#282824] text-sm sm:text-base">سجل ودائع تأمين السكن المفتوحة</h4>
              <p className="text-[11px] text-[#68675F] mt-0.5">
                مبالغ تأمين الأثاث والضمانات المستلمة والمعزولة بالكامل عن قنوات الإيرادات
              </p>
            </div>
          </div>

          <table className="w-full text-right border-collapse">
            <thead className="bg-[#FAF8F5]">
              <tr className="border-b border-[#E3DCCD]">
                <th className="p-3.5 font-bold text-[#282824]">اسم النزيل والمعاملة</th>
                <th className="p-3.5 font-bold text-[#282824]">نوع السكن</th>
                <th className="p-3.5 font-bold text-[#282824]">قيمة التأمين المحتجز</th>
                <th className="p-3.5 font-bold text-[#282824]">طريقة استلام الوديعة</th>
                <th className="p-3.5 font-bold text-[#282824]">اقتطاعات تلفيات</th>
                <th className="p-3.5 font-bold text-[#282824]">حالة التأمين الجاري</th>
                <th className="p-3.5 font-bold text-[#282824] text-left">تسوية وتصفية</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3DCCD]">
              {state.securityDeposits.map(dep => {
                const totalDeducted = dep.deductions.reduce((sum, d) => sum + d.amount, 0);
                const remaining = dep.amount - totalDeducted;
                return (
                  <tr key={dep.id} className="hover:bg-[#FFFCF6] transition-colors">
                    <td className="p-3.5">
                      <strong className="block text-[#282824]">{dep.guestName}</strong>
                      <span className="text-[10px] text-[#68675F] font-mono">{dep.bookingOrLeaseId}</span>
                    </td>
                    <td className="p-3.5 text-[#68675F]">
                      {dep.bookingOrLeaseId.startsWith('bk') ? 'حجز فندقي قصير' : 'عقد إيجار ممتد'}
                    </td>
                    <td className="p-3.5 font-bold text-[#282824]">
                      <CurrencyAmount amount={dep.amount} />
                    </td>
                    <td className="p-3.5 text-[#68675F]">
                      {dep.heldType === 'authorized_hold' ? 'حجز تفويض أمني (Hold)' : 'مستلم كاش / حوالة'}
                    </td>
                    <td className="p-3.5">
                      {totalDeducted > 0 ? (
                        <div>
                          <span className="text-rose-700 font-bold inline-flex items-center gap-0.5">
                            <span>-</span>
                            <CurrencyAmount amount={totalDeducted} />
                          </span>
                          <span className="block text-[10px] text-[#68675F]">بسبب: ({dep.deductions[0]?.reason})</span>
                        </div>
                      ) : (
                        <span className="text-emerald-700 font-medium">لا توجد اقتطاعات</span>
                      )}
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2.5 py-0.5 rounded font-bold text-[10px] ${
                        dep.status === 'fully_refunded'
                          ? 'bg-emerald-100 text-emerald-800'
                          : dep.status === 'held'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {dep.status === 'held' && 'محتجز قيد الفحص'}
                        {dep.status === 'fully_refunded' && 'تم إرجاع وتصفية كامل الرصيد'}
                        {dep.status === 'partially_refunded' && 'مرتجع جزئياً'}
                        {dep.status === 'claimed_for_damage' && 'تمت تصفية كامل المبلغ لتلفيات'}
                      </span>
                    </td>
                    <td className="p-3.5 text-left">
                      {dep.status === 'held' && (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenDepositSettle(dep.id, dep.bookingOrLeaseId)}
                            className="px-2.5 py-1 bg-white hover:bg-[#FAF8F5] text-[#282824] border border-[#E3DCCD] rounded-lg font-semibold cursor-pointer"
                            title="توجيه جزء من التأمين لسداد قسط إيجاري"
                          >
                            سداد إيجاري
                          </button>
                          <button
                            onClick={() => openDeductionModal(dep.id)}
                            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg font-semibold cursor-pointer"
                            title="اقتطاع تعويض مالي للتلفيات"
                          >
                            خصم تلف
                          </button>
                          <button
                            onClick={() => handleRefundFull(dep.id, remaining)}
                            className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold cursor-pointer inline-flex items-center gap-1"
                          >
                            <span>تصفية إرجاع (</span>
                            <CurrencyAmount amount={remaining} symbolSize={11} />
                            <span>)</span>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 5. PAYMENTS RECORD */}
      {activeTab === 'payments' && (
        <div className="bg-white rounded-3xl border border-[#E3DCCD] overflow-hidden shadow-xs space-y-3">
          <div className="p-4 bg-[#FAF8F5] border-b border-[#E3DCCD] flex items-center justify-between select-none text-right">
            <div>
              <h4 className="font-bold text-[#282824] text-sm sm:text-base">أرشيف دفتر تحصيل السندات المقبوضة</h4>
              <p className="text-[11px] text-[#68675F] mt-0.5">
                سجل تاريخي بكافة السندات المالية الرقمية والتحويلات المصرفية المقبوضة
              </p>
            </div>
            <button
              onClick={() => handleOpenPayment()}
              className="px-3.5 py-2 bg-[#282824] hover:bg-[#1A1A17] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#B69A68]" />
              <span>تسجيل تحصيل يدوي</span>
            </button>
          </div>

          <table className="w-full text-right border-collapse">
            <thead className="bg-[#FAF8F5]">
              <tr className="border-b border-[#E3DCCD]">
                <th className="p-3.5 font-bold text-[#282824]">رقم سند المقبوضات</th>
                <th className="p-3.5 font-bold text-[#282824]">الحركة والمعاملة المرتبطة</th>
                <th className="p-3.5 font-bold text-[#282824]">قناة الدفع البنكية</th>
                <th className="p-3.5 font-bold text-[#282824]">قيمة السند المحصل</th>
                <th className="p-3.5 font-bold text-indigo-900">رصيد دائن حر متبقي</th>
                <th className="p-3.5 font-bold text-[#282824]">توقيت التحصيل</th>
                <th className="p-3.5 font-bold text-[#282824]">الحالة المعتمدة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3DCCD]">
              {state.payments.map(p => (
                <tr key={p.id} className="hover:bg-[#FFFCF6] transition-colors">
                  <td className="p-3.5 font-bold text-[#282824] font-mono select-all">
                    {p.receiptNumber || p.transactionId}
                  </td>
                  <td className="p-3.5 text-[#68675F]">
                    <span className="block font-medium text-[#282824] font-mono">{p.referenceId}</span>
                    <span className="text-[10px]">{p.notes}</span>
                  </td>
                  <td className="p-3.5 font-semibold text-[#282824]">
                    {p.method === 'mada' && 'مدى mada'}
                    {p.method === 'visa_mastercard' && 'فيزا / ماستركارد'}
                    {p.method === 'apple_pay' && 'Apple Pay'}
                    {p.method === 'bank_transfer' && 'حوالة مصرفية سريعة'}
                    {p.method === 'cash' && 'نقداً لدى الصندوق'}
                  </td>
                  <td className="p-3.5 font-bold text-[#282824]">
                    <CurrencyAmount amount={p.amount} />
                  </td>
                  <td className="p-3.5 font-bold text-indigo-700">
                    {p.unallocatedAmount && p.unallocatedAmount > 0 ? (
                      <CurrencyAmount amount={p.unallocatedAmount} />
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="p-3.5 text-[#68675F] text-[11px] tabular-nums font-mono">
                    <bdi dir="ltr">{formatDate(p.createdAt)}</bdi>
                  </td>
                  <td className="p-3.5">
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px] select-none">
                      مقيدة ومصادقة
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* DEDUCTION MODAL (Damage claims) */}
      {deductModalDepositId && selectedDeposit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[#FFFCF6] w-full max-w-md rounded-3xl p-5 border border-[#E3DCCD] shadow-2xl space-y-4 text-right">
            <h4 className="font-bold text-sm text-[#282824]">
              تسجيل اقتطاع تلف من وديعة التأمين ({selectedDeposit.guestName})
            </h4>
            {pendingOperation.current ? (
              <div className="space-y-4">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl space-y-2 text-right">
                  <p className="font-bold text-amber-900 text-xs flex items-center gap-1.5">
                    <AlertCircle className="w-4.5 h-4.5 text-amber-600 shrink-0" />
                    <span>تنبيه: توجد محاولة معلّقة سابقة لم يتم تأكيد نجاحها!</span>
                  </p>
                  <div className="text-[11px] text-[#68675F] space-y-1 bg-white p-3 rounded-xl border border-[#E3DCCD]">
                    <div><strong>مبلغ الاقتطاع المطلوب:</strong> {pendingOperation.current.payload.deductedAmount} ر.س</div>
                    <div><strong>مبرر الاقتطاع:</strong> {pendingOperation.current.payload.deductionReason}</div>
                    <div><strong>المرجع المالي:</strong> {pendingOperation.current.payload.refundReference}</div>
                    <div className="font-mono text-[9px] text-gray-500 mt-1 border-t border-gray-100 pt-1">
                      <strong>مفتاح المحاولة:</strong> {pendingOperation.current.key}
                    </div>
                  </div>
                  <p className="text-[10px] text-amber-800">
                    يمكنك إعادة إرسال هذه المحاولة مجدداً بنفس المفتاح والبيانات لتأمين سلامتها المالية، أو إلغاؤها نهائياً للبدء ببيانات جديدة.
                  </p>
                </div>
                <div className="flex flex-col gap-2 pt-2 border-t border-[#E3DCCD]/60">
                  <button
                    type="button"
                    onClick={async () => {
                      if (pendingOperation.current) {
                        await submitDepositOp({
                          depositId: pendingOperation.current.depositId,
                          refundAmount: pendingOperation.current.payload.refundAmount,
                          deductedAmount: pendingOperation.current.payload.deductedAmount,
                          deductionReason: pendingOperation.current.payload.deductionReason,
                          refundMethod: pendingOperation.current.payload.refundMethod,
                          refundReference: pendingOperation.current.payload.refundReference,
                          refundType: pendingOperation.current.payload.refundType,
                        });
                      }
                    }}
                    disabled={saving}
                    className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold cursor-pointer text-center text-xs"
                  >
                    {saving ? 'جاري إعادة الإرسال...' : 'إرسال المحاولة المعلقة مجدداً بنفس المفتاح'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('تحذير: إلغاء المحاولة المعلّقة قد يؤدي إلى تكرار الخصم إذا كان الخادم قد نفذها وتأخر الاتصال. هل تريد المتابعة والإلغاء؟')) {
                        pendingOperation.current = null;
                        setErrorMsg(null);
                        setSuccessMsg(null);
                        setDeductAmount('');
                        setDeductReason('');
                        setDeductReference('');
                      }
                    }}
                    className="w-full py-2 border border-[#E3DCCD] bg-white text-gray-700 hover:bg-gray-50 rounded-xl font-semibold cursor-pointer text-center text-xs"
                  >
                    إلغاء المحاولة والبدء من جديد ببيانات مختلفة
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeductModalDepositId(null)}
                    className="w-full py-1.5 text-center text-[#68675F] hover:text-[#282824] font-medium text-xs cursor-pointer"
                  >
                    إغلاق النافذة مؤقتاً
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleDeductSubmit} className="space-y-3">
                <div>
                  <label className="block text-[#68675F] font-semibold mb-1">المبلغ المراد اقتطاعه (ر.س) *</label>
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    max={selectedDeposit.amount}
                    value={deductAmount}
                    onChange={(e) => setDeductAmount(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl font-bold tabular-nums text-left focus:outline-none"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-[#68675F] font-semibold mb-1">وصف مبرر اقتطاع التلفيات الموثقة *</label>
                  <textarea
                    rows={2}
                    required
                    value={deductReason}
                    onChange={(e) => setDeductReason(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl text-right focus:outline-none focus:border-[#B69A68]"
                    placeholder="أدخل مبرر الاقتطاع بالتفصيل..."
                  />
                </div>
                <div>
                  <label className="block text-[#68675F] font-semibold mb-1">مرجع إثبات الصرف أو مستند الخصم *</label>
                  <input
                    type="text"
                    required
                    value={deductReference}
                    onChange={(e) => setDeductReference(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl text-right focus:outline-none focus:border-[#B69A68]"
                    placeholder="مثال: DOC-DAMAGE-101"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-[#E3DCCD]/60">
                  <button
                    type="button"
                    onClick={() => setDeductModalDepositId(null)}
                    className="px-3 py-1.5 border border-[#E3DCCD] rounded-xl cursor-pointer"
                  >
                    إلغاء التراجع
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded-xl font-bold cursor-pointer"
                  >
                    تطبيق الاقتطاع المالي
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* PAYMENT ALLOCATION MODAL */}
      {showPaymentModal && (
        <PaymentAllocationModal
          initialTenantNationalId={modalTenantId}
          initialLeaseId={modalLeaseId}
          onClose={() => setShowPaymentModal(false)}
        />
      )}

      {/* ADJUSTMENT MODAL */}
      {showAdjustmentModal && (
        <AdjustmentModal
          initialTenantNationalId={modalTenantId}
          initialLeaseId={modalLeaseId}
          onClose={() => setShowAdjustmentModal(false)}
        />
      )}

      {/* DEPOSIT SETTLEMENT MODAL */}
      {showDepositSettleModal && (
        <DepositSettlementModal
          initialDepositId={modalDepositId}
          initialLeaseId={modalLeaseId}
          onClose={() => setShowDepositSettleModal(false)}
        />
      )}

    </div>
  );
};
