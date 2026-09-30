import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Unit, Booking } from '../../types';
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
  const { state, createBooking } = useAppStore();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completedBooking, setCompletedBooking] = useState<Booking | null>(null);

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

  // Financial calculations
  const startMs = new Date(`${dates.checkIn}T15:00:00`).getTime();
  const endMs = new Date(`${dates.checkOut}T12:00:00`).getTime();
  const calculatedNights = Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)));

  const subtotal = (dates.rentalType === 'daily' ? unit.dailyRate : Math.round(unit.monthlyRate / 30)) * calculatedNights;
  const cleaningFee = unit.cleaningFee;
  const taxes = Math.round((subtotal + cleaningFee) * (unit.taxPercentage / 100));
  const securityDeposit = unit.securityDeposit;
  const totalAmountToPay = subtotal + cleaningFee + taxes;

  const handleFinalSubmit = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      // Simulate real bank authorization and atomic allocation check
      await new Promise(r => setTimeout(r, 900));

      const newBooking = createBooking({
        unitId: unit.id,
        guest: {
          fullName: guestForm.fullName,
          email: guestForm.email,
          phone: guestForm.phone,
          nationalIdOrPassport: guestForm.nationalId,
        },
        checkIn: dates.checkIn,
        checkOut: dates.checkOut,
        guestsCount: dates.guests,
        paymentMethod,
      });

      setCompletedBooking(newBooking);
      setStep(4);
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ غير متوقع أثناء معالجة حجزك.');
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
                <div className="flex justify-between">
                  <span>قيمة الإقامة المفوترة ({calculatedNights} ليلة x {unit.dailyRate} ر.س)</span>
                  <span className="font-medium text-[#282824] tabular-nums">{subtotal} ر.س</span>
                </div>
                <div className="flex justify-between">
                  <span>رسوم التطهير الفندقي وتجهيز الشقة</span>
                  <span className="font-medium text-[#282824] tabular-nums">{cleaningFee} ر.س</span>
                </div>
                <div className="flex justify-between">
                  <span>ضريبة القيمة المضافة الحكومية (١٥٪)</span>
                  <span className="font-medium text-[#282824] tabular-nums">{taxes} ر.س</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-[#E3DCCD] text-sm font-bold text-[#282824]">
                  <span>إجمالي المبلغ المطلوب للدفع الآن</span>
                  <span className="tabular-nums text-emerald-800">{totalAmountToPay} ر.س</span>
                </div>
                <div className="flex justify-between pt-1 text-[11px] text-amber-800 border-t border-dashed border-[#E3DCCD]/60 mt-1">
                  <span>تأمين الأثاث المسترد (تفويض معلق على البطاقة)</span>
                  <span className="tabular-nums">{securityDeposit} ر.س</span>
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
                <div className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-700" />
                  <span>تأمين الأثاث المسترد ({securityDeposit} ر.س)</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-800">
                  سيتم تطبيق حجز تفويض أمني مؤقت على البطاقة دون سحب فعلي للرصيد، ويتحرر الحجز بالكامل فور تسليم الشقة بموجب محاضر الفحص الفني.
                </p>
              </div>

              <div className="p-4 bg-[#FFFCF6] rounded-2xl border border-[#E3DCCD] flex items-center justify-between">
                <div>
                  <span className="block text-xs text-[#68675F]">إجمالي السداد الفوري المطلوب:</span>
                  <span className="text-xl font-bold text-[#282824] tabular-nums">{totalAmountToPay} ر.س</span>
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
                      <span>سداد وأرشفة الحجز {totalAmountToPay} ر.س</span>
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
                  <span className="text-[#68675F]">الرمز السري للقفل الذكي:</span>
                  <span className="font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                    تلقائي (الدخول يبدأ ٣:٠٠ م)
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
