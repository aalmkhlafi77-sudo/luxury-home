import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Unit, UnitSpace, SpaceFitting, UnitSpaceType } from '../../types';
import {
  X,
  Bed,
  Bath,
  Maximize2,
  Plus,
  Trash2,
  Save,
  Car,
  Sparkles,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

interface UnitEditorModalProps {
  unit: Unit;
  onClose: () => void;
  onSaved?: () => void;
}

export const UnitEditorModal: React.FC<UnitEditorModalProps> = ({
  unit,
  onClose,
  onSaved,
}) => {
  const {
    state,
    updateUnit,
    addUnitSpace,
    deleteUnitSpace,
    addSpaceFitting,
    deleteSpaceFitting,
    assignParkingToUnit,
    unassignParking
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'basic' | 'spaces' | 'amenities' | 'pricing' | 'media' | 'parking' | 'history'>('basic');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Basic Form State
  const [basicForm, setBasicForm] = useState({
    unitNumber: unit.unitNumber,
    title: unit.title,
    titleEn: unit.titleEn || '',
    type: unit.type,
    areaSqm: unit.areaSqm,
    floorId: unit.floorId,
    maxGuests: unit.maxGuests,
    furnishingStatus: unit.furnishingStatus || 'furnished',
    allowDaily: unit.allowDaily,
    dailyRate: unit.dailyRate,
    dailySecurityDeposit: unit.dailySecurityDeposit || unit.securityDeposit || 800,
    allowMonthly: unit.allowMonthly,
    monthlyRate: unit.monthlyRate,
    monthlySecurityDeposit: unit.monthlySecurityDeposit || 3000,
    allowYearly: unit.allowYearly || false,
    yearlyRate: unit.yearlyRate || (unit.monthlyRate ? unit.monthlyRate * 11 : 90000),
    yearlySecurityDeposit: unit.yearlySecurityDeposit || 5000,
    yearlyPaymentOptions: unit.yearlyPaymentOptions || ['single_annual', 'semi_annual'],
    semiAnnualSurchargePercent: unit.semiAnnualSurchargePercent || 0,
    cleaningFee: unit.cleaningFee,
    securityDeposit: unit.securityDeposit,
    taxPercentage: unit.taxPercentage || 15,
    operationalStatus: unit.operationalStatus,
    publicationStatus: unit.publicationStatus || 'published',
    floorPlanUrl: unit.floorPlanUrl || '',
    notes: unit.notes || '',
  });

  // Selected Space for Editing / Adding fittings
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>(unit.spaces[0]?.id || '');

  // New Space Form State
  const [isAddingSpace, setIsAddingSpace] = useState(false);
  const [newSpaceForm, setNewSpaceForm] = useState<{
    name: string;
    type: UnitSpaceType;
    areaSqm: number;
    description: string;
  }>({
    name: '',
    type: 'bedroom',
    areaSqm: 20,
    description: '',
  });

  // New Fitting Form State
  const [isAddingFitting, setIsAddingFitting] = useState(false);
  const [newFittingForm, setNewFittingForm] = useState<{
    name: string;
    category: SpaceFitting['category'];
    quantity: number;
    specifications: string;
  }>({
    name: '',
    category: 'furniture',
    quantity: 1,
    specifications: '',
  });

  const property = state.properties.find(p => p.id === unit.propertyId);
  const propertyFloors = state.floors.filter(f => f.propertyId === unit.propertyId);
  const propertyParkings = state.parkingSpots.filter(p => p.propertyId === unit.propertyId);
  const activeBookings = state.bookings.filter(b => b.unitId === unit.id);
  const activeLeases = state.leases.filter(l => l.unitId === unit.id);

  // Selected space object
  const currentSpace = unit.spaces.find(s => s.id === selectedSpaceId) || unit.spaces[0];

  const handleSaveBasic = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      const selectedFloor = propertyFloors.find(f => f.id === basicForm.floorId);
      await updateUnit(unit.id, {
        ...basicForm,
        floorNumber: selectedFloor ? selectedFloor.floorNumber : unit.floorNumber,
      });
      setSuccessMsg('تم حفظ البيانات الأساسية للوحدة السكنية بنجاح.');
      setTimeout(() => setSuccessMsg(null), 3000);
      if (onSaved) onSaved();
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ أثناء حفظ البيانات.');
    }
  };

  const handleCreateSpace = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSpaceForm.name) return;
    addUnitSpace(unit.id, {
      ...newSpaceForm,
      fittings: [],
    });
    setIsAddingSpace(false);
    setNewSpaceForm({ name: '', type: 'bedroom', areaSqm: 20, description: '' });
  };

  const handleCreateFitting = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSpace || !newFittingForm.name) return;
    addSpaceFitting(unit.id, currentSpace.id, newFittingForm);
    setIsAddingFitting(false);
    setNewFittingForm({ name: '', category: 'furniture', quantity: 1, specifications: '' });
  };

  const handleAssignParking = (parkingSpotId: string) => {
    setErrorMsg(null);
    try {
      if (parkingSpotId === 'none') {
        if (unit.assignedParkingId) {
          unassignParking(unit.assignedParkingId);
        }
      } else {
        assignParkingToUnit(parkingSpotId, unit.id);
      }
      setSuccessMsg('تم تسوية تخصيص موقف السيارة بنجاح.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/65 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[#FFFCF6] w-full max-w-5xl rounded-3xl overflow-hidden shadow-2xl border border-[#E3DCCD] my-auto max-h-[92vh] flex flex-col text-right">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-[#E3DCCD] flex items-center justify-between bg-[#F7F3EB]/80">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-[#282824] text-white text-xs font-bold rounded-lg tracking-wider">
              شقة #{unit.unitNumber}
            </span>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-[#282824]">تجهيز وتعديل تفاصيل الشقة بالكامل</h3>
              <span className="text-xs text-[#68675F] block">
                {property?.name} · الدور {unit.floorNumber}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#68675F] hover:text-[#282824] hover:bg-[#EFE9DF] rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dynamic Metric Bar (Auto Calculated from Spaces & Fittings) */}
        <div className="p-3.5 bg-white border-b border-[#E3DCCD] flex flex-wrap items-center justify-between gap-4 text-xs select-none">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Bed className="w-4 h-4 text-[#B69A68]" />
              <span>الغرف: <strong className="font-bold text-[#282824] tabular-nums">{unit.bedroomsCount}</strong> غرف نوم</span>
            </div>
            <div className="flex items-center gap-2">
              <Bath className="w-4 h-4 text-[#B69A68]" />
              <span>الحمامات: <strong className="font-bold text-[#282824] tabular-nums">{unit.bathroomsCount}</strong> دورات مياه</span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#B69A68]" />
              <span>الأسرة: <strong className="font-bold text-[#282824] tabular-nums">{unit.bedsCount}</strong> أسرّة</span>
            </div>
            <div className="flex items-center gap-2">
              <Maximize2 className="w-4 h-4 text-[#B69A68]" />
              <span>المساحة: <strong className="font-bold text-[#282824] tabular-nums">{unit.areaSqm} م²</strong></span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-[#68675F]">الموقف المخصص:</span>
            {unit.assignedParkingId ? (
              <span className="px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold flex items-center gap-1 font-mono">
                <Car className="w-3.5 h-3.5" />
                <span>{state.parkingSpots.find(p => p.id === unit.assignedParkingId)?.spotNumber || ''}</span>
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">لا يوجد موقف سيارات</span>
            )}
          </div>
        </div>

        {/* 7 Management Tabs */}
        <div className="flex border-b border-[#E3DCCD] bg-[#F7F3EB]/40 overflow-x-auto text-xs font-semibold select-none">
          <button
            onClick={() => setActiveTab('basic')}
            className={`px-5 py-3 border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'basic' ? 'border-[#B69A68] text-[#282824] bg-white' : 'border-transparent text-[#68675F] hover:text-[#282824]'
            }`}
          >
            ١. البيانات الأساسية
          </button>
          <button
            onClick={() => setActiveTab('spaces')}
            className={`px-5 py-3 border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'spaces' ? 'border-[#B69A68] text-[#282824] bg-white' : 'border-transparent text-[#68675F] hover:text-[#282824]'
            }`}
          >
            ٢. جرد الفراغات والأثاث ({unit.spaces.length})
          </button>
          <button
            onClick={() => setActiveTab('amenities')}
            className={`px-5 py-3 border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'amenities' ? 'border-[#B69A68] text-[#282824] bg-white' : 'border-transparent text-[#68675F] hover:text-[#282824]'
            }`}
          >
            ٣. الخدمات والميزات
          </button>
          <button
            onClick={() => setActiveTab('pricing')}
            className={`px-5 py-3 border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'pricing' ? 'border-[#B69A68] text-[#282824] bg-white' : 'border-transparent text-[#68675F] hover:text-[#282824]'
            }`}
          >
            ٤. التسعير والضمانات
          </button>
          <button
            onClick={() => setActiveTab('media')}
            className={`px-5 py-3 border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'media' ? 'border-[#B69A68] text-[#282824] bg-white' : 'border-transparent text-[#68675F] hover:text-[#282824]'
            }`}
          >
            ٥. مخططات وصور
          </button>
          <button
            onClick={() => setActiveTab('parking')}
            className={`px-5 py-3 border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'parking' ? 'border-[#B69A68] text-[#282824] bg-white' : 'border-transparent text-[#68675F] hover:text-[#282824]'
            }`}
          >
            ٦. تخصيص موقف سيارة
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-5 py-3 border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'history' ? 'border-[#B69A68] text-[#282824] bg-white' : 'border-transparent text-[#68675F] hover:text-[#282824]'
            }`}
          >
            ٧. سجل الحركات المالي والتعاقدي
          </button>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto p-5 sm:p-6 flex-1 space-y-6">
          
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB 1: BASIC INFO */}
          {activeTab === 'basic' && (
            <form onSubmit={handleSaveBasic} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="font-semibold text-[#68675F] block mb-1">رقم الشقة *</label>
                  <input
                    type="text"
                    required
                    value={basicForm.unitNumber}
                    onChange={(e) => setBasicForm({ ...basicForm, unitNumber: e.target.value })}
                    className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl font-bold font-mono text-left focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#68675F] block mb-1">تصنيف الشقة</label>
                  <select
                    value={basicForm.type}
                    onChange={(e) => setBasicForm({ ...basicForm, type: e.target.value as any })}
                    className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl cursor-pointer"
                  >
                    <option value="apartment">شقة سكنية متكاملة</option>
                    <option value="studio">استديو مستقل</option>
                    <option value="suite">جناح بنتهاوس ملكي</option>
                    <option value="duplex">دوبلكس طابقين</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-[#68675F] block mb-1">حالة التأثيث والفرش</label>
                  <select
                    value={basicForm.furnishingStatus}
                    onChange={(e) => setBasicForm({ ...basicForm, furnishingStatus: e.target.value as any })}
                    className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl cursor-pointer"
                  >
                    <option value="furnished">مفروشة بالكامل</option>
                    <option value="partially_furnished">مفروشة جزئياً</option>
                    <option value="unfurnished">غير مفروشة</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-[#68675F] block mb-1">مسمى الشقة (عربي) *</label>
                  <input
                    type="text"
                    required
                    value={basicForm.title}
                    onChange={(e) => setBasicForm({ ...basicForm, title: e.target.value })}
                    className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl focus:outline-none focus:border-[#B69A68]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#68675F] block mb-1">مسمى الشقة (إنجليزي)</label>
                  <input
                    type="text"
                    value={basicForm.titleEn}
                    onChange={(e) => setBasicForm({ ...basicForm, titleEn: e.target.value })}
                    className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl text-left focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="font-semibold text-[#68675F] block mb-1">المساحة (م²)</label>
                  <input
                    type="number"
                    min="10"
                    value={basicForm.areaSqm}
                    onChange={(e) => setBasicForm({ ...basicForm, areaSqm: Number(e.target.value) })}
                    className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl tabular-nums focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#68675F] block mb-1">أقصى عدد للنزلاء</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={basicForm.maxGuests}
                    onChange={(e) => setBasicForm({ ...basicForm, maxGuests: Number(e.target.value) })}
                    className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl tabular-nums focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#68675F] block mb-1">الحالة التشغيلية</label>
                  <select
                    value={basicForm.operationalStatus}
                    onChange={(e) => setBasicForm({ ...basicForm, operationalStatus: e.target.value as any })}
                    className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl cursor-pointer"
                  >
                    <option value="ready">جاهزة ومطهرة (Ready)</option>
                    <option value="needs_cleaning">بحاجة لتنظيف</option>
                    <option value="in_cleaning">جاري التنظيف الآن</option>
                    <option value="in_maintenance">تحت الصيانة الفنية</option>
                    <option value="blocked">محجوبة ومغلقة</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-[#68675F] block mb-1">حالة النشر والبيع</label>
                  <select
                    value={basicForm.publicationStatus}
                    onChange={(e) => setBasicForm({ ...basicForm, publicationStatus: e.target.value as any })}
                    className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl cursor-pointer"
                  >
                    <option value="published">معروضة للبيع والحجز</option>
                    <option value="draft">مسودة للتعديل</option>
                    <option value="archived">مؤرشفة ومعطلة</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-[#68675F] block mb-1">ملاحظات داخلية للمشرفين والعمال</label>
                <textarea
                  rows={2}
                  value={basicForm.notes}
                  onChange={(e) => setBasicForm({ ...basicForm, notes: e.target.value })}
                  className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl text-right focus:outline-none focus:border-[#B69A68]"
                />
              </div>

              <button
                type="submit"
                className="py-2.5 px-6 bg-[#282824] hover:bg-[#1a1a18] text-white font-bold rounded-xl transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <Save className="w-4 h-4 text-[#B69A68]" />
                <span>حفظ البيانات الأساسية للوحدة</span>
              </button>
            </form>
          )}

          {/* TAB 2: SPACES & FITTINGS EDITOR */}
          {activeTab === 'spaces' && (
            <div className="space-y-6 text-xs text-right">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#F7F3EB]/60 rounded-2xl border border-[#E3DCCD]">
                <div>
                  <h4 className="font-bold text-sm text-[#282824]">توزيع فراغات وجرد أثاث الشقة</h4>
                  <p className="text-[#68675F] mt-0.5">يمكنك إضافة فراغات جديدة (غرفة نوم، مطبخ، دورة مياه، صالة معيشة) وجرد الأثاث التابع لها بالكامل.</p>
                </div>
                <button
                  onClick={() => setIsAddingSpace(true)}
                  className="px-3.5 py-2 bg-[#B69A68] hover:bg-[#a68a58] text-white font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة فراغ جديد</span>
                </button>
              </div>

              {/* Add Space Drawer */}
              {isAddingSpace && (
                <form onSubmit={handleCreateSpace} className="p-4 bg-white rounded-2xl border-2 border-[#B69A68]/60 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between pb-2 border-b border-[#E3DCCD]">
                    <h5 className="font-bold text-[#282824]">إضافة فراغ مخصص للشقة</h5>
                    <button type="button" onClick={() => setIsAddingSpace(false)} className="text-[#68675F]">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[#68675F] font-semibold mb-1">اسم الفراغ *</label>
                      <input
                        type="text"
                        required
                        placeholder="مثال: غرفه النوم الماستر"
                        value={newSpaceForm.name}
                        onChange={(e) => setNewSpaceForm({ ...newSpaceForm, name: e.target.value })}
                        className="w-full p-2 bg-[#F7F3EB]/40 border border-[#E3DCCD] rounded-xl text-right"
                      />
                    </div>
                    <div>
                      <label className="block text-[#68675F] font-semibold mb-1">نوع الفراغ</label>
                      <select
                        value={newSpaceForm.type}
                        onChange={(e) => setNewSpaceForm({ ...newSpaceForm, type: e.target.value as any })}
                        className="w-full p-2 bg-[#F7F3EB]/40 border border-[#E3DCCD] rounded-xl cursor-pointer"
                      >
                        <option value="bedroom">غرفة نوم مستقلة</option>
                        <option value="living_room">صالة معيشة ومجلس</option>
                        <option value="kitchen">مطبخ مجهز</option>
                        <option value="bathroom">دورة مياه وصحي</option>
                        <option value="dining_room">منطقة لتناول الطعام</option>
                        <option value="balcony">شرفة خارجية</option>
                        <option value="storage">مستودع وغرفة غسيل</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[#68675F] font-semibold mb-1">المساحة التقريبية (م²)</label>
                      <input
                        type="number"
                        value={newSpaceForm.areaSqm}
                        onChange={(e) => setNewSpaceForm({ ...newSpaceForm, areaSqm: Number(e.target.value) })}
                        className="w-full p-2 bg-[#F7F3EB]/40 border border-[#E3DCCD] rounded-xl tabular-nums"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={() => setIsAddingSpace(false)} className="px-3 py-1.5 border border-[#E3DCCD] rounded-xl">إلغاء</button>
                    <button type="submit" className="px-4 py-1.5 bg-[#282824] text-white rounded-xl font-bold shadow-xs">تأكيد الإضافة</button>
                  </div>
                </form>
              )}

              {/* Spaces Layout & Fittings Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Spaces List Column */}
                <div className="space-y-2 text-right">
                  <span className="font-bold text-[#68675F] block mb-2">قائمة الفراغات الإنشائية المحددة:</span>
                  {unit.spaces.map(sp => (
                    <div
                      key={sp.id}
                      onClick={() => setSelectedSpaceId(sp.id)}
                      className={`p-3 rounded-2xl border text-right cursor-pointer transition-all flex items-center justify-between ${
                        (selectedSpaceId === sp.id || (!selectedSpaceId && unit.spaces[0]?.id === sp.id))
                          ? 'border-[#B69A68] bg-[#FFFCF6] shadow-sm'
                          : 'border-[#E3DCCD] bg-white hover:bg-[#F7F3EB]/40'
                      }`}
                    >
                      <div>
                        <strong className="block text-sm text-[#282824]">{sp.name}</strong>
                        <span className="text-[11px] text-[#68675F]">
                          الفئة: {sp.type} · جرد القطع: ({sp.fittings?.length || 0})
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`هل أنت متأكد من رغبتك في حذف الفراغ "${sp.name}" بكافة محتوياته وأثاثه؟`)) {
                            deleteUnitSpace(unit.id, sp.id);
                          }
                        }}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="حذف الفراغ"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Selected Space Fittings & Furniture Editor */}
                <div className="md:col-span-2 bg-white rounded-2xl border border-[#E3DCCD] p-5 space-y-4">
                  {currentSpace ? (
                    <>
                      <div className="flex items-center justify-between pb-3 border-b border-[#E3DCCD]">
                        <div>
                          <h5 className="font-bold text-base text-[#282824]">محتويات أثاث الفراغ: {currentSpace.name}</h5>
                          <span className="text-xs text-[#68675F]">
                            نوع الفراغ: {currentSpace.type} {currentSpace.areaSqm ? `· المساحة: (${currentSpace.areaSqm} م²)` : ''}
                          </span>
                        </div>
                        <button
                          onClick={() => setIsAddingFitting(true)}
                          className="px-3 py-1.5 bg-[#282824] hover:bg-[#1a1a18] text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5 text-[#B69A68]" />
                          <span>إضافة قطعة جرد</span>
                        </button>
                      </div>

                      {/* Add Fitting Form */}
                      {isAddingFitting && (
                        <form onSubmit={handleCreateFitting} className="p-3.5 bg-[#F7F3EB] rounded-xl border border-[#E3DCCD] space-y-3 animate-in fade-in">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div>
                              <label className="block text-[11px] font-semibold text-[#68675F] mb-1">اسم ووصف القطعة *</label>
                              <input
                                type="text"
                                required
                                placeholder="مثال: شاشة تلفزيون ٥٥ بوصة"
                                value={newFittingForm.name}
                                onChange={(e) => setNewFittingForm({ ...newFittingForm, name: e.target.value })}
                                className="w-full p-2 bg-white border border-[#E3DCCD] rounded-lg text-right"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-[#68675F] mb-1">فئة ومجموعة الأثاث</label>
                              <select
                                value={newFittingForm.category}
                                onChange={(e) => setNewFittingForm({ ...newFittingForm, category: e.target.value as any })}
                                className="w-full p-2 bg-white border border-[#E3DCCD] rounded-lg cursor-pointer"
                              >
                                <option value="bed">سرير مراتب ومفارش</option>
                                <option value="furniture">قطع أثاث وديكور</option>
                                <option value="appliance">أجهزة منزلية كهربائية</option>
                                <option value="electronics">شاشات وأجهزة إلكترونية</option>
                                <option value="sanitary">تجهيزات صحية ومراسل</option>
                                <option value="linen">بياضات ومناشف فندقية</option>
                                <option value="other">أدوات تشغيلية أخرى</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-[#68675F] mb-1">الكمية الإجمالية</label>
                              <input
                                type="number"
                                min="1"
                                value={newFittingForm.quantity}
                                onChange={(e) => setNewFittingForm({ ...newFittingForm, quantity: Number(e.target.value) })}
                                className="w-full p-2 bg-white border border-[#E3DCCD] rounded-lg tabular-nums"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setIsAddingFitting(false)} className="px-2.5 py-1 border border-[#E3DCCD] rounded-lg text-xs">إلغاء</button>
                            <button type="submit" className="px-3.5 py-1 bg-[#282824] text-white rounded-lg text-xs font-bold shadow-xs">حفظ القطعة</button>
                          </div>
                        </form>
                      )}

                      {/* Fittings List */}
                      {(!currentSpace.fittings || currentSpace.fittings.length === 0) ? (
                        <div className="text-center py-8 text-[#68675F]">
                          لا توجد قطع أثاث مسجلة في هذا الفراغ حتى الآن. يرجى البدء بإدراج قطع الجرد.
                        </div>
                      ) : (
                        <div className="divide-y divide-[#E3DCCD] text-right">
                          {currentSpace.fittings.map(fit => (
                            <div key={fit.id} className="py-2.5 flex items-center justify-between text-xs">
                              <div>
                                <strong className="text-sm font-semibold text-[#282824]">{fit.name}</strong>
                                <span className="text-[#68675F] mr-2 block sm:inline">
                                  (التصنيف: {fit.category}) {fit.specifications ? `· مواصفات: ${fit.specifications}` : ''}
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="px-2.5 py-1 bg-[#F7F3EB] rounded-md font-bold text-[#282824] tabular-nums">
                                  الكمية: {fit.quantity}
                                </span>
                                <button
                                  onClick={() => deleteSpaceFitting(unit.id, currentSpace.id, fit.id)}
                                  className="text-rose-600 hover:bg-rose-50 p-1.5 rounded transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-10 text-[#68675F]">
                      يرجى اختيار فراغ من القائمة الجانبية لتعديل قطع الأثاث الخاصة به.
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* TAB 3: AMENITIES */}
          {activeTab === 'amenities' && (
            <div className="space-y-4 text-xs text-right">
              <h4 className="font-bold text-sm text-[#282824]">الخدمات الفندقية والميزات المعروضة للوحدة</h4>
              <p className="text-[#68675F]">حدد من القائمة الميزات المتاحة في هذه الشقة لتعرض للنزلاء على البوابة الإلكترونية:</p>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                {state.amenities.map(am => {
                  const isChecked = unit.amenities.includes(am.id);
                  return (
                    <label
                      key={am.id}
                      className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                        isChecked ? 'bg-[#FFFCF6] border-[#B69A68] shadow-xs' : 'bg-white border-[#E3DCCD]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const updated = e.target.checked
                            ? [...unit.amenities, am.id]
                            : unit.amenities.filter(id => id !== am.id);
                          updateUnit(unit.id, { amenities: updated });
                        }}
                        className="rounded accent-[#B69A68] w-4 h-4 cursor-pointer"
                      />
                      <span className="font-semibold text-[#282824]">{am.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: PRICING & POLICIES (DAILY, MONTHLY, YEARLY) */}
          {activeTab === 'pricing' && (
            <div className="space-y-4 text-xs text-right">
              <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex items-center gap-2 text-amber-900 leading-relaxed">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                <span>تحقق من تفعيل فئات التسعير. يجب على الأقل تشغيل نوع حجز واحد لإتاحة الشقة للنزلاء في عمليات الحجز والبحث المطور.</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* 1. Daily Pricing Card */}
                <div className={`p-4 rounded-2xl border transition-all space-y-3 ${
                  basicForm.allowDaily ? 'bg-white border-[#B69A68] shadow-xs' : 'bg-stone-50 border-stone-200 opacity-80'
                }`}>
                  <div className="flex items-center justify-between pb-2 border-b border-[#E3DCCD]">
                    <strong className="text-sm font-bold text-[#282824]">١. الإيجار اليومي</strong>
                    <label className="flex items-center gap-1.5 cursor-pointer font-bold">
                      <input
                        type="checkbox"
                        checked={basicForm.allowDaily}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setBasicForm(prev => ({ ...prev, allowDaily: val }));
                          updateUnit(unit.id, { allowDaily: val });
                        }}
                        className="accent-[#B69A68]"
                      />
                      <span>تفعيل</span>
                    </label>
                  </div>
                  <div>
                    <label className="block text-[#68675F] mb-1 font-semibold">سعر الليلة (ر.س)</label>
                    <input
                      type="number"
                      disabled={!basicForm.allowDaily}
                      value={basicForm.dailyRate}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setBasicForm(prev => ({ ...prev, dailyRate: val }));
                        updateUnit(unit.id, { dailyRate: val });
                      }}
                      className="w-full p-2 bg-[#F7F3EB]/40 border border-[#E3DCCD] rounded-xl font-bold tabular-nums disabled:bg-stone-100 text-left focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[#68675F] mb-1 font-semibold">تأمين الليلة المسترد (ر.س)</label>
                    <input
                      type="number"
                      disabled={!basicForm.allowDaily}
                      value={basicForm.dailySecurityDeposit}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setBasicForm(prev => ({ ...prev, dailySecurityDeposit: val }));
                        updateUnit(unit.id, { dailySecurityDeposit: val });
                      }}
                      className="w-full p-2 bg-[#F7F3EB]/40 border border-[#E3DCCD] rounded-xl tabular-nums disabled:bg-stone-100 text-left focus:outline-none"
                    />
                  </div>
                </div>

                {/* 2. Monthly Pricing Card */}
                <div className={`p-4 rounded-2xl border transition-all space-y-3 ${
                  basicForm.allowMonthly ? 'bg-white border-[#B69A68] shadow-xs' : 'bg-stone-50 border-stone-200 opacity-80'
                }`}>
                  <div className="flex items-center justify-between pb-2 border-b border-[#E3DCCD]">
                    <strong className="text-sm font-bold text-[#282824]">٢. الإيجار الشهري</strong>
                    <label className="flex items-center gap-1.5 cursor-pointer font-bold">
                      <input
                        type="checkbox"
                        checked={basicForm.allowMonthly}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setBasicForm(prev => ({ ...prev, allowMonthly: val }));
                          updateUnit(unit.id, { allowMonthly: val });
                        }}
                        className="accent-[#B69A68]"
                      />
                      <span>تفعيل</span>
                    </label>
                  </div>
                  <div>
                    <label className="block text-[#68675F] mb-1 font-semibold">سعر الشهر (ر.س)</label>
                    <input
                      type="number"
                      disabled={!basicForm.allowMonthly}
                      value={basicForm.monthlyRate}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setBasicForm(prev => ({ ...prev, monthlyRate: val }));
                        updateUnit(unit.id, { monthlyRate: val });
                      }}
                      className="w-full p-2 bg-[#F7F3EB]/40 border border-[#E3DCCD] rounded-xl font-bold tabular-nums disabled:bg-stone-100 text-left focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[#68675F] mb-1 font-semibold">تأمين العقود الشهرية (ر.س)</label>
                    <input
                      type="number"
                      disabled={!basicForm.allowMonthly}
                      value={basicForm.monthlySecurityDeposit}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setBasicForm(prev => ({ ...prev, monthlySecurityDeposit: val }));
                        updateUnit(unit.id, { monthlySecurityDeposit: val });
                      }}
                      className="w-full p-2 bg-[#F7F3EB]/40 border border-[#E3DCCD] rounded-xl tabular-nums disabled:bg-stone-100 text-left focus:outline-none"
                    />
                  </div>
                </div>

                {/* 3. Yearly Pricing Card */}
                <div className={`p-4 rounded-2xl border transition-all space-y-3 ${
                  basicForm.allowYearly ? 'bg-white border-[#B69A68] shadow-xs' : 'bg-stone-50 border-stone-200 opacity-80'
                }`}>
                  <div className="flex items-center justify-between pb-2 border-b border-[#E3DCCD]">
                    <strong className="text-sm font-bold text-[#282824]">٣. الإيجار السنوي</strong>
                    <label className="flex items-center gap-1.5 cursor-pointer font-bold">
                      <input
                        type="checkbox"
                        checked={basicForm.allowYearly}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setBasicForm(prev => ({ ...prev, allowYearly: val }));
                          updateUnit(unit.id, { allowYearly: val });
                        }}
                        className="accent-[#B69A68]"
                      />
                      <span>تفعيل</span>
                    </label>
                  </div>
                  <div>
                    <label className="block text-[#68675F] mb-1 font-semibold">قيمة العقد السنوي (ر.س)</label>
                    <input
                      type="number"
                      disabled={!basicForm.allowYearly}
                      value={basicForm.yearlyRate}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setBasicForm(prev => ({ ...prev, yearlyRate: val }));
                        updateUnit(unit.id, { yearlyRate: val });
                      }}
                      className="w-full p-2 bg-[#F7F3EB]/40 border border-[#E3DCCD] rounded-xl font-bold tabular-nums disabled:bg-stone-100 text-left focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[#68675F] mb-1 font-semibold">تأمين السكن السنوي (ر.س)</label>
                    <input
                      type="number"
                      disabled={!basicForm.allowYearly}
                      value={basicForm.yearlySecurityDeposit}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setBasicForm(prev => ({ ...prev, yearlySecurityDeposit: val }));
                        updateUnit(unit.id, { yearlySecurityDeposit: val });
                      }}
                      className="w-full p-2 bg-[#F7F3EB]/40 border border-[#E3DCCD] rounded-xl tabular-nums disabled:bg-stone-100 text-left focus:outline-none"
                    />
                  </div>
                  <div className="pt-2 border-t border-[#E3DCCD]/60 space-y-1.5">
                    <span className="block text-[11px] font-bold text-[#282824]">خيارات دفع العقد السنوي:</span>
                    <label className="flex items-center gap-2 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        disabled={!basicForm.allowYearly}
                        checked={basicForm.yearlyPaymentOptions.includes('single_annual')}
                        onChange={(e) => {
                          const updated = e.target.checked
                            ? [...basicForm.yearlyPaymentOptions, 'single_annual' as const]
                            : basicForm.yearlyPaymentOptions.filter(o => o !== 'single_annual');
                          setBasicForm(prev => ({ ...prev, yearlyPaymentOptions: updated }));
                          updateUnit(unit.id, { yearlyPaymentOptions: updated });
                        }}
                        className="accent-[#B69A68]"
                      />
                      <span>دفعة سنوية كاملة (١٠٠٪)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        disabled={!basicForm.allowYearly}
                        checked={basicForm.yearlyPaymentOptions.includes('semi_annual')}
                        onChange={(e) => {
                          const updated = e.target.checked
                            ? [...basicForm.yearlyPaymentOptions, 'semi_annual' as const]
                            : basicForm.yearlyPaymentOptions.filter(o => o !== 'semi_annual');
                          setBasicForm(prev => ({ ...prev, yearlyPaymentOptions: updated }));
                          updateUnit(unit.id, { yearlyPaymentOptions: updated });
                        }}
                        className="accent-[#B69A68]"
                      />
                      <span>دفعتين نصف سنوية</span>
                    </label>
                  </div>
                </div>

              </div>

              {/* Shared Fees and Taxes */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-[#F7F3EB]/50 rounded-2xl border border-[#E3DCCD]">
                <div>
                  <label className="block text-[#68675F] mb-1 font-semibold">رسوم النظافة الافتراضية (ر.س)</label>
                  <input
                    type="number"
                    value={basicForm.cleaningFee}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setBasicForm(prev => ({ ...prev, cleaningFee: val }));
                      updateUnit(unit.id, { cleaningFee: val });
                    }}
                    className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl tabular-nums text-left focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[#68675F] mb-1 font-semibold">مبلغ تأمين احتياطي افتراضي (ر.س)</label>
                  <input
                    type="number"
                    value={basicForm.securityDeposit}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setBasicForm(prev => ({ ...prev, securityDeposit: val }));
                      updateUnit(unit.id, { securityDeposit: val });
                    }}
                    className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl tabular-nums text-left focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[#68675F] mb-1 font-semibold">ضريبة القيمة المضافة الحكومية (٪)</label>
                  <input
                    type="number"
                    value={basicForm.taxPercentage}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setBasicForm(prev => ({ ...prev, taxPercentage: val }));
                      updateUnit(unit.id, { taxPercentage: val });
                    }}
                    className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl tabular-nums text-left focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: MEDIA & PLAN */}
          {activeTab === 'media' && (
            <div className="space-y-4 text-xs text-right">
              <h4 className="font-bold text-sm text-[#282824]">مخطط الشقة والصور المرفقة</h4>
              
              <div className="p-4 bg-white rounded-2xl border border-[#E3DCCD] space-y-2">
                <label className="font-semibold text-[#68675F] block">رابط صورة مخطط الشقة الهندسي (Floor Plan URL):</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={basicForm.floorPlanUrl}
                  onChange={(e) => {
                    setBasicForm(prev => ({ ...prev, floorPlanUrl: e.target.value }));
                    updateUnit(unit.id, { floorPlanUrl: e.target.value });
                  }}
                  className="w-full p-2.5 bg-[#F7F3EB]/40 border border-[#E3DCCD] rounded-xl text-left focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {unit.media.map(m => (
                  <div key={m.id} className="relative rounded-xl overflow-hidden border border-[#E3DCCD] h-28 group">
                    <img src={m.url} alt={m.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2 text-center text-white text-[10px]">
                      {m.title} ({m.category})
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: PARKING ASSIGNMENT */}
          {activeTab === 'parking' && (
            <div className="space-y-4 text-xs text-right">
              <div className="p-4 bg-white rounded-2xl border border-[#E3DCCD] space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#282824] text-white rounded-xl">
                    <Car className="w-5 h-5 text-[#B69A68]" />
                  </div>
                  <div>
                    <strong className="text-sm font-bold text-[#282824] block">تخصيص موقف خاص ومستقل للنزيل</strong>
                    <span className="text-[#68675F]">لا يسمح بربط موقف سيارة واحد لصالح شقتين في نفس الوقت لأغراض الأمان والنزاهة العقارية.</span>
                  </div>
                </div>

                <div className="pt-2 text-right">
                  <label className="font-semibold text-[#68675F] block mb-2">اختر موقفاً متاحاً في نفس البرج ({property?.name}):</label>
                  <select
                    value={unit.assignedParkingId || 'none'}
                    onChange={(e) => handleAssignParking(e.target.value)}
                    className="w-full p-2.5 bg-[#F7F3EB]/60 border border-[#E3DCCD] rounded-xl font-bold text-sm text-[#282824] cursor-pointer"
                  >
                    <option value="none">-- إلغاء تعيين أي موقف (شاغر) --</option>
                    {propertyParkings.map(ps => {
                      const isThisUnit = ps.assignedUnitId === unit.id;
                      const isOtherUnit = ps.assignedUnitId && ps.assignedUnitId !== unit.id;
                      const otherUnit = isOtherUnit ? state.units.find(u => u.id === ps.assignedUnitId) : null;

                      return (
                        <option
                          key={ps.id}
                          value={ps.id}
                          disabled={Boolean(isOtherUnit)}
                        >
                          {ps.spotNumber} ({ps.locationLabel || ps.location} - {ps.type}) {isThisUnit ? '[معين حالياً لهذه الشقة]' : isOtherUnit ? `[شغل الشقة #${otherUnit?.unitNumber || ''}]` : '[متاح فارغ]'}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {unit.assignedParkingId && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs">
                    <strong>الموقف معين بنجاح:</strong> كود الموقف متصل الآن تلقائياً ببوابة النزيل ليعرض للعميل عند تأكيد الحجز.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 7: BOOKINGS & LEASES HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-4 text-xs text-right">
              <h4 className="font-bold text-sm text-[#282824]">تاريخ وحركات السجلات السابقة على الشقة</h4>
              
              {activeBookings.length === 0 && activeLeases.length === 0 ? (
                <div className="text-center py-8 text-xs text-[#68675F] bg-white rounded-2xl border border-[#E3DCCD]">
                  لا توجد سجلات مالية أو حجوزات مسجلة على هذه الوحدة الفندقية تاريخياً.
                </div>
              ) : (
                <div className="space-y-3">
                  {activeBookings.map(b => (
                    <div key={b.id} className="p-3.5 bg-white rounded-xl border border-[#E3DCCD] flex items-center justify-between text-right">
                      <div>
                        <strong className="block text-sm text-[#282824]">حجز فندقي يومي: #{b.bookingNumber}</strong>
                        <span className="text-[#68675F]">الضيف: {b.guest.fullName} · الإقامة: {b.checkIn} إلى {b.checkOut}</span>
                      </div>
                      <span className="px-2.5 py-1 bg-amber-50 text-amber-900 font-bold rounded-md">
                        {b.status === 'checked_in' ? 'نزيل حالي' : b.status === 'completed' ? 'مكتمل ومغادر' : b.status}
                      </span>
                    </div>
                  ))}
                  {activeLeases.map(l => (
                    <div key={l.id} className="p-3.5 bg-white rounded-xl border border-[#E3DCCD] flex items-center justify-between text-right">
                      <div>
                        <strong className="block text-sm text-[#282824]">عقد إيجار {l.rentalType === 'yearly' ? 'سنوي' : 'شهري'}: #{l.contractNumber}</strong>
                        <span className="text-[#68675F]">المستأجر: {l.tenant.fullName} · فترة السكن: {l.startDate} إلى {l.endDate}</span>
                      </div>
                      <span className="px-2.5 py-1 bg-blue-50 text-blue-900 font-bold rounded-md">
                        {l.status === 'active' ? 'نشط وساري' : l.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
