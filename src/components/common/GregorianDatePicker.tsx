import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate } from '../../utils/formatters';

interface GregorianDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void; // YYYY-MM-DD
  minDate?: string; // YYYY-MM-DD
  className?: string;
  placeholder?: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export const GregorianDatePicker: React.FC<GregorianDatePickerProps> = ({
  value,
  onChange,
  minDate,
  className = '',
  placeholder = 'Select date',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse current selected date or fallback to today
  const selectedDate = value ? new Date(value + 'T00:00:00') : new Date();
  const validSelectedDate = isNaN(selectedDate.getTime()) ? new Date() : selectedDate;

  const [viewYear, setViewYear] = useState(validSelectedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(validSelectedDate.getMonth());

  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T00:00:00');
      if (!isNaN(d.getTime())) {
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
      }
    }
  }, [value]);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Calendar calculations
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(prev => prev - 1);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(prev => prev + 1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const m = String(viewMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    const dateStr = `${viewYear}-${m}-${d}`;
    onChange(dateStr);
    setIsOpen(false);
  };

  const minDateObj = minDate ? new Date(minDate + 'T00:00:00') : null;

  return (
    <div ref={containerRef} className={`relative min-w-0 w-full ${className}`}>
      {/* Trigger Button */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 cursor-pointer w-full select-none"
        title="Select date (Gregorian)"
      >
        <CalendarIcon className="w-4 h-4 text-[#B69A68] shrink-0" />
        <bdi dir="ltr" className="tabular-nums font-mono text-xs sm:text-sm font-medium text-[#282824] truncate">
          {value ? formatDate(value) : placeholder}
        </bdi>
      </div>

      {/* Popover Calendar */}
      {isOpen && (
        <div
          dir="ltr"
          className="absolute top-full mt-2 left-0 z-50 w-64 bg-white rounded-2xl shadow-2xl border border-[#E3DCCD] p-3 text-xs font-sans text-slate-800"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Controls */}
          <div className="flex items-center justify-between mb-3 px-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 hover:bg-[#F7F3EB] rounded-lg text-slate-600 transition-colors cursor-pointer"
              aria-label="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-bold text-xs text-[#282824] tabular-nums font-mono">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 hover:bg-[#F7F3EB] rounded-lg text-slate-600 transition-colors cursor-pointer"
              aria-label="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Day Names Row */}
          <div className="grid grid-cols-7 gap-1 text-center font-mono text-[10px] text-slate-400 font-bold mb-1">
            {DAY_NAMES.map(day => (
              <div key={day}>{day}</div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center font-mono text-xs">
            {/* Blank offset days */}
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`blank-${i}`} />
            ))}

            {/* Days of Month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const currentDateObj = new Date(viewYear, viewMonth, dayNum);
              const m = String(viewMonth + 1).padStart(2, '0');
              const d = String(dayNum).padStart(2, '0');
              const dateIso = `${viewYear}-${m}-${d}`;
              const isSelected = value === dateIso;

              const isDisabled = minDateObj ? currentDateObj < new Date(minDateObj.getFullYear(), minDateObj.getMonth(), minDateObj.getDate()) : false;

              return (
                <button
                  key={`day-${dayNum}`}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => handleSelectDay(dayNum)}
                  className={`h-7 w-7 rounded-lg mx-auto flex items-center justify-center font-semibold transition-all cursor-pointer tabular-nums ${
                    isSelected
                      ? 'bg-[#282824] text-white shadow-xs font-bold'
                      : isDisabled
                      ? 'text-slate-300 cursor-not-allowed'
                      : 'hover:bg-[#F7F3EB] text-slate-700'
                  }`}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
