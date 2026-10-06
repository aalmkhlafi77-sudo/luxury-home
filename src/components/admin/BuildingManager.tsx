import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Property, Unit, ParkingSpot, City } from '../../types';
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
  X,
  Globe,
  Check,
  Power
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
    unassignParking,
    createCity,
    updateCity,
    deleteCity
  } = useAppStore();

  const [selectedCityFilter, setSelectedCityFilter] = useState<string>('all');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(state.properties[0]?.id || '');
  const [activeTab, setActiveTab] = useState<'general' | 'floors_units' | 'parking' | 'facilities' | 'media' | 'cities'>('floors_units');

  // Modal triggers
  const [isCreatingBuilding, setIsCreatingBuilding] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [isBatchAdding, setIsBatchAdding] = useState(false);
  const [isSubmittingBatch, setIsSubmittingBatch] = useState(false);
  const [isCloningUnit, setIsCloningUnit] = useState<Unit | null>(null);
  const [isAddingParking, setIsAddingParking] = useState(false);
  const [isAddingFloor, setIsAddingFloor] = useState(false);

  // City Management Modals & Forms State
  const [isAddingCity, setIsAddingCity] = useState(false);
  const [editingCity, setEditingCity] = useState<City | null>(null);
  const [newCityForm, setNewCityForm] = useState({
    name: '',
    nameEn: '',
    region: '',
    country: 'المملكة العربية السعودية',
    status: 'active' as const,
    displayOrder: 1,
  });

  // Feedback
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filtered properties based on selected city
  const filteredProperties = state.properties.filter(p => {
    if (selectedCityFilter === 'all') return true;
    return p.cityId === selectedCityFilter || p.city === selectedCityFilter;
  });

  // Selected building object
  const currentProperty = state.properties.find(p => p.id === selectedPropertyId) || filteredProperties[0] || state.properties[0];

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
    cityId: state.cities[0]?.id || '',
    city: state.cities[0]?.name || 'الرياض',
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

  // City Management Handlers
  const handleCreateCitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!newCityForm.name.trim()) {
      setErrorMsg('يرجى إدخال اسم المدينة باللغة العربية.');
      return;
    }

    // Client-side duplicate check
    const isDuplicate = state.cities.some(
      c => c.name.trim().toLowerCase() === newCityForm.name.trim().toLowerCase() &&
           (c.region || '').trim().toLowerCase() === (newCityForm.region || '').trim().toLowerCase() &&
           c.country.trim().toLowerCase() === (newCityForm.country || 'المملكة العربية السعودية').trim().toLowerCase()
    );

    if (isDuplicate) {
      setErrorMsg(`المدينة "${newCityForm.name}" مسجلة مسبقاً ضمن نفس المنطقة الإدارية والدولة.`);
      return;
    }

    try {
      const created = await createCity({
        name: newCityForm.name.trim(),
        nameEn: newCityForm.nameEn.trim() || undefined,
        region: newCityForm.region.trim() || undefined,
        country: newCityForm.country.trim() || 'المملكة العربية السعودية',
        status: newCityForm.status,
        displayOrder: Number(newCityForm.displayOrder) || (state.cities.length + 1),
      });

      setIsAddingCity(false);
      setNewCityForm({
        name: '',
        nameEn: '',
        region: '',
        country: 'المملكة العربية السعودية',
        status: 'active',
        displayOrder: state.cities.length + 2,
      });
      setSuccessMsg(`تم اعتماد وإضافة مدينة ${created.name} إلى سجل المدن المعتمدة بنجاح.`);
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل حفظ بيانات المدينة.');
    }
  };

  const handleUpdateCitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCity) return;
    setErrorMsg(null);

    try {
      const updated = await updateCity(editingCity.id, {
        name: editingCity.name.trim(),
        nameEn: editingCity.nameEn?.trim() || undefined,
        region: editingCity.region?.trim() || undefined,
        country: editingCity.country?.trim() || 'المملكة العربية السعودية',
        status: editingCity.status,
        displayOrder: Number(editingCity.displayOrder) || 0,
      });

      setEditingCity(null);
      setSuccessMsg(`تم تحديث بيانات مدينة ${updated.name} بنجاح.`);
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل تحديث بيانات المدينة.');
    }
  };

  const handleToggleCityStatus = async (city: City) => {
    setErrorMsg(null);
    const newStatus = city.status === 'active' ? 'inactive' : 'active';
    try {
      await updateCity(city.id, { status: newStatus });
      setSuccessMsg(`تم تغيير حالة مدينة ${city.name} إلى ${newStatus === 'active' ? 'نشطة معتمدة' : 'معطلة'} بنجاح.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل تغيير حالة المدينة.');
    }
  };

  const handleDeleteCity = async (city: City) => {
    setErrorMsg(null);
    // Strict Validation: Prevent deletion of a city linked to properties
    const linkedProperties = state.properties.filter(
      p => p.cityId === city.id || p.city === city.name
    );

    if (linkedProperties.length > 0) {
      setErrorMsg(
        `لا يمكن حذف مدينة "${city.name}" لأنها مرتبطة بـ (${linkedProperties.length}) مبانٍ سكنية نشطة (${linkedProperties.map(p => p.name).slice(0, 2).join('، ')}). يمكنك تعطيل المدينة بدلاً من حذفها أو إعادة تعيين المباني لمدينة أخرى أولاً.`
      );
      return;
    }

    if (!confirm(`هل أنت متأكد من حذف مدينة "${city.name}" من سجل النظام؟`)) {
      return;
    }

    try {
      await deleteCity(city.id);
      setSuccessMsg(`تم حذف مدينة "${city.name}" بنجاح.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل حذف المدينة.');
    }
  };

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

  const handleCreateBuildingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      const created = await createProperty({
        ...newBuildingForm,
        slug: `bld-${newBuildingForm.identifierCode.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        tagline: 'مجمع سكني فخم متكامل بمستوى خدمات فندقية راقي',
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
      setErrorMsg(err.message || 'فشل حفظ المبنى.');
    }
  };

  const handleBatchUnitsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProperty || !batchForm.floorId) return;
    setErrorMsg(null);
    setIsSubmittingBatch(true);
    try {
      await batchCreateUnits({
        propertyId: currentProperty.id,
        floorId: batchForm.floorId,
        startNumber: Number(batchForm.startNumber),
        endNumber: Number(batchForm.endNumber),
        prefix: batchForm.prefix,
        templateUnitId: batchForm.templateUnitId || undefined,
      });
      setIsBatchAdding(false);
      setSuccessMsg('تم توليد وتأكيد حفظ المجموعة كاملة في قاعدة البيانات بنجاح.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      // Retain form inputs and keep modal open on failure
      setErrorMsg(err.message || 'فشل توليد الوحدات.');
    } finally {
      setIsSubmittingBatch(false);
    }
  };

  const handleCloneUnitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCloningUnit || !cloneUnitNumber) return;
    setErrorMsg(null);
    try {
      await cloneUnit(isCloningUnit.id, cloneUnitNumber);
      setIsCloningUnit(null);
      setCloneUnitNumber('');
      setSuccessMsg('تم نسخ الشقة وتوزيع كافة الغرف والأثاث على الشقة الجديدة بنجاح.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل استنساخ الشقة.');
    }
  };

  const [isSubmittingParking, setIsSubmittingParking] = useState(false);

  const handleCreateParkingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProperty || !newParkingForm.spotNumber) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSubmittingParking(true);
    try {
      const created = await createParkingSpot({
        propertyId: currentProperty.id,
        ...newParkingForm,
        status: 'vacant',
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
      setSuccessMsg(`تم تسجيل موقف السيارة ${created.spotNumber} وإتاحته للتخصيص للوحدات بنجاح.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل إضافة موقف السيارات على الخادم.');
    } finally {
      setIsSubmittingParking(false);
    }
  };

  const handleUnassignParking = async (spotId: string) => {
    setErrorMsg(null);
    try {
      await unassignParking(spotId);
      setSuccessMsg('تم فك ربط موقف السيارة بنجاح.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل فك ربط موقف السيارة.');
    }
  };

  const handleDeleteParking = async (ps: ParkingSpot) => {
    if (!confirm(`هل أنت متأكد من رغبتك في حذف الموقف رقم ${ps.spotNumber} تماماً؟`)) return;
    setErrorMsg(null);
    try {
      await deleteParkingSpot(ps.id);
      setSuccessMsg('تم حذف موقف السيارات بنجاح.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل حذف موقف السيارات.');
    }
  };

  const handleCreateFloorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProperty || !newFloorForm.name) return;
    setErrorMsg(null);
    try {
      await createFloor({
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
      setErrorMsg(err.message || 'فشل حفظ الطابق.');
    }
  };

  return (
    <div className="space-y-6 text-right">
      
      {/* Top Selector & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 sm:p-5 bg-white rounded-3xl border border-[#E3DCCD] shadow-xs min-w-0">
        <div className="flex flex-wrap items-center gap-4 min-w-0 flex-1">
          <div className="p-3 bg-[#282824] text-white rounded-2xl shrink-0">
            <Building2 className="w-6 h-6 text-[#B69A68]" />
          </div>

          {/* City Filter */}
          <div className="min-w-[160px]">
            <span className="text-xs font-semibold text-[#68675F] block">تصفية حسب المدينة</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <MapPin className="w-4 h-4 text-[#B69A68] shrink-0" />
              <select
                value={selectedCityFilter}
                onChange={(e) => {
                  const newCity = e.target.value;
                  setSelectedCityFilter(newCity);
                  const matchingProps = state.properties.filter(p => newCity === 'all' || p.cityId === newCity || p.city === newCity);
                  if (matchingProps.length > 0 && !matchingProps.some(p => p.id === selectedPropertyId)) {
                    setSelectedPropertyId(matchingProps[0].id);
                  }
                }}
                className="font-bold text-xs sm:text-sm text-[#282824] bg-transparent focus:outline-none cursor-pointer"
              >
                <option value="all">جميع المدن ({state.cities?.length || 0})</option>
                {state.cities.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.status === 'inactive' ? '(معطلة)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="h-8 w-px bg-[#E3DCCD] hidden sm:block" />

          {/* Building Selector */}
          <div className="min-w-0 flex-1">
            <span className="text-xs font-semibold text-[#68675F] block">المشروع النشط للتجهيز والمطابقة</span>
            <div className="flex items-center gap-2 mt-0.5 min-w-0">
              <select
                value={selectedPropertyId}
                onChange={(e) => setSelectedPropertyId(e.target.value)}
                className="font-bold text-sm sm:text-base text-[#282824] bg-transparent focus:outline-none cursor-pointer truncate max-w-[200px] sm:max-w-xs md:max-w-md"
              >
                {filteredProperties.map(p => {
                  const cityName = state.cities.find(c => c.id === p.cityId)?.name || p.city;
                  return (
                    <option key={p.id} value={p.id}>{p.name} ({p.identifierCode}) — {cityName}</option>
                  );
                })}
              </select>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-[#F7F3EB] text-[#B69A68] shrink-0 select-none">
                {currentProperty?.status === 'published' ? 'نشط معروض' : currentProperty?.status === 'draft' ? 'مسودة تجهيز' : 'غير مدرج للبيع'}
              </span>
            </div>
          </div>
        </div>
        
        {/* Global Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('cities')}
            className="px-3.5 py-2.5 bg-[#F7F3EB] hover:bg-[#EFE9DF] text-[#282824] border border-[#E3DCCD] text-xs sm:text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <MapPin className="w-4 h-4 text-[#B69A68] shrink-0" />
            <span>سجل المدن ({state.cities?.length || 0})</span>
          </button>
          <button
            onClick={() => setIsCreatingBuilding(true)}
            className="px-4 py-2.5 bg-[#282824] hover:bg-[#1a1a18] text-white text-xs sm:text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#B69A68] shrink-0" />
            <span>إضافة مشروع ومجمع جديد</span>
          </button>
        </div>
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
            onClick={() => setActiveTab('cities')}
            className={`px-5 py-3.5 border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'cities' ? 'border-[#B69A68] text-[#282824] bg-white shadow-xs' : 'border-transparent text-[#68675F] hover:text-[#282824]'
            }`}
          >
            <MapPin className="w-4 h-4 text-[#B69A68]" />
            <span>إدارة المدن والمناطق ({state.cities?.length || 0})</span>
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
                    <button type="button" disabled={isSubmittingBatch} onClick={() => setIsBatchAdding(false)} className="px-3 py-1.5 border border-[#E3DCCD] rounded-xl cursor-pointer disabled:opacity-50">إلغاء التوليد</button>
                    <button
                      type="submit"
                      disabled={isSubmittingBatch}
                      className="px-5 py-2 bg-[#282824] text-white rounded-xl font-bold shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isSubmittingBatch ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>جاري التوليد بالمعاملة الموحدة...</span>
                        </>
                      ) : (
                        <span>تأكيد توليد عدد {Number(batchForm.endNumber) - Number(batchForm.startNumber) + 1} شقة</span>
                      )}
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
                            onClick={async () => {
                              setErrorMsg(null);
                              try {
                                const nextNum = `${floor.floorNumber > 0 ? floor.floorNumber : 'B'}${Math.floor(10 + Math.random() * 89)}`;
                                await createUnit({
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
                                setSuccessMsg('تم تأسيس الشقة بنجاح على الخادم.');
                                setTimeout(() => setSuccessMsg(null), 3000);
                              } catch (err: any) {
                                setErrorMsg(err.message || 'فشل تأسيس الشقة.');
                              }
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
                    <button type="submit" disabled={isSubmittingParking} className="px-4 py-1.5 bg-[#282824] text-white rounded-xl font-bold cursor-pointer disabled:opacity-50">
                      {isSubmittingParking ? 'جاري الحفظ...' : 'حفظ الموقف'}
                    </button>
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
                                  onClick={() => handleUnassignParking(ps.id)}
                                  className="text-xs text-amber-700 hover:underline font-bold cursor-pointer"
                                >
                                  فك الارتباط
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteParking(ps)}
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

              {/* City Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-[#68675F] block mb-1">المدينة المعتمدة التابع لها المبنى *</label>
                  <select
                    value={currentProperty.cityId || state.cities.find(c => c.name === currentProperty.city)?.id || ''}
                    onChange={(e) => {
                      const selectedCity = state.cities.find(c => c.id === e.target.value);
                      if (selectedCity) {
                        updateProperty(currentProperty.id, {
                          cityId: selectedCity.id,
                          city: selectedCity.name
                        });
                      }
                    }}
                    className="w-full p-2.5 bg-[#F7F3EB]/40 border border-[#E3DCCD] rounded-xl font-bold cursor-pointer"
                  >
                    {state.cities.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.region || 'المنطقة الإدارية'}) — {c.country}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-[#68675F] block mb-1">الحي السكني *</label>
                  <input
                    type="text"
                    value={currentProperty.district}
                    onChange={(e) => updateProperty(currentProperty.id, { district: e.target.value })}
                    className="w-full p-2.5 bg-[#F7F3EB]/40 border border-[#E3DCCD] rounded-xl text-right focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-[#68675F] block mb-1">العنوان الميداني ووصف الوصول</label>
                <input
                  type="text"
                  value={currentProperty.address}
                  onChange={(e) => updateProperty(currentProperty.id, { address: e.target.value })}
                  className="w-full p-2.5 bg-[#F7F3EB]/40 border border-[#E3DCCD] rounded-xl text-right focus:outline-none"
                />
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

          {/* TAB: CITIES MANAGEMENT */}
          {activeTab === 'cities' && (
            <div className="space-y-6 text-xs text-right">
              {/* Hierarchy Info Box */}
              <div className="p-4 bg-[#FFFCF6] rounded-2xl border border-[#E3DCCD] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="w-5 h-5 text-[#B69A68]" />
                    <h4 className="font-bold text-sm text-[#282824]">الهيكل التنظيمي للمواقع (منزل الفخامة)</h4>
                  </div>
                  <button
                    onClick={() => setIsAddingCity(true)}
                    className="px-3.5 py-1.5 bg-[#282824] hover:bg-[#1a1a18] text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#B69A68]" />
                    <span>إضافة مدينة جديدة</span>
                  </button>
                </div>
                <p className="text-[#68675F] leading-relaxed">
                  نموذج المواقع الموحد للمنصة:
                  <strong className="text-[#282824] font-semibold mr-1">
                    شركة منزل الفخامة ← الدولة ← المنطقة الإدارية (اختيارية) ← المدينة ← المبنى ← الطابق ← الوحدة السكنية
                  </strong>
                </p>
                <div className="flex flex-wrap gap-2 pt-1 text-[11px]">
                  <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200">
                    المدن النشطة: {state.cities.filter(c => c.status === 'active').length}
                  </span>
                  <span className="px-2.5 py-1 bg-[#F7F3EB] text-[#68675F] rounded-lg border border-[#E3DCCD]">
                    إجمالي المدن: {state.cities.length}
                  </span>
                  <span className="px-2.5 py-1 bg-blue-50 text-blue-800 rounded-lg border border-blue-200">
                    إجمالي المباني الموزعة: {state.properties.length}
                  </span>
                </div>
              </div>

              {/* Cities Table */}
              <div className="bg-white rounded-2xl border border-[#E3DCCD] overflow-hidden">
                <table className="w-full text-right border-collapse">
                  <thead className="bg-[#F7F3EB]">
                    <tr>
                      <th className="p-3 font-bold text-[#282824]">الترتيب</th>
                      <th className="p-3 font-bold text-[#282824]">اسم المدينة (عربي)</th>
                      <th className="p-3 font-bold text-[#282824]">الاسم بالإنجليزية</th>
                      <th className="p-3 font-bold text-[#282824]">المنطقة الإدارية</th>
                      <th className="p-3 font-bold text-[#282824]">الدولة</th>
                      <th className="p-3 font-bold text-[#282824]">المباني المرتبطة</th>
                      <th className="p-3 font-bold text-[#282824]">الحالة</th>
                      <th className="p-3 font-bold text-[#282824] text-left">التحكم</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E3DCCD]">
                    {state.cities
                      .slice()
                      .sort((a, b) => a.displayOrder - b.displayOrder)
                      .map(city => {
                        const linkedBuildings = state.properties.filter(
                          p => p.cityId === city.id || p.city === city.name
                        );
                        return (
                          <tr key={city.id} className="hover:bg-[#FFFCF6] transition-colors">
                            <td className="p-3 font-mono font-bold text-[#68675F]">{city.displayOrder}</td>
                            <td className="p-3 font-bold text-[#282824] flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-[#B69A68] shrink-0" />
                              <span>{city.name}</span>
                            </td>
                            <td className="p-3 text-[#68675F] font-mono dir-ltr text-right">{city.nameEn || '—'}</td>
                            <td className="p-3 text-[#68675F]">{city.region || '—'}</td>
                            <td className="p-3 text-[#68675F]">{city.country}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                linkedBuildings.length > 0 ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {linkedBuildings.length} مبنى
                              </span>
                            </td>
                            <td className="p-3">
                              <button
                                onClick={() => handleToggleCityStatus(city)}
                                className={`px-2.5 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-colors ${
                                  city.status === 'active'
                                    ? 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200'
                                    : 'bg-rose-100 text-rose-900 hover:bg-rose-200'
                                }`}
                              >
                                {city.status === 'active' ? 'نشطة معتمدة' : 'معطلة مؤقتاً'}
                              </button>
                            </td>
                            <td className="p-3 text-left">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => setEditingCity(city)}
                                  className="p-1.5 text-[#282824] hover:bg-[#F7F3EB] rounded transition-colors cursor-pointer"
                                  title="تعديل بيانات المدينة"
                                >
                                  <Edit3 className="w-4 h-4 text-[#B69A68]" />
                                </button>
                                <button
                                  onClick={() => handleDeleteCity(city)}
                                  className={`p-1.5 rounded transition-colors cursor-pointer ${
                                    linkedBuildings.length > 0
                                      ? 'text-slate-300 hover:text-slate-400 cursor-not-allowed'
                                      : 'text-rose-600 hover:bg-rose-50'
                                  }`}
                                  title={linkedBuildings.length > 0 ? 'لا يمكن حذف مدينة مرتبطة بمبانٍ (قم بتعطيلها أو نقل المباني أولاً)' : 'حذف المدينة'}
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

              {/* City & District Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-[#68675F] block mb-1">المدينة المعتمدة *</label>
                  <select
                    required
                    value={newBuildingForm.cityId || state.cities[0]?.id || ''}
                    onChange={(e) => {
                      const selectedCity = state.cities.find(c => c.id === e.target.value);
                      if (selectedCity) {
                        setNewBuildingForm(prev => ({
                          ...prev,
                          cityId: selectedCity.id,
                          city: selectedCity.name,
                        }));
                      }
                    }}
                    className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl font-bold cursor-pointer"
                  >
                    {state.cities.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.region || 'المنطقة الإدارية'}) {c.status === 'inactive' ? '(معطلة)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
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

      {/* ADD CITY MODAL */}
      {isAddingCity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#FFFCF6] w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border border-[#E3DCCD] text-right">
            <div className="p-4 border-b border-[#E3DCCD] flex items-center justify-between bg-[#F7F3EB]">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#B69A68]" />
                <h4 className="font-bold text-sm text-[#282824]">إضافة واعتماد مدينة جديدة للمنصة</h4>
              </div>
              <button onClick={() => setIsAddingCity(false)} className="cursor-pointer text-[#68675F]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateCitySubmit} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#68675F] block mb-1">اسم المدينة (عربي) *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: الخبر، مكة، أبها"
                    value={newCityForm.name}
                    onChange={(e) => setNewCityForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl font-bold text-right focus:outline-none focus:border-[#B69A68]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#68675F] block mb-1">الاسم بالإنجليزية</label>
                  <input
                    type="text"
                    placeholder="مثال: Khobar, Mecca, Abha"
                    value={newCityForm.nameEn}
                    onChange={(e) => setNewCityForm(prev => ({ ...prev, nameEn: e.target.value }))}
                    className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl text-left font-mono focus:outline-none focus:border-[#B69A68]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#68675F] block mb-1">المنطقة الإدارية (اختيارية)</label>
                  <input
                    type="text"
                    placeholder="مثال: المنطقة الشرقية، منطقة مكة المكرمة"
                    value={newCityForm.region}
                    onChange={(e) => setNewCityForm(prev => ({ ...prev, region: e.target.value }))}
                    className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl text-right focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#68675F] block mb-1">الدولة *</label>
                  <input
                    type="text"
                    required
                    value={newCityForm.country}
                    onChange={(e) => setNewCityForm(prev => ({ ...prev, country: e.target.value }))}
                    className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl text-right focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#68675F] block mb-1">ترتيب العرض الرقمي</label>
                  <input
                    type="number"
                    min="0"
                    value={newCityForm.displayOrder}
                    onChange={(e) => setNewCityForm(prev => ({ ...prev, displayOrder: Number(e.target.value) }))}
                    className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl text-right font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#68675F] block mb-1">الحالة التشغيلية</label>
                  <select
                    value={newCityForm.status}
                    onChange={(e) => setNewCityForm(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl font-bold cursor-pointer"
                  >
                    <option value="active">نشطة ومعتمدة للإدراج</option>
                    <option value="inactive">معطلة مؤقتاً</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px] leading-relaxed select-none">
                المدن المعتمدة ستظهر تلقائياً في قوائم إنشاء المباني، وفلاتر لوحة التحكم، ومحرك بحث النزلاء العام.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E3DCCD]/60">
                <button type="button" onClick={() => setIsAddingCity(false)} className="px-3 py-1.5 border border-[#E3DCCD] rounded-xl cursor-pointer">إلغاء</button>
                <button type="submit" className="px-4 py-2 bg-[#282824] text-white font-bold rounded-xl shadow-xs cursor-pointer">حفظ واعتماد المدينة</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT CITY MODAL */}
      {editingCity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#FFFCF6] w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border border-[#E3DCCD] text-right">
            <div className="p-4 border-b border-[#E3DCCD] flex items-center justify-between bg-[#F7F3EB]">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-[#B69A68]" />
                <h4 className="font-bold text-sm text-[#282824]">تعديل بيانات مدينة: {editingCity.name}</h4>
              </div>
              <button onClick={() => setEditingCity(null)} className="cursor-pointer text-[#68675F]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleUpdateCitySubmit} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#68675F] block mb-1">اسم المدينة (عربي) *</label>
                  <input
                    type="text"
                    required
                    value={editingCity.name}
                    onChange={(e) => setEditingCity(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
                    className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl font-bold text-right focus:outline-none focus:border-[#B69A68]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#68675F] block mb-1">الاسم بالإنجليزية</label>
                  <input
                    type="text"
                    value={editingCity.nameEn || ''}
                    onChange={(e) => setEditingCity(prev => prev ? ({ ...prev, nameEn: e.target.value }) : null)}
                    className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl text-left font-mono focus:outline-none focus:border-[#B69A68]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#68675F] block mb-1">المنطقة الإدارية</label>
                  <input
                    type="text"
                    value={editingCity.region || ''}
                    onChange={(e) => setEditingCity(prev => prev ? ({ ...prev, region: e.target.value }) : null)}
                    className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl text-right focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#68675F] block mb-1">الدولة *</label>
                  <input
                    type="text"
                    required
                    value={editingCity.country}
                    onChange={(e) => setEditingCity(prev => prev ? ({ ...prev, country: e.target.value }) : null)}
                    className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl text-right focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#68675F] block mb-1">ترتيب العرض</label>
                  <input
                    type="number"
                    min="0"
                    value={editingCity.displayOrder}
                    onChange={(e) => setEditingCity(prev => prev ? ({ ...prev, displayOrder: Number(e.target.value) }) : null)}
                    className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl text-right font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#68675F] block mb-1">الحالة</label>
                  <select
                    value={editingCity.status}
                    onChange={(e) => setEditingCity(prev => prev ? ({ ...prev, status: e.target.value as any }) : null)}
                    className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl font-bold cursor-pointer"
                  >
                    <option value="active">نشطة ومعتمدة</option>
                    <option value="inactive">معطلة مؤقتاً</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E3DCCD]/60">
                <button type="button" onClick={() => setEditingCity(null)} className="px-3 py-1.5 border border-[#E3DCCD] rounded-xl cursor-pointer">إلغاء</button>
                <button type="submit" className="px-4 py-2 bg-[#282824] text-white font-bold rounded-xl shadow-xs cursor-pointer">حفظ التعديلات</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
