import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Unit, Booking } from '../../types';
import { CurrencyAmount, formatNumber } from '../../utils/formatters';
import {
  X,
  ShieldCheck,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Lock,
  ArrowLeft
} from 'lucide-react';

interface BookingCheckoutModalProps {
  unit: Unit | null;
  dates: {
    checkIn: string;
    checkOut: string;
    guests: number;
    rentalType: 'daily' | 'monthly' | 'yearly';
    annualPaymentTerms?: 'single' | 'semi_annual';
  } | null;
  onClose: () => void;
  onBookingComplete: (booking: Booking) => void;
}

export const BookingCheckoutModal: React.FC<BookingCheckoutModalProps> = ({
  unit,
  dates,
  onClose,
  onBookingComplete,
}) => {
  const { state, addServerBooking, addServerLease } = useAppStore();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completedBooking, setCompletedBooking] = useState<Booking | null>(null);
  const [completedContractNumber, setCompletedContractNumber] = useState<string | null>(null);

  // Guest Details Form State
  const [guestForm, setGuestForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    nationalId: '',
  });

  // Payment State
  const [paymentMethod, setPaymentMethod] = useState<'mada' | 'visa_mastercard' | 'apple_pay'>('mada');

  if (!unit || !dates) return null;

  const property = state.properties.find(p => p.id === unit.propertyId);

  // Financial calculations based on true rental mode
  const isYearly = dates.rentalType === 'yearly';
  const isMonthly = dates.rentalType === 'monthly';
  const isDaily = dates.rentalType === 'daily';

  const startMs = new Date(`${dates.checkIn}T15:00:00`).getTime();
  const endMs = new Date(`${dates.checkOut}T12:00:00`).getTime();
  const calculatedNights = Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)));

  let subtotal = 0;
  let totalPeriodRent = 0;
  const cleaningFee = isDaily ? unit.cleaningFee : 0;
  const securityDeposit = isYearly ? 2500 : (isMonthly ? 1500 : unit.securityDeposit);

  if (isYearly) {
    totalPeriodRent = unit.yearlyRate || (unit.monthlyRate * 12);
    // If semi-annual payment option selected, 1st installment is 50%
    subtotal = dates.annualPaymentTerms === 'semi_annual' ? Math.round(totalPeriodRent / 2) : totalPeriodRent;
  } else if (isMonthly) {
    totalPeriodRent = unit.monthlyRate;
    subtotal = unit.monthlyRate;
  } else {
    subtotal = unit.dailyRate * calculatedNights;
  }

  const taxes = isDaily ? Math.round((subtotal + cleaningFee) * (unit.taxPercentage / 100)) : 0;
  const totalAmountToPay = subtotal + cleaningFee + taxes + securityDeposit;

  const handleFinalSubmit = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      if (isDaily) {
        // 1. Call server API for daily booking
        const serverRes = await fetch('/api/bookings/daily', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            unitId: unit.id,
            checkIn: dates.checkIn,
            checkOut: dates.checkOut,
            guestsCount: dates.guests,
            guestName: guestForm.fullName,
            guestPhone: guestForm.phone,
            guestEmail: guestForm.email,
            guestIdNumber: guestForm.nationalId,
            notes: `حجز إلكتروني يومي - طريقة الدفع المختارة: ${paymentMethod}`
          })
        });

        const data = await serverRes.json().catch(() => null);

        if (!serverRes.ok) {
          throw new Error(data?.message || 'تعذر إتمام الحجز على الخادم. قد تكون الفترة متداخلة.');
        }

        // 2. Register authoritative server-created booking in local state
        const authoritativeBooking = addServerBooking(data.booking);
        if (authoritativeBooking) {
          setCompletedBooking(authoritativeBooking);
          onBookingComplete(authoritativeBooking);
        }
        setStep(4);
      } else {
        // Monthly or Annual Lease Contract
        const paymentFrequency = isYearly
          ? (dates.annualPaymentTerms === 'semi_annual' ? '2_payments' : '1_payment')
          : 'monthly';

        const serverRes = await fetch('/api/leases/contract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            unitId: unit.id,
            rentalType: isYearly ? 'annual' : 'monthly',
            startDate: dates.checkIn,
            endDate: dates.checkOut,
            durationMonths: isYearly ? 12 : 1,
            paymentFrequency,
            tenantName: guestForm.fullName,
            tenantPhone: guestForm.phone,
            tenantEmail: guestForm.email,
            tenantIdNumber: guestForm.nationalId,
            contractServices: ['wifi', 'parking', 'maintenance'],
            termsConditions: 'عقد إيجار إلكتروني معتمد لدى منصة منزل الفخامة'
          })
        });

        const data = await serverRes.json().catch(() => null);

        if (!serverRes.ok) {
          throw new Error(data?.message || 'تعذر تسجيل عقد الإيجار على الخادم.');
        }

        addServerLease(data.lease, data.installments);
        setCompletedContractNumber(data.lease?.contractNumber || `CNT-${Date.now()}`);
        setStep(4);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ غير متوقع أثناء معالجة طلبك.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[#FFFCF6] w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl border border-[#E3DCCD] my-auto text-right">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#E3DCCD] flex items-center justify-between bg-[#F7F3EB]/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#282824] text-white">
              <ShieldCheck className="w-5 h-5 text-[#B69A68]" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-[#282824]">
                {step === 4 ? 'تم تأكيد الحجز بنجاح' : 'إتمام الحجز والدفع الرقمي الموحد'}
              </h3>
              <span className="text-xs text-[#68675F] block">
                {property?.name} · شقة #{unit.unitNumber}
              </span>
            </div>
          </div>
          {step !== 4 && (
            <button
              onClick={onClose}
              className="p-2 text-[#68675F] hover:text-[#282824] hover:bg-[#EFE9DF] rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Steps Progress Indicator (if not completed) */}
        {step !== 4 && (
          <div className="grid grid-cols-3 border-b border-[#E3DCCD] text-xs font-semibold text-center select-none">
            <div className={`py-2.5 border-b-2 ${step >= 1 ? 'border-[#B69A68] text-[#282824] bg-[#FFFCF6]' : 'border-transparent text-[#68675F]'}`}>
              ١. مراجعة تفاصيل الحجز
            </div>
            <div className={`py-2.5 border-b-2 ${step >= 2 ? 'border-[#B69A68] text-[#282824] bg-[#FFFCF6]' : 'border-transparent text-[#68675F]'}`}>
              ٢. بيانات النزيل والهوية
            </div>
            <div className={`py-2.5 border-b-2 ${step >= 3 ? 'border-[#B69A68] text-[#282824] bg-[#FFFCF6]' : 'border-transparent text-[#68675F]'}`}>
              ٣. السداد والتأمين
            </div>
          </div>
        )}

        {/* Body Content */}
        <div className="p-5 sm:p-6 space-y-6">
          
          {errorMessage && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2 text-right">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">عذرًا، تعذر تأكيد الحجز:</strong>
                <span>{errorMessage}</span>
              </div>
            </div>
          )}

          {/* STEP 1: SUMMARY */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-4 bg-[#F7F3EB]/60 rounded-2xl border border-[#E3DCCD] space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#68675F]">الوحدة السكنية:</span>
                  <span className="font-bold text-[#282824]">{unit.title} (شقة #{unit.unitNumber})</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#68675F]">تاريخ الدخول:</span>
                  <span className="font-bold text-[#282824]">{dates.checkIn} (بدءاً من الساعة ٣:٠٠ مساءً)</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#68675F]">تاريخ المغادرة:</span>
                  <span className="font-bold text-[#282824]">{dates.checkOut} (حتى الساعة ١٢:٠٠ ظهراً)</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#68675F]">عدد الليالي المحتسبة:</span>
                  <span className="font-bold text-[#282824] tabular-nums">{calculatedNights} ليلة سكنية</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#68675F]">عدد ضيوف الإقامة:</span>
                  <span className="font-bold text-[#282824] tabular-nums">{dates.guests} أشخاص</span>
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="p-4 bg-white rounded-2xl border border-[#E3DCCD] space-y-2 text-xs text-[#68675F]">
                <div className="flex justify-between items-center">
                  <span className="inline-flex items-center gap-1 flex-wrap">
                    <span>قيمة الإقامة المفوترة ({formatNumber(calculatedNights)} ليلة ×</span>
                    <CurrencyAmount amount={unit.dailyRate} symbolSize={12} />
                    <span>)</span>
                  </span>
                  <CurrencyAmount amount={subtotal} className="font-medium text-[#282824]" />
                </div>
                <div className="flex justify-between items-center">
                  <span>رسوم التطهير الفندقي وتجهيز الشقة</span>
                  <CurrencyAmount amount={cleaningFee} className="font-medium text-[#282824]" />
                </div>
                <div className="flex justify-between items-center">
                  <span>ضريبة القيمة المضافة الحكومية (<bdi dir="ltr">15%</bdi>)</span>
                  <CurrencyAmount amount={taxes} className="font-medium text-[#282824]" />
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-[#E3DCCD] text-sm font-bold text-[#282824]">
                  <span>إجمالي المبلغ المطلوب للدفع الآن</span>
                  <CurrencyAmount amount={totalAmountToPay} className="text-emerald-800" />
                </div>
                <div className="flex justify-between items-center pt-1 text-[11px] text-amber-800 border-t border-dashed border-[#E3DCCD]/60 mt-1">
                  <span>تأمين الأثاث المسترد (تفويض معلق على البطاقة)</span>
                  <CurrencyAmount amount={securityDeposit} symbolSize={12} />
                </div>
              </div>

              <button
                onClick={() => setStep(2)}
                className="w-full py-3 bg-[#282824] hover:bg-[#1a1a18] text-white font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>المتابعة لإدخال بيانات النزيل</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STEP 2: GUEST FORM */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in duration-150 text-right">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[#68675F] mb-1">الاسم الكامل الموثق بالهوية الوطنية / الجواز *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: فهد بن عبد العزيز السالم"
                    value={guestForm.fullName}
                    onChange={(e) => setGuestForm({ ...guestForm, fullName: e.target.value })}
                    className="w-full p-2.5 text-xs sm:text-sm bg-white border border-[#E3DCCD] rounded-xl focus:outline-none focus:border-[#B69A68]"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#68675F] mb-1">رقم الجوال النشط *</label>
                    <input
                      type="tel"
                      required
                      placeholder="05XXXXXXXX"
                      value={guestForm.phone}
                      onChange={(e) => setGuestForm({ ...guestForm, phone: e.target.value })}
                      className="w-full p-2.5 text-xs sm:text-sm bg-white border border-[#E3DCCD] rounded-xl focus:outline-none focus:border-[#B69A68]"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#68675F] mb-1">البريد الإلكتروني لإرسال الفواتير والرمز *</label>
                    <input
                      type="email"
                      required
                      placeholder="name@example.com"
                      value={guestForm.email}
                      onChange={(e) => setGuestForm({ ...guestForm, email: e.target.value })}
                      className="w-full p-2.5 text-xs sm:text-sm bg-white border border-[#E3DCCD] rounded-xl focus:outline-none focus:border-[#B69A68]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#68675F] mb-1">رقم الهوية الوطنية أو الإقامة / جواز السفر *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: ١٠٩٨٧٦٥٤٣٢"
                    value={guestForm.nationalId}
                    onChange={(e) => setGuestForm({ ...guestForm, nationalId: e.target.value })}
                    className="w-full p-2.5 text-xs sm:text-sm bg-white border border-[#E3DCCD] rounded-xl focus:outline-none focus:border-[#B69A68]"
                  />
                </div>
              </div>

              <div className="p-3 bg-[#F7F3EB] rounded-xl border border-[#E3DCCD] text-[11px] text-[#68675F] flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#B69A68] shrink-0" />
                <span>يتم تشفير كافة البيانات الشخصية والمالية وإصدار العقود الرسمية تلقائياً للجهات المختصة.</span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="py-3 bg-[#FFFCF6] hover:bg-[#EFE9DF] text-[#282824] border border-[#E3DCCD] font-semibold text-xs sm:text-sm rounded-xl transition-all cursor-pointer"
                >
                  العودة للملخص
                </button>
                <button
                  type="button"
                  disabled={!guestForm.fullName || !guestForm.phone || !guestForm.nationalId}
                  onClick={() => setStep(3)}
                  className="py-3 bg-[#282824] hover:bg-[#1a1a18] disabled:bg-[#EFE9DF] disabled:text-[#68675F]/60 text-white font-bold text-xs sm:text-sm rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>الذهاب للدفع</span>
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: PAYMENT & DEPOSIT */}
          {step === 3 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[#68675F] mb-1">اختر وسيلة الدفع البنكي الرقمية المعتمدة</label>
                
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('mada')}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      paymentMethod === 'mada'
                        ? 'border-[#B69A68] bg-[#FFFCF6] shadow-xs'
                        : 'border-[#E3DCCD] bg-white text-[#68675F]'
                    }`}
                  >
                    <span className="block font-bold text-sm text-[#282824]">مدى mada</span>
                    <span className="text-[10px] text-[#68675F]">سداد فوري محلي</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('apple_pay')}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      paymentMethod === 'apple_pay'
                        ? 'border-[#B69A68] bg-[#FFFCF6] shadow-xs'
                        : 'border-[#E3DCCD] bg-white text-[#68675F]'
                    }`}
                  >
                    <span className="block font-bold text-sm text-[#282824]">Apple Pay</span>
                    <span className="text-[10px] text-[#68675F]">نقرة سداد آمنة</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('visa_mastercard')}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      paymentMethod === 'visa_mastercard'
                        ? 'border-[#B69A68] bg-[#FFFCF6] shadow-xs'
                        : 'border-[#E3DCCD] bg-white text-[#68675F]'
                    }`}
                  >
                    <span className="block font-bold text-sm text-[#282824]">بطاقة ائتمانية</span>
                    <span className="text-[10px] text-[#68675F]">فيزا / ماستركارد</span>
                  </button>
                </div>
              </div>

              {/* Security Deposit Note */}
              <div className="p-4 bg-amber-50/80 rounded-2xl border border-amber-200/80 text-xs text-amber-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5 flex-wrap">
                  <ShieldCheck className="w-4 h-4 text-amber-700" />
                  <span>تأمين الأثاث المسترد (</span>
                  <CurrencyAmount amount={securityDeposit} symbolSize={12} />
                  <span>)</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-800">
                  سيتم تطبيق حجز تفويض أمني مؤقت على البطاقة دون سحب فعلي للرصيد، ويتحرر الحجز بالكامل فور تسليم الشقة بموجب محاضر الفحص الفني.
                </p>
              </div>

              <div className="p-4 bg-[#FFFCF6] rounded-2xl border border-[#E3DCCD] flex items-center justify-between">
                <div>
                  <span className="block text-xs text-[#68675F]">إجمالي السداد الفوري المطلوب:</span>
                  <div className="text-xl font-bold text-[#282824]">
                    <CurrencyAmount amount={totalAmountToPay} symbolSize={18} />
                  </div>
                </div>
                <span className="text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 font-semibold select-none">
                  جاهز للتعميد
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="py-3 bg-[#FFFCF6] hover:bg-[#EFE9DF] text-[#282824] border border-[#E3DCCD] font-semibold text-xs sm:text-sm rounded-xl transition-all cursor-pointer"
                >
                  العودة لتعديل البيانات
                </button>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleFinalSubmit}
                  className="py-3 bg-[#282824] hover:bg-[#1a1a18] text-white font-bold text-xs sm:text-sm rounded-xl transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
                >
                  {isProcessing ? (
                    <span>جاري تفويض البنك السداد...</span>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 text-[#B69A68]" />
                      <span className="inline-flex items-center gap-1.5">
                        <span>سداد وأرشفة الحجز</span>
                        <CurrencyAmount amount={totalAmountToPay} symbolSize={13} />
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: SUCCESS CONFIRMATION */}
          {step === 4 && completedBooking && (
            <div className="text-center space-y-6 py-2 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              
              <div>
                <h4 className="text-xl font-bold text-[#282824]">تهانينا! تم تأكيد وتفعيل حجزك بنجاح</h4>
                <p className="text-xs sm:text-sm text-[#68675F] mt-1">
                  رقم تتبع المعاملة الفريد: <strong className="font-bold text-[#282824]">{completedBooking.bookingNumber}</strong>
                </p>
              </div>

              <div className="p-4 bg-[#F7F3EB] rounded-2xl border border-[#E3DCCD] text-right space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#68675F]">الشقة المحجوزة:</span>
                  <span className="font-bold text-[#282824]">{unit.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#68675F]">تواريخ الإقامة:</span>
                  <span className="font-bold text-[#282824]">{completedBooking.checkIn} إلى {completedBooking.checkOut}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#68675F]">حالة السداد والتحصيل:</span>
                  <span className="font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded">
                    بانتظار التحصيل والتأكيد الرسمي
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#68675F]">الرمز السري للقفل الذكي:</span>
                  <span className="font-bold text-[#68675F] bg-[#EFE9DF] px-2 py-0.5 rounded">
                    يُفعل ويرسل تلقائياً عند إتمام التحقق والدخول
                  </span>
                </div>
              </div>

              <button
                onClick={() => {
                  onClose();
                  onBookingComplete(completedBooking);
                }}
                className="w-full py-3 bg-[#282824] hover:bg-[#1a1a18] text-white font-bold text-sm rounded-xl transition-all shadow-md cursor-pointer"
              >
                الدخول لبوابة النزيل الرقمية
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
