import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { OperationsGrid } from './OperationsGrid';
import { CalendarTimeline } from './CalendarTimeline';
import { BuildingManager } from './BuildingManager';
import { BookingsLeasesManager } from './BookingsLeasesManager';
import { FinancialsManager } from './FinancialsManager';
import { ContentCustomizer } from './ContentCustomizer';
import { UnitControlModal } from './UnitControlModal';
import { Unit } from '../../types';
import {
  Building2,
  CalendarRange,
  FileText,
  CreditCard,
  Palette,
  ShieldCheck,
  ArrowRight,
  Sliders
} from 'lucide-react';

interface AdminDashboardProps {
  onBackToSite: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBackToSite }) => {
  const { state } = useAppStore();
  const [activeModule, setActiveModule] = useState<'grid' | 'buildings' | 'timeline' | 'bookings' | 'finance' | 'content' | 'audit'>('grid');
  const [selectedUnitForControl, setSelectedUnitForControl] = useState<Unit | null>(null);

  return (
    <div className="min-h-screen bg-[#F7F3EB] text-[#282824] text-right">
      
      {/* Admin Top Navigation */}
      <header className="sticky top-0 z-45 bg-[#282824] text-white border-b border-[#3e3e38]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          
          <div className="flex items-center gap-4">
            <button
              onClick={onBackToSite}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold transition-colors cursor-pointer text-white"
            >
              <ArrowRight className="w-4 h-4 text-[#B69A68]" />
              <span>العودة للموقع العام</span>
            </button>
            <div className="h-6 w-px bg-white/20 hidden sm:block" />
            <div className="flex items-center gap-2.5">
              {state.settings.logoUrl ? (
                <img src={state.settings.logoUrl} alt="Logo" className="h-8 w-auto object-contain brightness-0 invert" />
              ) : state.settings.iconUrl ? (
                <img src={state.settings.iconUrl} alt="Icon" className="w-8 h-8 rounded-lg object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-[#B69A68] text-[#282824] flex items-center justify-center font-bold text-xs">
                  LH
                </div>
              )}
              <div>
                <span className="font-bold text-sm text-white block leading-tight">
                  {state.settings.companyName}
                </span>
                <span className="text-[10px] text-[#EFE9DF]/60 block mt-0.5">
                  لوحة تحكم العمليات والمالية الفنية للمشرفين
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-[#EFE9DF]/70 hidden md:inline">
              مسؤول العمليات المعتمد: <strong className="text-white font-semibold">أحمد المفلح</strong>
            </span>
          </div>
        </div>

        {/* Modules Sub-bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 overflow-x-auto flex items-center gap-1.5 py-2 border-t border-[#3e3e38] text-xs font-medium custom-horizontal-scrollbar-dark">
          <button
            onClick={() => setActiveModule('grid')}
            className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeModule === 'grid' ? 'bg-[#FFFCF6] text-[#282824] font-bold shadow-xs' : 'text-[#EFE9DF]/80 hover:text-white'
            }`}
          >
            <Sliders className="w-4 h-4 text-[#B69A68]" />
            <span>لوحة المتابعة الميدانية</span>
          </button>
          <button
            onClick={() => setActiveModule('buildings')}
            className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeModule === 'buildings' ? 'bg-[#FFFCF6] text-[#282824] font-bold shadow-xs' : 'text-[#EFE9DF]/80 hover:text-white'
            }`}
          >
            <Building2 className="w-4 h-4 text-[#B69A68]" />
            <span>هيكلة وأثاث المجمعات</span>
          </button>
          <button
            onClick={() => setActiveModule('timeline')}
            className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeModule === 'timeline' ? 'bg-[#FFFCF6] text-[#282824] font-bold shadow-xs' : 'text-[#EFE9DF]/80 hover:text-white'
            }`}
          >
            <CalendarRange className="w-4 h-4 text-[#B69A68]" />
            <span>مخطط الجدولة والإشغال</span>
          </button>
          <button
            onClick={() => setActiveModule('bookings')}
            className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeModule === 'bookings' ? 'bg-[#FFFCF6] text-[#282824] font-bold shadow-xs' : 'text-[#EFE9DF]/80 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4 text-[#B69A68]" />
            <span>سجل الحجوزات والعقود ({state.bookings.length + state.leases.length})</span>
          </button>
          <button
            onClick={() => setActiveModule('finance')}
            className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeModule === 'finance' ? 'bg-[#FFFCF6] text-[#282824] font-bold shadow-xs' : 'text-[#EFE9DF]/80 hover:text-white'
            }`}
          >
            <CreditCard className="w-4 h-4 text-[#B69A68]" />
            <span>المالية والحسابات والـ NOI</span>
          </button>
          <button
            onClick={() => setActiveModule('content')}
            className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeModule === 'content' ? 'bg-[#FFFCF6] text-[#282824] font-bold shadow-xs' : 'text-[#EFE9DF]/80 hover:text-white'
            }`}
          >
            <Palette className="w-4 h-4 text-[#B69A68]" />
            <span>تخصيص محتوى الموقع الهبوطي</span>
          </button>
          <button
            onClick={() => setActiveModule('audit')}
            className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeModule === 'audit' ? 'bg-[#FFFCF6] text-[#282824] font-bold shadow-xs' : 'text-[#EFE9DF]/80 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-[#B69A68]" />
            <span>سجل العمليات والامتثال الموحد (Audit)</span>
          </button>
        </div>
      </header>

      {/* Main Admin Stage */}
      <main className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 py-4 sm:py-8">
        
        {activeModule === 'grid' && (
          <OperationsGrid onSelectUnit={(unit) => setSelectedUnitForControl(unit)} />
        )}
        {activeModule === 'buildings' && (
          <BuildingManager />
        )}
        {activeModule === 'timeline' && (
          <CalendarTimeline onSelectUnit={(unit) => setSelectedUnitForControl(unit)} />
        )}
        {activeModule === 'bookings' && (
          <BookingsLeasesManager />
        )}
        {activeModule === 'finance' && (
          <FinancialsManager />
        )}
        {activeModule === 'content' && (
          <ContentCustomizer />
        )}
        {activeModule === 'audit' && (
          <div className="bg-white rounded-3xl p-6 border border-[#E3DCCD] shadow-xs space-y-4 text-xs text-right animate-in fade-in">
            <div className="pb-3 border-b border-[#E3DCCD]/60 select-none">
              <h4 className="font-bold text-sm text-[#282824]">أرشيف الأمان والامتثال الموحد (Audit Trail)</h4>
              <p className="text-[#68675F] mt-0.5">
                سجل إلكتروني معزول غير قابل للمسح يرصد كافة حركات الدخول، عرض الأكواد الرقمية، الدفعات، والتعاقدات للامتثال الأمني والمالي
              </p>
            </div>

            <div className="divide-y divide-[#E3DCCD]">
              {state.auditLogs.map(log => (
                <div key={log.id} className="py-3 flex items-start justify-between gap-4 text-right">
                  <div>
                    <strong className="block text-sm text-[#282824] font-bold">{log.action}</strong>
                    <span className="text-[#68675F] block mt-0.5 leading-relaxed">{log.details}</span>
                    <span className="text-[10px] text-[#B69A68] block mt-1 select-none">
                      المستخدم: {log.performedBy} ({log.role}) · تتبع مستند: {log.entity} · المعرف: {log.entityId}
                    </span>
                  </div>
                  <span className="text-[11px] text-[#68675F] shrink-0 tabular-nums font-mono select-none">
                    {new Date(log.timestamp).toLocaleString('ar-SA')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* UNIT CONTROL MODAL */}
      {selectedUnitForControl && (
        <UnitControlModal
          unit={selectedUnitForControl}
          onClose={() => setSelectedUnitForControl(null)}
        />
      )}

    </div>
  );
};
