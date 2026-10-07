import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Property, Unit } from '../../types';
import { ImageWithFallback } from '../common/ImageWithFallback';
import { CurrencyAmount } from '../../utils/formatters';
import {
  X,
  MapPin,
  Layers,
  Building2,
  Maximize2,
  Users,
  Bed,
  Bath,
  ArrowLeft
} from 'lucide-react';

interface BuildingDetailModalProps {
  property: Property | null;
  onClose: () => void;
  onSelectUnit: (unit: Unit) => void;
  onBookUnit: (unit: Unit) => void;
}

export const BuildingDetailModal: React.FC<BuildingDetailModalProps> = ({
  property,
  onClose,
  onSelectUnit,
  onBookUnit,
}) => {
  const { state } = useAppStore();
  const [selectedFloor, setSelectedFloor] = useState<number | 'all'>('all');

  if (!property) return null;

  const propertyFloors = state.floors.filter(f => f.propertyId === property.id);
  const propertyUnits = state.units.filter(u => {
    if (u.publicationStatus === 'archived') return false;
    if (u.propertyId !== property.id) return false;
    if (selectedFloor !== 'all' && u.floorNumber !== selectedFloor) return false;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[#FFFCF6] w-full max-w-5xl rounded-3xl overflow-hidden shadow-2xl border border-[#E3DCCD] my-auto max-h-[90vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-6 border-b border-[#E3DCCD] flex items-center justify-between bg-[#F7F3EB]/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#282824] text-[#FFFCF6] flex items-center justify-center font-bold">
              <Building2 className="w-5 h-5 text-[#B69A68]" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-[#282824]">
                {property.name}
              </h2>
              <span className="text-xs text-[#68675F] flex items-center gap-1.5 mt-0.5 flex-wrap">
                <MapPin className="w-3.5 h-3.5 text-[#B69A68] shrink-0" />
                <span className="font-semibold text-[#282824]">{state.cities.find(c => c.id === property.cityId)?.name || property.city}</span>
                <span>·</span>
                <span>{property.district}</span>
                {property.address && (
                  <>
                    <span>·</span>
                    <span>{property.address}</span>
                  </>
                )}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#68675F] hover:text-[#282824] hover:bg-[#EFE9DF] rounded-full transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-8 flex-1">
          
          {/* Gallery Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {property.media.map((media, idx) => (
              <div key={idx} className={`relative rounded-2xl overflow-hidden h-52 bg-[#282824] ${idx === 0 ? 'md:col-span-2' : ''}`}>
                <ImageWithFallback
                  src={media.url}
                  alt={media.title}
                  fallbackText={media.title}
                  fit="fill"
                  className="w-full h-full"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <span className="absolute bottom-3 right-3 text-xs font-semibold text-white">
                  {media.title}
                </span>
              </div>
            ))}
          </div>

          {/* Description & Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-5 bg-[#F7F3EB]/50 rounded-2xl border border-[#E3DCCD]">
            <div className="md:col-span-2 space-y-2 text-right">
              <h4 className="text-sm font-bold text-[#282824]">عن المشروع والخدمات المشتركة</h4>
              <p className="text-xs sm:text-sm text-[#68675F] leading-relaxed">
                {property.description}
              </p>
            </div>
            <div className="space-y-3 border-r md:pr-6 border-[#E3DCCD]/80 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#68675F]">الارتفاع البريدي:</span>
                <span className="font-bold text-[#282824]">{property.totalFloors} طوابق سكنية</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#68675F]">توقيت الدخول:</span>
                <span className="font-bold text-[#282824]">{property.checkInTime}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#68675F]">توقيت المغادرة:</span>
                <span className="font-bold text-[#282824]">{property.checkOutTime}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#68675F]">خدمات مدمجة:</span>
                <span className="font-bold text-[#B69A68]">مغطاة بالكامل ١٠٠٪</span>
              </div>
            </div>
          </div>

          {/* Units in Building */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-[#282824]">
                  الوحدات السكنية في هذا المبنى ({propertyUnits.length} شقة متاحة)
                </h3>
                <p className="text-xs text-[#68675F]">
                  تصفح الوحدات الفندقية والفرش الفاخر وصمم حجزك مباشرة.
                </p>
              </div>

              {/* Floor Filter (Interactive) */}
              <div className="flex items-center gap-1.5 overflow-x-auto p-1 bg-[#EFE9DF]/80 rounded-xl">
                <button
                  onClick={() => setSelectedFloor('all')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    selectedFloor === 'all'
                      ? 'bg-[#282824] text-white shadow-xs'
                      : 'text-[#68675F] hover:text-[#282824]'
                  }`}
                >
                  جميع الطوابق
                </button>
                {propertyFloors.map(f => (
                  <button
                    key={f.id}
                    onClick={() => setSelectedFloor(f.floorNumber)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                      selectedFloor === f.floorNumber
                        ? 'bg-[#282824] text-white shadow-xs'
                        : 'text-[#68675F] hover:text-[#282824]'
                    }`}
                  >
                    الدور {f.floorNumber}
                  </button>
                ))}
              </div>
            </div>

            {/* Units Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {propertyUnits.map(unit => {
                const cover = unit.media.find(m => m.isCover)?.url || unit.media[0]?.url;
                return (
                  <div
                    key={unit.id}
                    className="p-4 bg-white rounded-2xl border border-[#E3DCCD] hover:border-[#B69A68] transition-all flex gap-4 group"
                  >
                    <div className="w-28 sm:w-36 h-28 rounded-xl overflow-hidden shrink-0 bg-[#282824]">
                      <ImageWithFallback
                         src={cover}
                         alt={unit.title}
                         fallbackText={unit.title}
                         fit="fill"
                         className="w-full h-full"
                      />
                    </div>
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-bold text-[#B69A68]">
                            الدور {unit.floorNumber} · شقة #{unit.unitNumber}
                          </span>
                          <span className="text-[11px] text-[#68675F] tabular-nums font-semibold">
                            {unit.areaSqm} م² المساحة
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-[#282824] line-clamp-1">
                          {unit.title}
                        </h4>
                        <div className="flex items-center gap-3 text-xs text-[#68675F] mt-1.5">
                          <span>{unit.bedroomsCount} غرف نوم</span>
                          <span>·</span>
                          <span>{unit.bathroomsCount} حمام</span>
                          <span>·</span>
                          <span>سعة {unit.maxGuests} ضيوف</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-[#E3DCCD]/60 mt-2">
                        <div>
                          <CurrencyAmount amount={unit.dailyRate} className="text-sm font-bold text-[#282824]" />
                          <span className="text-[10px] text-[#68675F] mr-1">/ الليلة</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              onClose();
                              onSelectUnit(unit);
                            }}
                            className="px-2.5 py-1 text-xs font-medium text-[#282824] bg-[#F7F3EB] hover:bg-[#EFE9DF] rounded-lg transition-colors cursor-pointer"
                          >
                            تفاصيل
                          </button>
                          <button
                            onClick={() => {
                              onClose();
                              onBookUnit(unit);
                            }}
                            className="px-3 py-1 text-xs font-semibold text-white bg-[#282824] hover:bg-[#1a1a18] rounded-lg transition-colors cursor-pointer"
                          >
                            احجز الآن
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
