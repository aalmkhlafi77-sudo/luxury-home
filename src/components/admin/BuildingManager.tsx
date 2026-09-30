import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Property, Unit, ParkingSpot } from '../../types';
import { UnitEditorModal } from './UnitEditorModal';
import { ImageWithFallback } from '../common/ImageWithFallback';
import {
  Building2,
  Plus,
  Layers,
  Car,
  Sparkles,
  Copy,
  Edit3,
  Trash2,
  Save,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Maximize2,
  Bed,
  Bath,
  ArrowRight,
  SlidersHorizontal,
  X
} from 'lucide-react';

export const BuildingManager: React.FC = () => {
  const {
    state,
    createProperty,
    updateProperty,
    createFloor,
    createUnit,
    batchCreateUnits,
    cloneUnit,
    archiveUnit,
    createParkingSpot,
    deleteParkingSpot,
    unassignParking
  } = useAppStore();

  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(state.properties[0]?.id || '');
  const [activeTab, setActiveTab] = useState<'general' | 'floors_units' | 'parking' | 'facilities' | 'media'>('floors_units');

  // Modal triggers
  const [isCreatingBuilding, setIsCreatingBuilding] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [isBatchAdding, setIsBatchAdding] = useState(false);
  const [isCloningUnit, setIsCloningUnit] = useState<Unit | null>(null);
  const [isAddingParking, setIsAddingParking] = useState(false);
  const [isAddingFloor, setIsAddingFloor] = useState(false);

  // Feedback
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Selected building object
  const currentProperty = state.properties.find(p => p.id === selectedPropertyId) || state.properties[0];

  // Dynamically calculated metrics (NOT hardcoded)
  const actualUnits = state.units.filter(u => u.propertyId === currentProperty?.id && u.publicationStatus !== 'archived');
  const actualParkings = state.parkingSpots.filter(p => p.propertyId === currentProperty?.id);
  const propertyFloors = state.floors.filter(f => f.propertyId === currentProperty?.id).sort((a, b) => a.floorNumber - b.floorNumber);

  // Create Building Form State
  const [newBuildingForm, setNewBuildingForm] = useState({
    name: '',
    nameEn: '',
    identifierCode: '',
    description: '',
    address: '',
    city: 'الرياض',
    district: '',
    latitude: 24.7136,
    longitude: 46.6753,
    totalFloors: 4,
    checkInTime: '15:00',
    checkOutTime: '12:00',
    entrancesCount: 1,
    elevatorsCount: 2,
    stairsCount: 1,
    status: 'published' as const,
  });

  // Batch Units Form State
  const [batchForm, setBatchForm] = useState({
    floorId: '',
    startNumber: 101,
    endNumber: 106,
    prefix: '',
    templateUnitId: '',
  });

  // Clone Unit Form State
  const [cloneUnitNumber, setCloneUnitNumber] = useState('');

  // Add Parking Form State
  const [newParkingForm, setNewParkingForm] = useState<{
    spotNumber: string;
    location: ParkingSpot['location'];
    locationLabel: string;
    type: ParkingSpot['type'];
    usageType: ParkingSpot['usageType'];
    instructions: string;
  }>({
    spotNumber: '',
    location: 'basement',
    locationLabel: 'القبو الأول',
    type: 'covered',
    usageType: 'dedicated_unit',
    instructions: '',
  });

  // Add Floor Form State
  const [newFloorForm, setNewFloorForm] = useState({
    floorNumber: 1,
    name: '',
    label: '',
  });

  const handleCreateBuildingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      const created = createProperty({
        ...newBuildingForm,
        slug: `bld-${newBuildingForm.identifierCode.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        tagline: 'مجمع سني فخم متكامل بمستوى خدمات فندقية راقي',
        media: [],
        amenities: ['smart_lock', 'wifi', 'cleaning', 'concierge'],
        featured: true,
        sharedFacilities: [
          { id: `sf-${Date.now()}-1`, name: 'الاستقبال والكونسيرج', type: 'reception', description: 'خدمات استقبال للنزلاء ٢٤ ساعة.' }
        ]
      });
      setSelectedPropertyId(created.id);
      setIsCreatingBuilding(false);
      setSuccessMsg(`تم إنشاء وتسجيل مبنى ${created.name} ومطابقة الطوابق التابعة له بنجاح.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleBatchUnitsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProperty || !batchForm.floorId) return;
    setErrorMsg(null);
    try {
      batchCreateUnits({
        propertyId: currentProperty.id,
        floorId: batchForm.floorId,
        startNumber: Number(batchForm.startNumber),
        endNumber: Number(batchForm.endNumber),
        prefix: batchForm.prefix,
        templateUnitId: batchForm.templateUnitId || undefined,
      });
      setIsBatchAdding(false);
      setSuccessMsg('تم توليد الوحدات السكنية المتعددة وإدراجها بنجاح في الطابق المختار.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleCloneUnitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCloningUnit || !cloneUnitNumber) return;
    setErrorMsg(null);
    try {
      cloneUnit(isCloningUnit.id, cloneUnitNumber);
      setIsCloningUnit(null);
      setCloneUnitNumber('');
      setSuccessMsg('تم نسخ الشقة وتوزيع كافة الغرف والأثاث على الشقة الجديدة بنجاح.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleCreateParkingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProperty || !newParkingForm.spotNumber) return;
    setErrorMsg(null);
    try {
      createParkingSpot({
        propertyId: currentProperty.id,
        ...newParkingForm,
        status: 'available',
      });
      setIsAddingParking(false);
      setNewParkingForm({
        spotNumber: '',
        location: 'basement',
        locationLabel: 'القبو الأول',
        type: 'covered',
        usageType: 'dedicated_unit',
        instructions: '',
      });
      setSuccessMsg('تم تسجيل موقف السيارة وإتاحته للتخصيص للوحدات بنجاح.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleCreateFloorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProperty || !newFloorForm.name) return;
    try {
      createFloor({
        propertyId: currentProperty.id,
        floorNumber: Number(newFloorForm.floorNumber),
        name: newFloorForm.name,
        label: newFloorForm.label,
      });
      setIsAddingFloor(false);
      setNewFloorForm({ floorNumber: 1, name: '', label: '' });
      setSuccessMsg('تم تسجيل الطابق الإضافي في هيكل المبنى بنجاح.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  return (
    <div className="space-y-6 text-right">
      
      {/* Top Selector & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 bg-white rounded-3xl border border-[#E3DCCD] shadow-xs min-w-0">
        <div className="flex items-center gap-3 min-w-0 max-w-full">
          <div className="p-3 bg-[#282824] text-white rounded-2xl shrink-0">
            <Building2 className="w-6 h-6 text-[#B69A68]" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-semibold text-[#68675F] block">المشروع النشط للتجهيز والمطابقة</span>
            <div className="flex items-center gap-2 mt-0.5 min-w-0">
              <select
                value={selectedPropertyId}
                onChange={(e) => setSelectedPropertyId(e.target.value)}
                className="font-bold text-sm sm:text-base text-[#282824] bg-transparent focus:outline-none cursor-pointer truncate max-w-[200px] sm:max-w-xs md:max-w-md"
              >
                {state.properties.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.identifierCode})</option>
                ))}
              </select>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-[#F7F3EB] text-[#B69A68] shrink-0 select-none">
                {currentProperty?.status === 'published' ? 'نشط معروض' : currentProperty?.status === 'draft' ? 'مسودة تجهيز' : 'غير مدرج للبيع'}
              </span>
            </div>
          </div>
        </div>
        
        {/* Global Action: Add New Building */}
        <button
          onClick={() => setIsCreatingBuilding(true)}
          className="w-full sm:w-auto px-4 py-2.5 bg-[#282824] hover:bg-[#1a1a18] text-white text-xs sm:text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4 text-[#B69A68] shrink-0" />
          <span>إضافة مشروع ومجمع سكني جديد</span>
        </button>
      </div>

      {/* Counter Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 select-none">
        <div className="p-4 bg-[#FFFCF6] rounded-2xl border border-[#E3DCCD]">
          <span className="text-xs text-[#68675F] block">إجمالي شقق المجمع</span>
          <span className="text-2xl font-bold text-[#282824] tabular-nums">{actualUnits.length}</span>
          <span className="text-[10px] text-[#68675F] block">وحدات مدرجة نشطة</span>
        </div>
        <div className="p-4 bg-[#FFFCF6] rounded-2xl border border-[#E3DCCD]">
          <span className="text-xs text-[#68675F] block">مواقف السيارات الكلية</span>
          <span className="text-2xl font-bold text-[#282824] tabular-nums">{actualParkings.length}</span>
          <span className="text-[10px] text-[#68675F] block">شواحن ومظلات</span>
        </div>
        <div className="p-4 bg-[#FFFCF6] rounded-2xl border border-[#E3DCCD]">
          <span className="text-xs text-[#68675F] block">عدد الطوابق الهندسية</span>
          <span className="text-2xl font-bold text-[#282824] tabular-nums">{propertyFloors.length}</span>
          <span className="text-[10px] text-[#68675F] block">شامل القبو والسطح</span>
        </div>
        <div className="p-4 bg-[#FFFCF6] rounded-2xl border border-[#E3DCCD]">
          <span className="text-xs text-[#68675F] block">المرافق الفندقية المشتركة</span>
          <span className="text-2xl font-bold text-[#282824] tabular-nums">{currentProperty?.sharedFacilities?.length || 0}</span>
          <span className="text-[10px] text-[#68675F] block">صالة، استقبال، لاونج</span>
        </div>
      </div>

      {/* Alerts */}
      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Building Tabs Container */}
      <div className="bg-white rounded-3xl border border-[#E3DCCD] overflow-hidden shadow-xs">
        
        {/* Navigation Tabs */}
        <div className="flex border-b border-[#E3DCCD] bg-[#F7F3EB]/40 overflow-x-auto text-xs font-semibold select-none">
          <button
            onClick={() => setActiveTab('floors_units')}
            className={`px-5 py-3.5 border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'floors_units' ? 'border-[#B69A68] text-[#282824] bg-white shadow-xs' : 'border-transparent text-[#68675F] hover:text-[#282824]'
            }`}
          >
            <Layers className="w-4 h-4 text-[#B69A68]" />
            <span>الطوابق والوحدات السكنية ({actualUnits.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('parking')}
            className={`px-5 py-3.5 border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'parking' ? 'border-[#B69A68] text-[#282824] bg-white shadow-xs' : 'border-transparent text-[#68675F] hover:text-[#282824]'
            }`}
          >
            <Car className="w-4 h-4 text-[#B69A68]" />
            <span>تنظيم مواقف السيارات ({actualParkings.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('general')}
            className={`px-5 py-3.5 border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'general' ? 'border-[#B69A68] text-[#282824] bg-white shadow-xs' : 'border-transparent text-[#68675F] hover:text-[#282824]'
            }`}
          >
            <Building2 className="w-4 h-4 text-[#B69A68]" />
            <span>بيانات المبنى والموقع</span>
          </button>
          <button
            onClick={() => setActiveTab('facilities')}
            className={`px-5 py-3.5 border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'facilities' ? 'border-[#B69A68] text-[#282824] bg-white shadow-xs' : 'border-transparent text-[#68675F] hover:text-[#282824]'
            }`}
          >
            <Sparkles className="w-4 h-4 text-[#B69A68]" />
            <span>المرافق والخدمات المشتركة</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-6">
          
          {/* TAB 1: FLOORS & UNITS */}
          {activeTab === 'floors_units' && (
            <div className="space-y-6">
              
              {/* Floor / Unit Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#E3DCCD] select-none">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#68675F]">
                  <span>إدارة وبناء وتوليد الهيكل السكني للبرج</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsAddingFloor(true)}
                    className="px-3.5 py-2 bg-[#F7F3EB] hover:bg-[#EFE9DF] text-[#282824] border border-[#E3DCCD] rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#B69A68]" />
                    <span>إضافة طابق مخصص</span>
                  </button>
                  <button
                    onClick={() => {
                      setBatchForm({
                        floorId: propertyFloors[0]?.id || '',
                        startNumber: 101,
                        endNumber: 106,
                        prefix: '',
                        templateUnitId: '',
                      });
                      setIsBatchAdding(true);
                    }}
                    className="px-3.5 py-2 bg-[#F7F3EB] hover:bg-[#EFE9DF] text-[#282824] border border-[#E3DCCD] rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-[#B69A68]" />
                    <span>توليد وتكرار شقق (Batch)</span>
                  </button>
                </div>
              </div>

              {/* Add Floor Form Modal */}
              {isAddingFloor && (
                <form onSubmit={handleCreateFloorSubmit} className="p-4 bg-[#F7F3EB]/60 rounded-2xl border border-[#E3DCCD] space-y-3 animate-in fade-in text-xs">
                  <div className="flex items-center justify-between">
                    <h5 className="font-bold text-[#282824]">إدراج طابق وهيكل جديد للمبنى</h5>
                    <button type="button" onClick={() => setIsAddingFloor(false)} className="cursor-pointer text-[#68675F]">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold mb-1 text-[#68675F]">الرقم الهندسي للدور (مثال: ١ أو -١ للقبو)</label>
                      <input
                        type="number"
                        required
                        value={newFloorForm.floorNumber}
                        onChange={(e) => setNewFloorForm(prev => ({ ...prev, floorNumber: Number(e.target.value) }))}
                        className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl text-right focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1 text-[#68675F]">اسم الطابق (عربي)</label>
                      <input
                        type="text"
                        required
                        placeholder="مثال: الدور الأول"
                        value={newFloorForm.name}
                        onChange={(e) => setNewFloorForm(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl text-right focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1 text-[#68675F]">الوسم التوضيحي البسيط</label>
                      <input
                        type="text"
                        placeholder="مثال: طابق الاستراحة"
                        value={newFloorForm.label}
                        onChange={(e) => setNewFloorForm(prev => ({ ...prev, label: e.target.value }))}
                        className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl text-right focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={() => setIsAddingFloor(false)} className="px-3 py-1.5 border border-[#E3DCCD] rounded-xl cursor-pointer">إلغاء</button>
                    <button type="submit" className="px-4 py-1.5 bg-[#282824] text-white rounded-xl font-bold cursor-pointer">حفظ الطابق</button>
                  </div>
                </form>
              )}

              {/* Batch Units Form Modal */}
              {isBatchAdding && (
                <form onSubmit={handleBatchUnitsSubmit} className="p-5 bg-[#FFFCF6] rounded-2xl border-2 border-[#B69A68] space-y-4 animate-in fade-in text-xs text-right">
                  <div className="flex items-center justify-between pb-2 border-b border-[#E3DCCD]">
                    <h5 className="font-bold text-sm text-[#282824]">توليد وتشييد شقق فندقية متعددة فوريًا</h5>
                    <button type="button" onClick={() => setIsBatchAdding(false)} className="cursor-pointer text-[#68675F]">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block font-semibold mb-1 text-[#68675F]">الطابق المستهدف لتأسيس الشقق *</label>
                      <select
                        required
                        value={batchForm.floorId}
                        onChange={(e) => setBatchForm(prev => ({ ...prev, floorId: e.target.value }))}
                        className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl cursor-pointer"
                      >
                        {propertyFloors.map(f => (
                          <option key={f.id} value={f.id}>{f.name} (الدور {f.floorNumber})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold mb-1 text-[#68675F]">رقم الشقة البادئ *</label>
                      <input
                        type="number"
                        required
                        value={batchForm.startNumber}
                        onChange={(e) => setBatchForm(prev => ({ ...prev, startNumber: Number(e.target.value) }))}
                        className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl font-bold tabular-nums text-left focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1 text-[#68675F]">رقم الشقة النهائي *</label>
                      <input
                        type="number"
                        required
                        value={batchForm.endNumber}
                        onChange={(e) => setBatchForm(prev => ({ ...prev, endNumber: Number(e.target.value) }))}
                        className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl font-bold tabular-nums text-left focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1 text-[#68675F]">بادئة ترقيم الشقق (اختياري)</label>
                      <input
                        type="text"
                        placeholder="مثال: N- أو O-"
                        value={batchForm.prefix}
                        onChange={(e) => setBatchForm(prev => ({ ...prev, prefix: e.target.value }))}
                        className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl text-left focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold mb-1 text-[#68675F]">الشقة النموذجية لنسخ الأثاث والأسعار (اختياري):</label>
                    <select
                      value={batchForm.templateUnitId}
                      onChange={(e) => setBatchForm(prev => ({ ...prev, templateUnitId: e.target.value }))}
                      className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl cursor-pointer"
                    >
                      <option value="">-- توليد شقق افتراضية غير منسوخة --</option>
                      {actualUnits.map(u => (
                        <option key={u.id} value={u.id}>طراز شقة #{u.unitNumber} ({u.title} - {u.bedroomsCount} غرف)</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex justify-end gap-2 pt-1.5 border-t border-[#E3DCCD]/60">
                    <button type="button" onClick={() => setIsBatchAdding(false)} className="px-3 py-1.5 border border-[#E3DCCD] rounded-xl cursor-pointer">إلغاء التوليد</button>
                    <button type="submit" className="px-5 py-2 bg-[#282824] text-white rounded-xl font-bold shadow-xs cursor-pointer">
                      تأكيد توليد عدد {Number(batchForm.endNumber) - Number(batchForm.startNumber) + 1} شقة
                    </button>
                  </div>
                </form>
              )}

              {/* Floors and Units Hierarchy List */}
              <div className="space-y-6">
                {propertyFloors.map(floor => {
                  const floorUnits = actualUnits.filter(u => u.floorNumber === floor.floorNumber);

                  return (
                    <div key={floor.id} className="p-4 bg-[#F7F3EB]/40 rounded-2xl border border-[#E3DCCD] space-y-4">
                      
                      {/* Floor Header */}
                      <div className="flex items-center justify-between pb-2 border-b border-[#E3DCCD]/60 select-none">
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-[#B69A68]" />
                          <h4 className="font-bold text-sm text-[#282824]">
                            {floor.name}
                          </h4>
                          <span className="text-xs text-[#68675F]">
                            ({floorUnits.length} شقة تشغيلية في هذا الدور)
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              // Quick create single unit
                              const nextNum = `${floor.floorNumber > 0 ? floor.floorNumber : 'B'}${Math.floor(10 + Math.random() * 89)}`;
                              createUnit({
                                propertyId: currentProperty.id,
                                floorId: floor.id,
                                unitNumber: nextNum,
                                title: `شقة منزل الفخامة رقم #${nextNum}`,
                                titleEn: `Unit #${nextNum}`,
                                type: 'apartment',
                                areaSqm: 90,
                                floorNumber: floor.floorNumber,
                                maxGuests: 3,
                                spaces: [
                                  {
                                    id: `sp-${Date.now()}-1`,
                                    name: 'صالة الجلوس الرائعة',
                                    type: 'living_room',
                                    fittings: [{ id: `f-${Date.now()}`, name: 'طقم كنب إيطالي فاخر وبياضات', category: 'furniture', quantity: 1 }]
                                  },
                                  {
                                    id: `sp-${Date.now()}-2`,
                                    name: 'غرفة النوم الرئيسية الدافئة',
                                    type: 'bedroom',
                                    bedsCount: 1,
                                    fittings: [{ id: `fb-${Date.now()}`, name: 'سرير كينج طبي بالكامل', category: 'bed', quantity: 1 }]
                                  },
                                  {
                                    id: `sp-${Date.now()}-3`,
                                    name: 'دورة المياه والجاكوزي',
                                    type: 'bathroom',
                                    fittings: [{ id: `fs-${Date.now()}`, name: 'تجهيز استحمام بورسلين', category: 'sanitary', quantity: 1 }]
                                  }
                                ],
                                amenities: ['smart_lock', 'wifi', 'cleaning'],
                                media: currentProperty.media[0] ? [currentProperty.media[0]] : [],
                                furnishingStatus: 'furnished',
                                allowDaily: true,
                                dailyRate: 700,
                                dailySecurityDeposit: 800,
                                allowMonthly: true,
                                monthlyRate: 14000,
                                monthlySecurityDeposit: 3000,
                                allowYearly: true,
                                yearlyRate: 140000,
                                yearlySecurityDeposit: 5000,
                                yearlyPaymentOptions: ['single_annual', 'semi_annual'],
                                cleaningFee: 120,
                                securityDeposit: 800,
                                taxPercentage: 15,
                                operationalStatus: 'ready',
                                occupancyStatus: 'vacant',
                              });
                            }}
                            className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-[#E3DCCD] hover:border-[#B69A68] rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5 text-[#B69A68]" />
                            <span>تأسيس شقة سريعة</span>
                          </button>
                        </div>
                      </div>

                      {/* Units Cards in this Floor */}
                      {floorUnits.length === 0 ? (
                        <div className="text-center py-6 text-xs text-[#68675F] bg-white rounded-xl border border-dashed border-[#E3DCCD] select-none">
                          لا توجد شقق فندقية مأسسة في هذا الطابق حالياً. يرجى البدء بإضافة شقة.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {floorUnits.map(unit => {
                            const assignedParking = state.parkingSpots.find(p => p.id === unit.assignedParkingId);
                            return (
                              <div
                                key={unit.id}
                                className="p-4 bg-white rounded-2xl border border-[#E3DCCD] hover:border-[#B69A68] transition-all flex flex-col justify-between group shadow-2xs"
                              >
                                <div>
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className="font-bold text-sm text-[#282824]">
                                      شقة #{unit.unitNumber}
                                    </span>
                                    <span className="text-[11px] font-semibold text-[#B69A68] bg-[#F7F3EB] px-2 py-0.5 rounded-md select-none">
                                      {unit.type === 'apartment' ? 'شقة كاملة' : unit.type === 'studio' ? 'استوديو مستقل' : 'بنتهاوس ملكي'}
                                    </span>
                                  </div>
                                  <h5 className="text-xs font-semibold text-[#282824] line-clamp-1 mb-2">
                                    {unit.title}
                                  </h5>

                                  {/* Dynamic counts */}
                                  <div className="grid grid-cols-3 gap-1 py-2 border-y border-[#E3DCCD]/60 text-[11px] text-[#68675F] mb-3 select-none text-center">
                                    <div className="flex items-center gap-1 justify-center">
                                      <Bed className="w-3.5 h-3.5 text-[#B69A68]" />
                                      <span>{unit.bedroomsCount} غرف</span>
                                    </div>
                                    <div className="flex items-center gap-1 justify-center">
                                      <Bath className="w-3.5 h-3.5 text-[#B69A68]" />
                                      <span>{unit.bathroomsCount} حمام</span>
                                    </div>
                                    <div className="flex items-center gap-1 justify-center">
                                      <Maximize2 className="w-3.5 h-3.5 text-[#B69A68]" />
                                      <span>{unit.areaSqm} م²</span>
                                    </div>
                                  </div>

                                  {/* Parking Tag */}
                                  <div className="text-[11px] text-[#68675F] mb-2 flex items-center justify-between select-none">
                                    <span>الموقف المخصص:</span>
                                    {assignedParking ? (
                                      <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded font-mono">
                                        {assignedParking.spotNumber}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400">لا يوجد موقف</span>
                                    )}
                                  </div>
                                </div>

                                {/* Card Actions */}
                                <div className="pt-2 border-t border-[#E3DCCD]/60 flex items-center justify-between gap-2">
                                  <button
                                    onClick={() => setEditingUnit(unit)}
                                    className="flex-1 py-1.5 px-2 bg-[#282824] hover:bg-[#1a1a18] text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                                  >
                                    <Edit3 className="w-3.5 h-3.5 text-[#B69A68]" />
                                    <span>تعديل التفاصيل</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setIsCloningUnit(unit);
                                      setCloneUnitNumber(`${unit.unitNumber}-B`);
                                    }}
                                    title="استنساخ الشقة الحالية بالكامل وطراز الفرش"
                                    className="p-1.5 border border-[#E3DCCD] hover:bg-[#F7F3EB] rounded-lg text-xs transition-colors cursor-pointer"
                                  >
                                    <Copy className="w-4 h-4 text-[#68675F]" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (confirm(`هل أنت متأكد من رغبتك في أرشفة الشقة #${unit.unitNumber}؟ سيتم حجبها تماماً وفك ربط المواقف.`)) {
                                        try {
                                          archiveUnit(unit.id);
                                          setSuccessMsg(`تم بنجاح أرشفة وتعطيل الشقة رقم #${unit.unitNumber}.`);
                                          setTimeout(() => setSuccessMsg(null), 3000);
                                        } catch (err: any) {
                                          setErrorMsg(err.message);
                                        }
                                      }
                                    }}
                                    title="أرشفة وتعطيل الوحدة"
                                    className="p-1.5 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-lg text-xs transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

            </div>
          )}

          {/* TAB 2: PARKING MANAGEMENT */}
          {activeTab === 'parking' && (
            <div className="space-y-6 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#F7F3EB]/60 rounded-2xl border border-[#E3DCCD]">
                <div>
                  <h4 className="font-bold text-sm text-[#282824]">مواقف السيارات التابعة للمجمع السكني ({actualParkings.length} موقف)</h4>
                  <p className="text-[#68675F] mt-0.5">يمكنك إضافة مواقف جديدة تابعة للبرج، وتعيينها حصرياً لصالح الأجنحة السكنية.</p>
                </div>
                <button
                  onClick={() => setIsAddingParking(true)}
                  className="px-3.5 py-2 bg-[#282824] hover:bg-[#1a1a18] text-white rounded-xl font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-[#B69A68]" />
                  <span>تأسيس موقف جديد</span>
                </button>
              </div>

              {/* Add Parking Form */}
              {isAddingParking && (
                <form onSubmit={handleCreateParkingSubmit} className="p-4 bg-white rounded-2xl border-2 border-[#B69A68] space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between pb-2 border-b border-[#E3DCCD]">
                    <h5 className="font-bold text-[#282824]">إدراج موقف سيارات جديد للمبنى</h5>
                    <button type="button" onClick={() => setIsAddingParking(false)} className="cursor-pointer text-[#68675F]">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[#68675F] font-semibold mb-1">رقم الموقف المطبوع *</label>
                      <input
                        type="text"
                        required
                        placeholder="مثال: P-B1-05"
                        value={newParkingForm.spotNumber}
                        onChange={(e) => setNewParkingForm(prev => ({ ...prev, spotNumber: e.target.value }))}
                        className="w-full p-2 bg-[#F7F3EB]/40 border border-[#E3DCCD] rounded-xl font-bold font-mono text-left focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[#68675F] font-semibold mb-1">الموقع الفني للموقف</label>
                      <select
                        value={newParkingForm.location}
                        onChange={(e) => setNewParkingForm(prev => ({ ...prev, location: e.target.value as any }))}
                        className="w-full p-2 bg-[#F7F3EB]/40 border border-[#E3DCCD] rounded-xl cursor-pointer"
                      >
                        <option value="basement">القبو الأول (Basement)</option>
                        <option value="ground">الدور الأرضي السطحي</option>
                        <option value="outdoor">مواقف الفناء الخارجي</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[#68675F] font-semibold mb-1">تجهيز ونوع الموقف</label>
                      <select
                        value={newParkingForm.type}
                        onChange={(e) => setNewParkingForm(prev => ({ ...prev, type: e.target.value as any }))}
                        className="w-full p-2 bg-[#F7F3EB]/40 border border-[#E3DCCD] rounded-xl cursor-pointer"
                      >
                        <option value="covered">مظلل مغطى بالكامل</option>
                        <option value="open">مكشوف مفتوح للزوار</option>
                        <option value="accessible">ذوي الاحتياجات الخاصة</option>
                        <option value="ev_charging">مزود بشاحن سيارات EV</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[#68675F] font-semibold mb-1">فئة ونوع التخصيص</label>
                      <select
                        value={newParkingForm.usageType}
                        onChange={(e) => setNewParkingForm(prev => ({ ...prev, usageType: e.target.value as any }))}
                        className="w-full p-2 bg-[#F7F3EB]/40 border border-[#E3DCCD] rounded-xl cursor-pointer"
                      >
                        <option value="dedicated_unit">مخصص لشقة فندقية محددة</option>
                        <option value="shared_building">مشترك لزوار المجمع والبهو</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[#68675F] font-semibold mb-1">تعليمات الدخول والوصول للموقف</label>
                    <input
                      type="text"
                      placeholder="مثال: يرجى استخدام البطاقة اللاسلكية عند البوابة رقم ٢ لفتح بوابة الموقف الذكية..."
                      value={newParkingForm.instructions}
                      onChange={(e) => setNewParkingForm(prev => ({ ...prev, instructions: e.target.value }))}
                      className="w-full p-2 bg-[#F7F3EB]/40 border border-[#E3DCCD] rounded-xl text-right focus:outline-none"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t border-[#E3DCCD]/60">
                    <button type="button" onClick={() => setIsAddingParking(false)} className="px-3 py-1.5 border border-[#E3DCCD] rounded-xl cursor-pointer">إلغاء</button>
                    <button type="submit" className="px-4 py-1.5 bg-[#282824] text-white rounded-xl font-bold cursor-pointer">حفظ الموقف</button>
                  </div>
                </form>
              )}

              {/* Parkings Table */}
              <div className="bg-white rounded-2xl border border-[#E3DCCD] overflow-hidden">
                <table className="w-full text-right border-collapse">
                  <thead className="bg-[#F7F3EB]">
                    <tr>
                      <th className="p-3 font-bold text-[#282824]">رقم الموقف</th>
                      <th className="p-3 font-bold text-[#282824]">الموقع والتجهيز</th>
                      <th className="p-3 font-bold text-[#282824]">نوع التخصيص</th>
                      <th className="p-3 font-bold text-[#282824]">الشقة الفندقية المرتبطة</th>
                      <th className="p-3 font-bold text-[#282824]">الحالة</th>
                      <th className="p-3 font-bold text-[#282824] text-left">التحكم</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E3DCCD]">
                    {actualParkings.map(ps => {
                      const assignedUnit = state.units.find(u => u.id === ps.assignedUnitId);
                      return (
                        <tr key={ps.id} className="hover:bg-[#FFFCF6] transition-colors">
                          <td className="p-3 font-bold text-[#282824] font-mono select-all">
                            {ps.spotNumber}
                          </td>
                          <td className="p-3 text-[#68675F]">
                            {ps.location === 'basement' ? 'القبو' : 'السطحي'} ({ps.type === 'ev_charging' ? 'شاحن كهربائي' : ps.type === 'covered' ? 'مظلل' : 'مكشوف'})
                          </td>
                          <td className="p-3 text-[#68675F]">
                            {ps.usageType === 'dedicated_unit' ? 'مخصص لشقة' : 'مشترك للزوار'}
                          </td>
                          <td className="p-3">
                            {assignedUnit ? (
                              <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                شقة #{assignedUnit.unitNumber} ({assignedUnit.title.slice(0, 16)}...)
                              </span>
                            ) : (
                              <span className="text-slate-400">غير مخصص</span>
                            )}
                          </td>
                          <td className="p-3">
                            <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                              ps.status === 'assigned' ? 'bg-blue-100 text-blue-900' : 'bg-emerald-100 text-emerald-900'
                            }`}>
                              {ps.status === 'assigned' ? 'معين ونشط' : 'شاغر ومتاح'}
                            </span>
                          </td>
                          <td className="p-3 text-left">
                            <div className="flex items-center justify-end gap-2">
                              {ps.assignedUnitId && (
                                <button
                                  onClick={() => unassignParking(ps.id)}
                                  className="text-xs text-amber-700 hover:underline font-bold cursor-pointer"
                                >
                                  فك الارتباط
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  if (confirm(`هل أنت متأكد من رغبتك في حذف الموقف رقم ${ps.spotNumber} تماماً؟`)) {
                                    deleteParkingSpot(ps.id);
                                  }
                                }}
                                className="text-rose-600 hover:bg-rose-50 p-1.5 rounded transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: GENERAL INFO */}
          {activeTab === 'general' && currentProperty && (
            <div className="space-y-4 text-xs max-w-3xl text-right">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-[#68675F] block mb-1">اسم المجمع السكني (عربي) *</label>
                  <input
                    type="text"
                    value={currentProperty.name}
                    onChange={(e) => updateProperty(currentProperty.id, { name: e.target.value })}
                    className="w-full p-2.5 bg-[#F7F3EB]/40 border border-[#E3DCCD] rounded-xl font-bold text-right focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#68675F] block mb-1">الكود التشغيلي التعريفي الموحد للمبنى *</label>
                  <input
                    type="text"
                    value={currentProperty.identifierCode}
                    onChange={(e) => updateProperty(currentProperty.id, { identifierCode: e.target.value.toUpperCase() })}
                    className="w-full p-2.5 bg-[#F7F3EB]/40 border border-[#E3DCCD] rounded-xl font-bold uppercase font-mono text-left focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="font-semibold text-[#68675F] block mb-1">الوصف التفصيلي والخطط التسويقية للمبنى</label>
                <textarea
                  rows={3}
                  value={currentProperty.description}
                  onChange={(e) => updateProperty(currentProperty.id, { description: e.target.value })}
                  className="w-full p-2.5 bg-[#F7F3EB]/40 border border-[#E3DCCD] rounded-xl text-right focus:outline-none focus:border-[#B69A68]"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-[#68675F] block mb-1">عدد مداخل المبنى</label>
                  <input
                    type="number"
                    value={currentProperty.entrancesCount || 1}
                    onChange={(e) => updateProperty(currentProperty.id, { entrancesCount: Number(e.target.value) })}
                    className="w-full p-2.5 bg-[#F7F3EB]/40 border border-[#E3DCCD] rounded-xl text-right focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#68675F] block mb-1">عدد المصاعد العاملة</label>
                  <input
                    type="number"
                    value={currentProperty.elevatorsCount || 2}
                    onChange={(e) => updateProperty(currentProperty.id, { elevatorsCount: Number(e.target.value) })}
                    className="w-full p-2.5 bg-[#F7F3EB]/40 border border-[#E3DCCD] rounded-xl text-right focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#68675F] block mb-1">حالة عرض مبيعات المجمع</label>
                  <select
                    value={currentProperty.status}
                    onChange={(e) => updateProperty(currentProperty.id, { status: e.target.value as any })}
                    className="w-full p-2.5 bg-[#F7F3EB]/40 border border-[#E3DCCD] rounded-xl font-bold cursor-pointer"
                  >
                    <option value="published">مفتوح للبيع والحجز التلقائي</option>
                    <option value="draft">تحت التأسيس والمراجعة</option>
                    <option value="unlisted">غير مدرج حالياً</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SHARED FACILITIES */}
          {activeTab === 'facilities' && currentProperty && (
            <div className="space-y-4 text-xs text-right">
              <h4 className="font-bold text-sm text-[#282824]">المرافق الفندقية المشتركة داخل البرج</h4>
              <p className="text-[#68675F]">المرافق المتاحة مجانًا لكافة النزلاء بموجب بطاقات الإقامة الفندقية للنزلاء:</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {currentProperty.sharedFacilities.map((fac) => (
                  <div key={fac.id} className="p-4 bg-white rounded-2xl border border-[#E3DCCD] space-y-2">
                    <div className="flex items-center justify-between">
                      <strong className="text-sm font-bold text-[#282824]">{fac.name}</strong>
                      <span className="text-[11px] text-[#B69A68] bg-[#F7F3EB] px-2 py-0.5 rounded font-bold select-none">
                        {fac.floor || 'الدور الأرضي'}
                      </span>
                    </div>
                    <p className="text-[#68675F]">{fac.description}</p>
                    <div className="text-[11px] text-[#282824] font-medium pt-1">ساعات العمل الرسمية: {fac.openingHours || '٢٤/٧ متاح'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: MEDIA */}
          {activeTab === 'media' && currentProperty && (
            <div className="space-y-4 text-xs text-right">
              <h4 className="font-bold text-sm text-[#282824]">صور وميديا الواجهات والمرافق العامة للبرج</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {currentProperty.media.map(m => (
                  <div key={m.id} className="rounded-2xl overflow-hidden border border-[#E3DCCD] h-48 relative shadow-xs">
                    <img src={m.url} alt={m.title} className="w-full h-full object-cover" />
                    <span className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 text-white rounded text-[10px] font-bold">
                      {m.title} ({m.category === 'facade' ? 'الواجهة' : 'البهو'})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* CREATE BUILDING MODAL */}
      {isCreatingBuilding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#FFFCF6] w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl border border-[#E3DCCD] my-auto text-right">
            <div className="p-5 border-b border-[#E3DCCD] flex items-center justify-between bg-[#F7F3EB]">
              <h3 className="text-base font-bold text-[#282824]">تأسيس وتسجيل مبنى وبرج سكني جديد</h3>
              <button onClick={() => setIsCreatingBuilding(false)} className="cursor-pointer text-[#68675F]">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateBuildingSubmit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-[#68675F] block mb-1">اسم البرج / المبنى السكني *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: منزل الفخامة الياسمين الفندقي"
                    value={newBuildingForm.name}
                    onChange={(e) => setNewBuildingForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl font-bold text-right focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#68675F] block mb-1">الكود المميز للتعريف الميداني *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: BLD-YSM-03"
                    value={newBuildingForm.identifierCode}
                    onChange={(e) => setNewBuildingForm(prev => ({ ...prev, identifierCode: e.target.value.toUpperCase() }))
                    }
                    className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl font-bold text-left font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-[#68675F] block mb-1">الحي السكني *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: حي الياسمين"
                    value={newBuildingForm.district}
                    onChange={(e) => setNewBuildingForm(prev => ({ ...prev, district: e.target.value }))}
                    className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl text-right focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#68675F] block mb-1">العنوان ووصف الوصول</label>
                  <input
                    type="text"
                    placeholder="مثال: طريق الملك سلمان بن عبد العزيز الفرعي"
                    value={newBuildingForm.address}
                    onChange={(e) => setNewBuildingForm(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl text-right focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-[#68675F] block mb-1">الوصف التسويقي والتشغيلي العام</label>
                <textarea
                  rows={2}
                  placeholder="اكتب هنا الميزات العامة للمجمع السكني..."
                  value={newBuildingForm.description}
                  onChange={(e) => setNewBuildingForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full p-2 bg-white border border-[#E3DCCD] rounded-xl text-right focus:outline-none focus:border-[#B69A68]"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-[#68675F] block mb-1">إجمالي الأدوار الهندسية</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={newBuildingForm.totalFloors}
                    onChange={(e) => setNewBuildingForm(prev => ({ ...prev, totalFloors: Number(e.target.value) }))}
                    className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl text-right focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#68675F] block mb-1">عدد المصاعد الهندسية</label>
                  <input
                    type="number"
                    value={newBuildingForm.elevatorsCount}
                    onChange={(e) => setNewBuildingForm(prev => ({ ...prev, elevatorsCount: Number(e.target.value) }))}
                    className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl text-right focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#68675F] block mb-1">عدد المداخل والبوابات</label>
                  <input
                    type="number"
                    value={newBuildingForm.entrancesCount}
                    onChange={(e) => setNewBuildingForm(prev => ({ ...prev, entrancesCount: Number(e.target.value) }))}
                    className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl text-right focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px] leading-relaxed select-none">
                سيقوم النظام تلقائياً بتأسيس الهيكل التنظيمي للطوابق شامل طابق القبو لمواقف السيارات وطابق البهو الاستقبال فور إتمام البناء بنجاح.
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#E3DCCD]/60">
                <button type="button" onClick={() => setIsCreatingBuilding(false)} className="px-4 py-2 border border-[#E3DCCD] rounded-xl cursor-pointer">إلغاء وتراجع</button>
                <button type="submit" className="px-6 py-2 bg-[#282824] text-white font-bold rounded-xl shadow-xs cursor-pointer">بناء وتسجيل المجمع فورا</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CLONE UNIT MODAL */}
      {isCloningUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#FFFCF6] w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-[#E3DCCD] text-right">
            <div className="p-4 border-b border-[#E3DCCD] flex items-center justify-between bg-[#F7F3EB]">
              <h4 className="font-bold text-sm text-[#282824]">استنساخ ونسخ الشقة بالكامل وطراز الفرش</h4>
              <button onClick={() => setIsCloningUnit(null)} className="cursor-pointer text-[#68675F]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCloneUnitSubmit} className="p-5 space-y-4 text-xs">
              <p className="text-[#68675F]">
                سيتم استنساخ كافة غرف ونماذج جرد أثاث الشقة النموذجية رقم #{isCloningUnit.unitNumber} وتأسيس شقة جديدة مطابقة بالترقيم التالي:
              </p>
              <div>
                <label className="font-semibold text-[#68675F] block mb-1">رقم الشقة الجديدة المستهدفة *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: 103 أو 203"
                  value={cloneUnitNumber}
                  onChange={(e) => setCloneUnitNumber(e.target.value)}
                  className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl font-bold text-left font-mono focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-[#E3DCCD]/60">
                <button type="button" onClick={() => setIsCloningUnit(null)} className="px-3 py-1.5 border border-[#E3DCCD] rounded-xl cursor-pointer">إلغاء</button>
                <button type="submit" className="px-4 py-2 bg-[#282824] text-white font-bold rounded-xl shadow-xs cursor-pointer">تأكيد الاستنساخ والنسخ</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT UNIT MODAL */}
      {editingUnit && (
        <UnitEditorModal
          unit={editingUnit}
          onClose={() => setEditingUnit(null)}
          onSaved={() => {
            const updated = state.units.find(u => u.id === editingUnit.id);
            if (updated) setEditingUnit(updated);
          }}
        />
      )}

    </div>
  );
};
