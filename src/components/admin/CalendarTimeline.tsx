import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Unit } from '../../types';
import {
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface CalendarTimelineProps {
  onSelectUnit: (unit: Unit) => void;
}

export const CalendarTimeline: React.FC<CalendarTimelineProps> = ({ onSelectUnit }) => {
  const { state } = useAppStore();

  // Timeline dates: 14 days starting from today or offset
  const [dayOffset, setDayOffset] = useState<number>(0);
  const totalDays = 14;
  const dates: { dateStr: string; dayName: string; dayNum: number; isToday: boolean }[] = [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < totalDays; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + dayOffset + i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayName = d.toLocaleDateString('ar-SA', { weekday: 'short' });
    const dayNum = d.getDate();
    const isToday = d.getTime() === today.getTime();
    dates.push({ dateStr, dayName, dayNum, isToday });
  }

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl p-2.5 sm:p-6 border border-[#E3DCCD] shadow-xs space-y-3.5 sm:space-y-6 text-right">
      
      {/* Header and Date Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-3 sm:pb-4 border-b border-[#E3DCCD]">
        <div>
          <h3 className="text-sm sm:text-lg font-bold text-[#282824]">
            <span className="sm:hidden">جدول الإشغال</span>
            <span className="hidden sm:inline">مخطط الجدولة والخط الزمني للإشغال (Timeline)</span>
          </h3>
          <p className="text-[11px] sm:text-xs text-[#68675F] mt-0.5">
            <span className="sm:hidden">الحجوزات والعقود خلال 14 يوماً</span>
            <span className="hidden sm:inline">
              عرض حي للحجوزات الحالية والمستقبلية وعقود الإيجار السنوية والشهرية على مدار ١٤ يوماً مجدولة
            </span>
          </p>
        </div>

        {/* Date Navigation */}
        <div className="flex items-center gap-1.5 sm:gap-2 select-none justify-between sm:justify-end">
          <button
            type="button"
            onClick={() => setDayOffset(prev => prev - 7)}
            className="px-2.5 py-1.5 sm:p-2 border border-[#E3DCCD] hover:bg-[#F7F3EB] rounded-xl text-xs font-semibold text-[#282824] flex items-center gap-1 transition-colors cursor-pointer shrink-0"
          >
            <ChevronRight className="w-3.5 h-3.5 text-[#B69A68]" />
            <span className="sm:hidden">السابق</span>
            <span className="hidden sm:inline">الأسبوع السابق</span>
          </button>
          <button
            type="button"
            onClick={() => setDayOffset(0)}
            className="px-3 py-1.5 sm:py-2 bg-[#F7F3EB] border border-[#E3DCCD] hover:bg-[#EFE9DF] rounded-xl text-xs font-bold text-[#282824] transition-colors cursor-pointer shrink-0"
          >
            <span className="sm:hidden">اليوم</span>
            <span className="hidden sm:inline">اليوم الحالي</span>
          </button>
          <button
            type="button"
            onClick={() => setDayOffset(prev => prev + 7)}
            className="px-2.5 py-1.5 sm:p-2 border border-[#E3DCCD] hover:bg-[#F7F3EB] rounded-xl text-xs font-semibold text-[#282824] flex items-center gap-1 transition-colors cursor-pointer shrink-0"
          >
            <span className="sm:hidden">التالي</span>
            <span className="hidden sm:inline">الأسبوع القادم</span>
            <ChevronLeft className="w-3.5 h-3.5 text-[#B69A68]" />
          </button>
        </div>
      </div>

      {/* Compact Legend */}
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-4 text-[11px] sm:text-xs text-[#68675F] select-none">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-rose-500 shrink-0" />
          <span className="truncate">حجز يومي مؤكد</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-amber-500 shrink-0" />
          <span className="truncate">عقد إيجار سنوي</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-blue-600 shrink-0" />
          <span className="truncate">عقد إيجار شهري</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-purple-600 shrink-0" />
          <span className="truncate">صيانة فنية معلقة</span>
        </div>
        <div className="flex items-center gap-1.5 col-span-2 sm:col-span-1">
          <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-slate-500 shrink-0" />
          <span className="truncate">حجب إداري أو مغلق</span>
        </div>
      </div>

      {/* Scrollable Matrix Table */}
      <div className="overflow-x-auto border border-[#E3DCCD] rounded-xl sm:rounded-2xl custom-horizontal-scrollbar max-w-full">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-[#F7F3EB]">
              {/* Sticky Unit Header Column */}
              <th className="p-2 sm:p-3 text-right font-bold text-[#282824] border-b border-l border-[#E3DCCD] sticky right-0 bg-[#F7F3EB] z-20 w-[115px] min-w-[110px] max-w-[130px] sm:w-48 sm:min-w-[190px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]">
                <span className="sm:hidden text-xs">الشقة والموقع</span>
                <span className="hidden sm:inline text-xs">رقم الشقة والموقع السكني</span>
              </th>
              {dates.map((d, i) => (
                <th
                  key={i}
                  className={`p-1.5 sm:p-2 text-center border-b border-l border-[#E3DCCD] min-w-[58px] sm:min-w-[70px] ${
                    d.isToday ? 'bg-amber-100/70 font-bold text-amber-950' : 'text-[#68675F]'
                  }`}
                >
                  <span className="block text-[10px] leading-tight">{d.dayName}</span>
                  <span className="text-xs sm:text-sm tabular-nums font-bold leading-tight">{d.dayNum}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {state.units.filter(u => u.publicationStatus !== 'archived').map((unit) => {
              const property = state.properties.find(p => p.id === unit.propertyId);
              const propertyName = property?.name.split(' - ')[1] || property?.name || '';
              const unitAllocations = state.allocations.filter(
                a => a.unitId === unit.id && a.status === 'active'
              );

              return (
                <tr key={unit.id} className="hover:bg-[#FFFCF6] transition-colors border-b border-[#E3DCCD]">
                  
                  {/* Sticky Compact Unit Column */}
                  <td className="p-2 sm:p-3 border-l border-[#E3DCCD] sticky right-0 bg-white z-10 text-right shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] w-[115px] min-w-[110px] max-w-[130px] sm:w-48 sm:min-w-[190px]">
                    <button
                      type="button"
                      onClick={() => onSelectUnit(unit)}
                      className="text-right w-full group/btn cursor-pointer"
                    >
                      {/* Line 1: Apartment Number */}
                      <div className="font-bold text-[#282824] text-xs sm:text-sm group-hover/btn:text-[#B69A68] transition-colors leading-tight">
                        شقة {unit.unitNumber}
                      </div>
                      {/* Line 2: Location · Floor */}
                      <div className="text-[10px] sm:text-xs text-[#68675F] mt-0.5 leading-tight break-words">
                        {propertyName} · الدور {unit.floorNumber}
                      </div>
                    </button>
                  </td>

                  {/* Day Cells */}
                  {dates.map((d, idx) => {
                    const dayStartMs = new Date(`${d.dateStr}T00:00:00`).getTime();
                    const dayEndMs = new Date(`${d.dateStr}T23:59:59`).getTime();

                    // Find if any allocation overlaps this day
                    const matchingAlloc = unitAllocations.find(a => {
                      const aStartMs = new Date(a.startDate).getTime();
                      const aEndMs = new Date(a.endDate).getTime();
                      return Math.max(dayStartMs, aStartMs) <= Math.min(dayEndMs, aEndMs);
                    });

                    // Comprehensive check for active long leases or bookings spanning this day
                    let leaseFallback = null;
                    let bookingFallback = null;
                    if (!matchingAlloc) {
                      leaseFallback = state.leases.find(l => {
                        if (l.unitId !== unit.id || (l.status as string) === 'cancelled' || (l.status as string) === 'terminated_early' || l.status === 'terminated') return false;
                        const lStartMs = new Date(l.startDate).getTime();
                        const lEndMs = new Date(l.endDate).getTime();
                        return Math.max(dayStartMs, lStartMs) <= Math.min(dayEndMs, lEndMs);
                      });
                      if (!leaseFallback) {
                        bookingFallback = state.bookings.find(b => {
                          if (b.unitId !== unit.id || b.status === 'cancelled') return false;
                          const bStartMs = new Date((b as any).startDate || b.checkIn).getTime();
                          const bEndMs = new Date((b as any).endDate || b.checkOut).getTime();
                          return Math.max(dayStartMs, bStartMs) <= Math.min(dayEndMs, bEndMs);
                        });
                      }
                    }

                    let cellContent = null;
                    if (matchingAlloc || leaseFallback || bookingFallback) {
                      let colorClass = 'bg-rose-100 text-rose-800 border-rose-300';
                      let label = 'يومي';

                      if (matchingAlloc) {
                        const allocType = ((matchingAlloc as any).type || (matchingAlloc as any).purpose || '').toLowerCase();
                        const rentalType = ((matchingAlloc as any).rentalType || '').toUpperCase();
                        if (allocType === 'lease' || rentalType === 'ANNUAL' || rentalType === 'MONTHLY') {
                          const lease = state.leases.find(l => l.id === matchingAlloc.referenceId);
                          if (lease?.rentalType === 'yearly' || (lease as any)?.type === 'yearly' || rentalType === 'ANNUAL') {
                            colorClass = 'bg-amber-100 text-amber-900 border-amber-300';
                            label = 'عقد سنوي';
                          } else {
                            colorClass = 'bg-blue-100 text-blue-800 border-blue-300';
                            label = 'عقد شهري';
                          }
                        } else if (allocType === 'maintenance') {
                          colorClass = 'bg-purple-100 text-purple-800 border-purple-300';
                          label = 'صيانة';
                        } else if (allocType === 'block') {
                          colorClass = 'bg-slate-100 text-slate-800 border-slate-300';
                          label = 'مغلق';
                        }
                      } else if (leaseFallback) {
                        const isYearly = leaseFallback.rentalType === 'yearly' || (leaseFallback as any).type === 'yearly' || (leaseFallback as any).rentalType === 'annual';
                        colorClass = isYearly ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-blue-100 text-blue-800 border-blue-300';
                        label = isYearly ? 'عقد سنوي' : 'عقد شهري';
                      } else if (bookingFallback) {
                        colorClass = 'bg-rose-100 text-rose-800 border-rose-300';
                        label = 'حجز فندقي';
                      }

                      cellContent = (
                        <div
                          title={`${label}: ${matchingAlloc?.notes || leaseFallback?.tenant?.fullName || bookingFallback?.guest?.fullName || ''}`}
                          onClick={() => onSelectUnit(unit)}
                          className={`w-full h-8 rounded-lg border px-0.5 flex items-center justify-center text-[10px] sm:text-[11px] font-bold ${colorClass} truncate cursor-pointer hover:opacity-90 select-none`}
                        >
                          {label}
                        </div>
                      );
                    }

                    return (
                      <td
                        key={idx}
                        className={`p-1 sm:p-1.5 border-l border-[#E3DCCD] text-center align-middle min-w-[58px] sm:min-w-[70px] ${
                          d.isToday ? 'bg-amber-50/40' : ''
                        }`}
                      >
                        {cellContent || (
                          <div className="w-full h-8 rounded-lg border border-dashed border-[#E3DCCD]/70 flex items-center justify-center text-[10px] text-emerald-700/60 font-medium select-none">
                            شاغر
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
