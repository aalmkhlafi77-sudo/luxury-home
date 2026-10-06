import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Unit } from '../../types';
import {
  Building2,
  Sparkles,
  Wrench,
  Slash,
  CheckCircle2,
  BellRing,
  Layers,
  Search,
  Filter,
  MapPin
} from 'lucide-react';

interface OperationsGridProps {
  onSelectUnit: (unit: Unit) => void;
}

export const OperationsGrid: React.FC<OperationsGridProps> = ({ onSelectUnit }) => {
  const { state } = useAppStore();
  const [selectedCityId, setSelectedCityId] = useState<string>('all');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredProperties = state.properties.filter(p => {
    if (selectedCityId !== 'all' && p.cityId !== selectedCityId && p.city !== selectedCityId) {
      return false;
    }
    if (selectedPropertyId === 'all') return true;
    return p.id === selectedPropertyId;
  });

  const propertyIds = new Set(filteredProperties.map(p => p.id));
  const relevantUnits = state.units.filter(u => propertyIds.has(u.propertyId));

  // Calculate Operational Metrics dynamically (not hardcoded)
  const totalUnits = relevantUnits.filter(u => u.publicationStatus !== 'archived').length;
  const readyVacant = relevantUnits.filter(u => u.occupancyStatus === 'vacant' && u.operationalStatus === 'ready' && u.publicationStatus !== 'archived').length;
  const dailyOccupied = relevantUnits.filter(u => u.occupancyStatus === 'daily_occupied' && u.publicationStatus !== 'archived').length;
  const monthlyOccupied = relevantUnits.filter(u => u.occupancyStatus === 'monthly_occupied' && u.publicationStatus !== 'archived').length;
  const yearlyOccupied = relevantUnits.filter(u => u.occupancyStatus === 'occupied_yearly' && u.publicationStatus !== 'archived').length;
  
  const cleaningOrMaint = relevantUnits.filter(u =>
    u.publicationStatus !== 'archived' && (
      u.operationalStatus === 'needs_cleaning' ||
      u.operationalStatus === 'in_cleaning' ||
      u.operationalStatus === 'in_maintenance'
    )
  ).length;

  const todayArrivals = relevantUnits.filter(u => u.todayArrival && u.publicationStatus !== 'archived').length;

  return (
    <div className="space-y-6 text-right select-none">
      
      {/* 1. Executive Metric Scoreboard */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="p-4 bg-white rounded-2xl border border-[#E3DCCD] shadow-xs">
          <span className="text-[11px] font-semibold text-[#68675F] block mb-1">إجمالي الوحدات</span>
          <span className="text-2xl font-bold text-[#282824] tabular-nums">{totalUnits}</span>
          <span className="text-[10px] text-[#68675F] block mt-0.5">شقق نشطة ومدرجة</span>
        </div>
        <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200 shadow-xs">
          <span className="text-[11px] font-semibold text-emerald-800 block mb-1">شاغرة وجاهزة</span>
          <span className="text-2xl font-bold text-emerald-700 tabular-nums">{readyVacant}</span>
          <span className="text-[10px] text-emerald-600 block mt-0.5">جاهزة للاستلام</span>
        </div>
        <div className="p-4 bg-rose-50/60 rounded-2xl border border-rose-200 shadow-xs">
          <span className="text-[11px] font-semibold text-rose-800 block mb-1">مسكونة (يومي)</span>
          <span className="text-2xl font-bold text-rose-700 tabular-nums">{dailyOccupied}</span>
          <span className="text-[10px] text-rose-600 block mt-0.5">حجوزات جارية</span>
        </div>
        <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-200 shadow-xs">
          <span className="text-[11px] font-semibold text-blue-800 block mb-1">مسكونة (شهري)</span>
          <span className="text-2xl font-bold text-blue-700 tabular-nums">{monthlyOccupied}</span>
          <span className="text-[10px] text-blue-600 block mt-0.5">عقود أعمال ممتدة</span>
        </div>
        <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-200 shadow-xs">
          <span className="text-[11px] font-semibold text-indigo-900 block mb-1">مسكونة (سنوي)</span>
          <span className="text-2xl font-bold text-indigo-800 tabular-nums">{yearlyOccupied}</span>
          <span className="text-[10px] text-indigo-600 block mt-0.5">عقود سنوية مستمرة</span>
        </div>
        <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200 shadow-xs">
          <span className="text-[11px] font-semibold text-amber-800 block mb-1">بحاجة لنظافة/صيانة</span>
          <span className="text-2xl font-bold text-amber-700 tabular-nums">{cleaningOrMaint}</span>
          <span className="text-[10px] text-amber-600 block mt-0.5">تحت التشغيل حالياً</span>
        </div>
        <div className="p-4 bg-orange-50/60 rounded-2xl border border-orange-200 shadow-xs col-span-2 sm:col-span-1">
          <span className="text-[11px] font-semibold text-orange-800 block mb-1">وصول متوقع اليوم</span>
          <span className="text-2xl font-bold text-orange-700 tabular-nums">{todayArrivals}</span>
          <span className="text-[10px] text-orange-600 block mt-0.5">قادمون اليوم</span>
        </div>
      </div>

      {/* 2. Filter & Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 bg-white rounded-2xl border border-[#E3DCCD]">
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* City Filter */}
          <div className="flex items-center gap-2 bg-[#F7F3EB] px-3 py-1.5 rounded-xl border border-[#E3DCCD]">
            <MapPin className="w-3.5 h-3.5 text-[#B69A68] shrink-0" />
            <select
              value={selectedCityId}
              onChange={(e) => {
                setSelectedCityId(e.target.value);
                setSelectedPropertyId('all');
              }}
              className="text-xs font-bold text-[#282824] bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="all">كل المدن ({state.cities.length})</option>
              {state.cities.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1 bg-[#F7F3EB] p-1 rounded-xl overflow-x-auto max-w-full">
            <button
              onClick={() => setSelectedPropertyId('all')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                selectedPropertyId === 'all' ? 'bg-[#282824] text-white shadow-xs' : 'text-[#68675F] hover:text-[#282824]'
              }`}
            >
              جميع المشاريع ({filteredProperties.length})
            </button>
            {filteredProperties.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedPropertyId(p.id)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  selectedPropertyId === p.id ? 'bg-[#282824] text-white shadow-xs' : 'text-[#68675F] hover:text-[#282824]'
                }`}
              >
                {p.name.split(' - ')[1] || p.name}
              </button>
            ))}
          </div>
        </div>
        
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-[#68675F] absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="ابحث برقم الشقة أو مسمى الجناح..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-3 pr-9 py-1.5 text-xs bg-[#F7F3EB]/60 border border-[#E3DCCD] rounded-xl focus:outline-none focus:border-[#B69A68] text-right"
          />
        </div>
      </div>

      {/* 3. Color Legend (Interactive / static clean typography) */}
      <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-[#68675F] px-2 select-none justify-start">
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-md bg-emerald-500 shadow-xs" />
          <span>شاغرة وجاهزة للاستلام الفوري</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-md bg-rose-500 shadow-xs" />
          <span>مسكونة إيجار يومي فعال</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-md bg-blue-500 shadow-xs" />
          <span>مسكونة إقامة أعمال (عقود شهرية)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-md bg-indigo-500 shadow-xs" />
          <span>مسكونة إيجار سنوي مستمر</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-md bg-amber-400 shadow-xs" />
          <span>تحت التشغيل (نظافة / صيانة وقائية)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-md bg-slate-400 shadow-xs" />
          <span>وحدة معطلة ومحجوبة إدارياً</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-md border-2 border-orange-500 bg-orange-100 shadow-xs" />
          <span className="font-bold text-orange-950">نزيل متوقع وصوله اليوم</span>
        </div>
      </div>

      {/* 4. Buildings & Floors Matrix */}
      <div className="space-y-8 text-right">
        {filteredProperties.map(property => {
          const propertyFloors = state.floors.filter(f => f.propertyId === property.id);
          const propertyUnits = state.units.filter(u => u.propertyId === property.id && u.publicationStatus !== 'archived');

          return (
            <div key={property.id} className="bg-white rounded-3xl p-6 border border-[#E3DCCD] shadow-xs space-y-6">
              
              {/* Property Header */}
              <div className="flex items-center justify-between pb-4 border-b border-[#E3DCCD]">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#282824] text-white rounded-xl">
                    <Building2 className="w-5 h-5 text-[#B69A68]" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-[#282824]">
                      {property.name}
                    </h3>
                    <span className="text-xs text-[#68675F] block">
                      {property.district} · {propertyUnits.length} شقق سكنية نشطة حالياً
                    </span>
                  </div>
                </div>
                <div className="text-xs text-[#68675F]">
                  تسجيل الدخول: <strong className="text-[#282824]">{property.checkInTime}</strong> · الخروج: <strong className="text-[#282824]">{property.checkOutTime}</strong>
                </div>
              </div>

              {/* Floors Stack */}
              <div className="space-y-4">
                {propertyFloors.map(floor => {
                  const floorUnits = propertyUnits.filter(u => {
                    if (u.floorNumber !== floor.floorNumber) return false;
                    if (searchQuery && !u.unitNumber.includes(searchQuery) && !u.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
                    return true;
                  });

                  if (floorUnits.length === 0 && searchQuery) return null;

                  return (
                    <div key={floor.id} className="p-4 bg-[#F7F3EB]/40 rounded-2xl border border-[#E3DCCD]/60 flex flex-col md:flex-row md:items-center gap-4 text-right">
                      
                      {/* Floor Title Tag */}
                      <div className="md:w-48 shrink-0 text-right">
                        <div className="flex items-center gap-2 justify-start">
                          <Layers className="w-4 h-4 text-[#B69A68]" />
                          <h4 className="text-xs font-bold text-[#282824]">
                            {floor.name}
                          </h4>
                        </div>
                        <span className="text-[11px] text-[#68675F] block mt-0.5">
                          تضم {floorUnits.length} شقق تشغيلية
                        </span>
                      </div>

                      {/* Floor Units Interactive Grid */}
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {floorUnits.map(unit => {
                          // Determine style mapping
                          let bgClass = '';
                          let borderClass = '';
                          let textClass = '';
                          let statusLabel = '';
                          let statusIcon = null;

                          if (unit.operationalStatus === 'blocked') {
                            bgClass = 'bg-slate-100 hover:bg-slate-200';
                            borderClass = 'border-slate-300';
                            textClass = 'text-slate-800';
                            statusLabel = 'محجوبة إدارياً';
                            statusIcon = <Slash className="w-3.5 h-3.5 text-slate-500" />;
                          } else if (unit.operationalStatus === 'in_maintenance') {
                            bgClass = 'bg-purple-50 hover:bg-purple-100';
                            borderClass = 'border-purple-300';
                            textClass = 'text-purple-900';
                            statusLabel = 'تحت الصيانة الفنية';
                            statusIcon = <Wrench className="w-3.5 h-3.5 text-purple-600" />;
                          } else if (unit.operationalStatus === 'needs_cleaning' || unit.operationalStatus === 'in_cleaning') {
                            bgClass = 'bg-amber-50 hover:bg-amber-100';
                            borderClass = 'border-amber-300';
                            textClass = 'text-amber-900';
                            statusLabel = unit.operationalStatus === 'in_cleaning' ? 'جاري التنظيف الآن' : 'بحاجة لنظافة فندقية';
                            statusIcon = <Sparkles className="w-3.5 h-3.5 text-amber-600" />;
                          } else if (unit.occupancyStatus === 'daily_occupied') {
                            bgClass = 'bg-rose-50 hover:bg-rose-100';
                            borderClass = 'border-rose-300';
                            textClass = 'text-rose-900';
                            statusLabel = 'إشغال حجز يومي';
                            statusIcon = <span className="w-2 h-2 rounded-full bg-rose-600" />;
                          } else if (unit.occupancyStatus === 'monthly_occupied') {
                            bgClass = 'bg-blue-50 hover:bg-blue-100';
                            borderClass = 'border-blue-300';
                            textClass = 'text-blue-900';
                            statusLabel = 'إشغال عقد شهري';
                            statusIcon = <span className="w-2 h-2 rounded-full bg-blue-600" />;
                          } else if (unit.occupancyStatus === 'occupied_yearly') {
                            bgClass = 'bg-indigo-50 hover:bg-indigo-100';
                            borderClass = 'border-indigo-300';
                            textClass = 'text-indigo-900';
                            statusLabel = 'إشغال عقد سنوي';
                            statusIcon = <span className="w-2 h-2 rounded-full bg-indigo-600" />;
                          } else {
                            // Vacant and Ready (Green)
                            bgClass = 'bg-emerald-50 hover:bg-emerald-100';
                            borderClass = 'border-emerald-300';
                            textClass = 'text-emerald-900';
                            statusLabel = 'شاغرة وجاهزة';
                            statusIcon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
                          }

                          return (
                            <button
                              key={unit.id}
                              onClick={() => onSelectUnit(unit)}
                              className={`p-3 rounded-2xl border text-right transition-all duration-200 relative group cursor-pointer shadow-xs hover:shadow-md ${bgClass} ${borderClass} ${textClass}`}
                            >
                              {/* Orange badge for Today Arrival */}
                              {unit.todayArrival && (
                                <span className="absolute -top-2 left-2 px-2 py-0.5 rounded-full bg-orange-500 text-white font-bold text-[10px] shadow-sm flex items-center gap-1 animate-pulse z-10">
                                  <BellRing className="w-3 h-3 text-white" />
                                  <span>وصول اليوم</span>
                                </span>
                              )}

                              <div className="flex items-center justify-between mb-1.5">
                                <span className="font-bold text-sm">
                                  شقة #{unit.unitNumber}
                                </span>
                                <span className="text-[11px] font-semibold tabular-nums opacity-85">
                                  {unit.dailyRate} ر.س / الليلة
                                </span>
                              </div>

                              <div className="text-[11px] opacity-80 line-clamp-1 mb-2 font-medium">
                                {unit.title}
                              </div>

                              <div className="flex items-center justify-between pt-1.5 border-t border-black/5 text-[11px] font-semibold">
                                <div className="flex items-center gap-1">
                                  {statusIcon}
                                  <span>{statusLabel}</span>
                                </div>
                                <span className="text-[10px] opacity-70 group-hover:underline">
                                  إجراء عمليات
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
};
