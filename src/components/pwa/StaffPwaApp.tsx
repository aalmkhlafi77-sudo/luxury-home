import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { MaintenanceTask } from '../../types';
import {
  Sparkles,
  Wrench,
  CheckCircle2,
  AlertCircle,
  Play,
  Check,
  ArrowRight,
  ShieldCheck,
  X
} from 'lucide-react';

interface StaffPwaAppProps {
  onBackToSite: () => void;
}

export const StaffPwaApp: React.FC<StaffPwaAppProps> = ({ onBackToSite }) => {
  const { state, updateHousekeepingTask, reportMaintenanceTask } = useAppStore();
  const [activeTab, setActiveTab] = useState<'housekeeping' | 'maintenance'>('housekeeping');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(state.housekeepingTasks[0]?.id || null);

  // Damage reporting state inside task
  const [isReportingMaint, setIsReportingMaint] = useState(false);
  const [maintTitle, setMaintTitle] = useState('');
  const [maintDesc, setMaintDesc] = useState('');
  const [maintCat, setMaintCat] = useState<MaintenanceTask['category']>('plumbing');

  const selectedTask = state.housekeepingTasks.find(t => t.id === selectedTaskId);
  const selectedUnit = selectedTask ? state.units.find(u => u.id === selectedTask.unitId) : null;
  const selectedProp = selectedTask ? state.properties.find(p => p.id === selectedTask.propertyId) : null;

  const handleToggleChecklist = (taskId: string, checkId: string) => {
    if (!selectedTask) return;
    const updatedChecklist = selectedTask.checklist.map(item =>
      item.id === checkId ? { ...item, done: !item.done } : item
    );
    updateHousekeepingTask(taskId, { checklist: updatedChecklist });
  };

  const handleStartTask = (taskId: string) => {
    updateHousekeepingTask(taskId, {
      status: 'in_progress',
      startedAt: new Date().toISOString(),
    });
  };

  const handleCompleteTask = (taskId: string) => {
    updateHousekeepingTask(taskId, {
      status: 'completed',
      completedAt: new Date().toISOString(),
    });
  };

  const handleSupervisorVerify = (taskId: string) => {
    updateHousekeepingTask(taskId, {
      status: 'verified',
      verifiedAt: new Date().toISOString(),
      verifiedBy: 'مريم العتيبي (مشرف الجودة الميداني)'
    });
  };

  const handleCreateQuickDamage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !maintTitle) return;
    reportMaintenanceTask({
      unitId: selectedTask.unitId,
      category: maintCat,
      severity: 'moderate',
      title: maintTitle,
      description: maintDesc,
      assignedToStaffName: 'فريق الصيانة السريعة الطارئة'
    });
    setIsReportingMaint(false);
    setMaintTitle('');
    setMaintDesc('');
  };

  return (
    <div className="min-h-screen bg-[#F7F3EB] text-[#282824] flex flex-col justify-between text-right">
      
      {/* PWA Mobile Header */}
      <header className="sticky top-0 z-40 bg-[#282824] text-white p-4 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          {state.settings.iconUrl ? (
            <img src={state.settings.iconUrl} alt="logo" className="w-8 h-8 rounded-lg object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-[#B69A68] text-[#282824] flex items-center justify-center font-bold text-xs">
              LH
            </div>
          )}
          <div>
            <h2 className="font-bold text-sm leading-none text-white">{state.settings.companyName}</h2>
            <span className="text-[10px] text-[#EFE9DF]/70 block mt-1">طواقم التشغيل وتطبيق الخدمة الفورية</span>
          </div>
        </div>
        <button
          onClick={onBackToSite}
          className="px-2.5 py-1 text-xs bg-white/10 hover:bg-white/20 rounded-lg flex items-center gap-1 transition-colors cursor-pointer text-white"
        >
          <span>العودة للموقع</span>
          <ArrowRight className="w-3.5 h-3.5 text-[#B69A68]" />
        </button>
      </header>

      {/* Main Mobile Stage */}
      <main className="flex-1 max-w-xl w-full mx-auto p-4 space-y-4">
        
        {/* Toggle Mode */}
        <div className="grid grid-cols-2 p-1 bg-[#EFE9DF] rounded-xl border border-[#E3DCCD] text-xs font-semibold select-none">
          <button
            onClick={() => setActiveTab('housekeeping')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'housekeeping' ? 'bg-[#282824] text-white shadow-xs' : 'text-[#68675F]'
            }`}
          >
            <Sparkles className="w-4 h-4 text-[#B69A68]" />
            <span>تنظيف الغرف ({state.housekeepingTasks.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('maintenance')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'maintenance' ? 'bg-[#282824] text-white shadow-xs' : 'text-[#68675F]'
            }`}
          >
            <Wrench className="w-4 h-4 text-[#B69A68]" />
            <span>بلاغات الأعطال ({state.maintenanceTasks.length})</span>
          </button>
        </div>

        {/* HOUSEKEEPING TASKS TAB */}
        {activeTab === 'housekeeping' && (
          <div className="space-y-4">
            
            {/* Horizontal Task Selector Bar */}
            <div className="flex gap-2 overflow-x-auto pb-1 select-none scrollbar-none">
              {state.housekeepingTasks.map(task => {
                const u = state.units.find(unit => unit.id === task.unitId);
                const isSelected = selectedTaskId === task.id;
                return (
                  <button
                    key={task.id}
                    onClick={() => setSelectedTaskId(task.id)}
                    className={`p-3 rounded-2xl border text-right min-w-[150px] shrink-0 transition-all cursor-pointer ${
                      isSelected ? 'border-[#B69A68] bg-[#FFFCF6] shadow-sm' : 'border-[#E3DCCD] bg-white hover:bg-stone-50'
                    }`}
                  >
                    <span className="block text-[10px] text-[#B69A68] font-bold">
                      مهمة: {task.taskNumber}
                    </span>
                    <strong className="block text-sm text-[#282824]">
                      جناح رقم #{u?.unitNumber || ''}
                    </strong>
                    <span className="text-[10px] text-[#68675F] block mt-1">
                      الحالة: {task.status === 'in_progress' ? 'جاري العمل' : task.status === 'verified' ? 'معتمدة' : 'بانتظار البدء'}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Selected Task Execution Box */}
            {selectedTask && (
              <div className="bg-white rounded-3xl p-5 border border-[#E3DCCD] shadow-xs space-y-5 text-xs text-right">
                
                {/* Task Card Header */}
                <div className="flex items-start justify-between pb-3 border-b border-[#E3DCCD] select-none">
                  <div>
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px]">
                      {selectedTask.type === 'turnover' ? 'تنظيف مغادرة وتطهير (Turnover)' : 'تنظيف دوري ومستمر'}
                    </span>
                    <h3 className="text-base font-bold text-[#282824] mt-1 text-right">
                      شقة رقم #{selectedUnit?.unitNumber} · {selectedProp?.name}
                    </h3>
                    <span className="text-[#68675F] block mt-1">
                      الدور {selectedUnit?.floorNumber} · المسؤول: {selectedTask.assignedToStaffName || 'غير معين'}
                    </span>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full font-bold text-[11px] ${
                    selectedTask.status === 'verified'
                      ? 'bg-emerald-100 text-emerald-800'
                      : selectedTask.status === 'completed'
                      ? 'bg-blue-100 text-blue-800'
                      : selectedTask.status === 'in_progress'
                      ? 'bg-amber-100 text-amber-800 animate-pulse'
                      : 'bg-slate-100 text-slate-800'
                  }`}>
                    {selectedTask.status === 'verified' && 'تم مراجعته'}
                    {selectedTask.status === 'completed' && 'انتهى التنظيف'}
                    {selectedTask.status === 'in_progress' && 'جاري التنظيف'}
                    {selectedTask.status === 'pending' && 'بانتظار البدء'}
                  </span>
                </div>

                {/* Important Notes */}
                {selectedTask.notes && (
                  <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 text-amber-900 leading-relaxed">
                    <strong className="block font-bold">تعليمات وتوصيات المشرفين:</strong>
                    <span>{selectedTask.notes}</span>
                  </div>
                )}

                {/* Interactive Checklist */}
                <div>
                  <h4 className="font-bold text-sm text-[#282824] mb-2.5">
                    المهام والخطوات الواجب فحصها وتطبيقها:
                  </h4>
                  <div className="space-y-2 text-right">
                    {selectedTask.checklist.map(item => (
                      <label
                        key={item.id}
                        className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-colors ${
                          item.done ? 'bg-emerald-50/60 border-emerald-300' : 'bg-[#F7F3EB]/40 border-[#E3DCCD]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={item.done}
                          onChange={() => handleToggleChecklist(selectedTask.id, item.id)}
                          className="w-4 h-4 rounded accent-[#B69A68] cursor-pointer"
                        />
                        <span className={`text-xs ${item.done ? 'line-through text-[#68675F] font-normal' : 'font-semibold text-[#282824]'}`}>
                          {item.text}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Damage & Maintenance Reporting */}
                <div className="pt-2 border-t border-[#E3DCCD] text-right">
                  {isReportingMaint ? (
                    <form onSubmit={handleCreateQuickDamage} className="p-3.5 bg-rose-50 rounded-2xl border border-rose-200 space-y-3 animate-in fade-in">
                      <h5 className="font-bold text-rose-900">تسجيل بلاغ عطل فني سريع أثناء التنظيف</h5>
                      <div>
                        <label className="block text-[11px] text-rose-800 font-semibold mb-1">اسم ووصف العطل المكتشف *</label>
                        <input
                          type="text"
                          required
                          placeholder="مثال: تلف مقبض الباب الذكي الداخلي للشرفة"
                          value={maintTitle}
                          onChange={(e) => setMaintTitle(e.target.value)}
                          className="w-full p-2 bg-white border border-rose-200 rounded-xl text-right focus:outline-none"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setIsReportingMaint(false)} className="px-2.5 py-1 border border-rose-200 rounded-lg cursor-pointer">إلغاء</button>
                        <button type="submit" className="px-3.5 py-1 bg-rose-700 text-white font-bold rounded-lg cursor-pointer">حفظ البلاغ</button>
                      </div>
                    </form>
                  ) : (
                    <button
                      onClick={() => setIsReportingMaint(true)}
                      className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold rounded-xl border border-rose-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <AlertCircle className="w-4 h-4" />
                      <span>هل لاحظت تلفاً أو عطلاً يحتاج صيانة؟ أبلغ من هنا</span>
                    </button>
                  )}
                </div>

                {/* Workflow Action Buttons */}
                <div className="pt-2 border-t border-[#E3DCCD] space-y-2 select-none">
                  {selectedTask.status === 'pending' && (
                    <button
                      onClick={() => handleStartTask(selectedTask.id)}
                      className="w-full py-3 bg-[#282824] hover:bg-[#1a1a18] text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                    >
                      <Play className="w-4 h-4 text-[#B69A68]" />
                      <span>البدء والولوج في مهمة التنظيف الآن</span>
                    </button>
                  )}
                  {selectedTask.status === 'in_progress' && (
                    <button
                      onClick={() => handleCompleteTask(selectedTask.id)}
                      className="w-full py-3 bg-[#B69A68] hover:bg-[#a68a58] text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                    >
                      <Check className="w-4 h-4 text-white" />
                      <span>تأكيد جرد الغرفة وإتمام مهمة التنظيف</span>
                    </button>
                  )}
                  {selectedTask.status === 'completed' && (
                    <div className="space-y-2">
                      <div className="p-3 bg-amber-50 rounded-xl text-amber-900 border border-amber-200 text-center font-semibold">
                        بانتظار فحص وجودة المشرف وتوقيع محضر المطابقة والجاهزية
                      </div>
                      <button
                        onClick={() => handleSupervisorVerify(selectedTask.id)}
                        className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                      >
                        <ShieldCheck className="w-4 h-4 text-white" />
                        <span>اعتماد جاهزية الشقة (خاص بالمشرفين)</span>
                      </button>
                    </div>
                  )}
                  {selectedTask.status === 'verified' && (
                    <div className="p-3 bg-emerald-50 rounded-xl text-emerald-900 border border-emerald-200 text-center font-bold flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>تمت المراجعة والاعتماد الفني للشقة وجاهزيتها لاستقبال النزلاء فوراً.</span>
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        )}

        {/* MAINTENANCE TASKS TAB */}
        {activeTab === 'maintenance' && (
          <div className="space-y-3 text-xs text-right">
            {state.maintenanceTasks.map(task => {
              const u = state.units.find(unit => unit.id === task.unitId);
              const p = state.properties.find(prop => prop.id === task.propertyId);
              return (
                <div key={task.id} className="p-4 bg-white rounded-2xl border border-[#E3DCCD] shadow-xs space-y-2 text-right">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#B69A68] font-mono">بلاغ: #{task.taskNumber}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      task.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-900 animate-pulse'
                    }`}>
                      {task.status === 'resolved' ? 'تمت معالجة العطل' : 'جاري الصيانة الفنية'}
                    </span>
                  </div>
                  <strong className="block text-sm text-[#282824] font-bold text-right">{task.title}</strong>
                  <p className="text-[#68675F] text-xs leading-relaxed">{task.description}</p>
                  
                  <div className="text-[11px] text-[#68675F] flex items-center justify-between pt-2 border-t border-[#E3DCCD] select-none">
                    <span>موقع العطل: {p?.name} · شقة #{u?.unitNumber}</span>
                    <span>الفني المسؤول: {task.assignedToStaffName || 'غير معين بعد'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </main>

      {/* Footer Quiet Notice */}
      <footer className="p-4 text-center text-xs text-[#68675F] select-none">
        نظام منزل الفخامة الموحد لعمليات التدبير المنزلي والصيانة الفندقية ©
      </footer>

    </div>
  );
};
