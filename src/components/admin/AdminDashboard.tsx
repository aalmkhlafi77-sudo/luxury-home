import React, { useState, useEffect } from 'react';
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
  authService,
  getAuthToken,
  getAuthUser,
  setAuthToken,
  setAuthUser
} from '../../services/api';
import {
  Building2,
  CalendarRange,
  FileText,
  CreditCard,
  Palette,
  ShieldCheck,
  ArrowRight,
  Sliders,
  Lock,
  LogOut,
  UserCheck,
  AlertCircle,
  KeyRound
} from 'lucide-react';

interface AdminDashboardProps {
  onBackToSite: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBackToSite }) => {
  const { state } = useAppStore();
  const [currentUser, setCurrentUser] = useState<any | null>(getAuthUser());
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(Boolean(getAuthToken()));
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const [hasAdminInitialized, setHasAdminInitialized] = useState<boolean>(true);

  // Form states
  const [isRegisterMode, setIsRegisterMode] = useState<boolean>(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const [activeModule, setActiveModule] = useState<'grid' | 'buildings' | 'timeline' | 'bookings' | 'finance' | 'content' | 'audit'>('grid');
  const [selectedUnitForControl, setSelectedUnitForControl] = useState<Unit | null>(null);

  // Verify token on mount and check if system has an admin initialized
  useEffect(() => {
    async function verifyAuthStatus() {
      setIsCheckingAuth(true);
      try {
        // Check server health to see if initial admin has been created
        const healthRes = await fetch('/api/health').then(r => r.json()).catch(() => null);
        if (healthRes) {
          setHasAdminInitialized(healthRes.hasAdminInitialized !== false);
          if (!healthRes.hasAdminInitialized) {
            setIsRegisterMode(true);
          }
        }

        const token = getAuthToken();
        if (token) {
          const res = await authService.getCurrentUser();
          if (res?.success && res?.user) {
            setCurrentUser(res.user);
            setAuthUser(res.user);
            setIsAuthenticated(true);
          } else {
            setAuthToken(null);
            setAuthUser(null);
            setIsAuthenticated(false);
          }
        }
      } catch (e) {
        // Token invalid or expired
        setAuthToken(null);
        setAuthUser(null);
        setIsAuthenticated(false);
      } finally {
        setIsCheckingAuth(false);
      }
    }

    verifyAuthStatus();
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsSubmitting(true);

    try {
      const res = await authService.login(username, password);
      if (res.success && res.user) {
        setCurrentUser(res.user);
        setIsAuthenticated(true);
      } else {
        setAuthError(res.message || 'بيانات الدخول غير صحيحة.');
      }
    } catch (err: any) {
      setAuthError(err.message || 'فشل الاتصال بالخادم. يرجى التحقق من صحة البيانات.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsSubmitting(true);

    try {
      const res = await authService.registerAdmin({
        username,
        password,
        name: fullName || username,
        email: email || `${username}@luxuryhome.sa`
      });

      if (res.success && res.user) {
        setCurrentUser(res.user);
        setIsAuthenticated(true);
        setHasAdminInitialized(true);
        setIsRegisterMode(false);
      } else {
        setAuthError(res.message || 'فشل إنشاء حساب المسؤول.');
      }
    } catch (err: any) {
      setAuthError(err.message || 'فشل تهيئة الحساب. تأكد من استيفاء شروط الأمان.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await authService.logout();
    setCurrentUser(null);
    setIsAuthenticated(false);
    onBackToSite();
  };

  // If user is not yet authenticated, render the secure authentication gate
  if (!isAuthenticated && !isCheckingAuth) {
    return (
      <div className="min-h-screen bg-[#F7F3EB] flex items-center justify-center p-4 text-right">
        <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 border border-[#E3DCCD] shadow-lg space-y-6">
          
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-[#282824] text-[#B69A68] flex items-center justify-center mx-auto shadow-md">
              <Lock className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-[#282824]">
              {isRegisterMode ? 'تهيئة مسؤول النظام الرئيسي' : 'تسجيل دخول لوحة الإدارة'}
            </h2>
            <p className="text-xs text-[#68675F]">
              {isRegisterMode 
                ? 'لم يتم إعداد مسؤول للنظام بعد. يرجى إنشاء الحساب الإداري الأول لتفعيل الحماية وإغلاق التسجيل العام.'
                : 'بوابة الدخول الآمنة لمسؤولي وموظفي Luxury home منزل الفخامة.'}
            </p>
          </div>

          {authError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          {isRegisterMode ? (
            <form onSubmit={handleRegisterAdminSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#282824] mb-1">اسم المستخدم (Username) *</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full p-2.5 bg-[#F7F3EB]/50 border border-[#E3DCCD] rounded-xl text-xs text-left dir-ltr focus:outline-none focus:border-[#B69A68]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#282824] mb-1">الاسم الكامل *</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="مدير النظام الرئيسي"
                  className="w-full p-2.5 bg-[#F7F3EB]/50 border border-[#E3DCCD] rounded-xl text-xs text-right focus:outline-none focus:border-[#B69A68]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#282824] mb-1">البريد الإلكتروني</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@luxuryhome.sa"
                  className="w-full p-2.5 bg-[#F7F3EB]/50 border border-[#E3DCCD] rounded-xl text-xs text-left dir-ltr focus:outline-none focus:border-[#B69A68]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#282824] mb-1">كلمة المرور (٦ خانات على الأقل) *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full p-2.5 bg-[#F7F3EB]/50 border border-[#E3DCCD] rounded-xl text-xs text-left dir-ltr focus:outline-none focus:border-[#B69A68]"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-[#282824] hover:bg-[#1a1a18] text-[#B69A68] font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <KeyRound className="w-4 h-4" />
                <span>{isSubmitting ? 'جاري الإنشاء...' : 'إنشاء حساب المسؤول وتأمين النظام'}</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#282824] mb-1">اسم المستخدم</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="اسم المستخدم"
                  className="w-full p-2.5 bg-[#F7F3EB]/50 border border-[#E3DCCD] rounded-xl text-xs text-left dir-ltr focus:outline-none focus:border-[#B69A68]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#282824] mb-1">كلمة المرور</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full p-2.5 bg-[#F7F3EB]/50 border border-[#E3DCCD] rounded-xl text-xs text-left dir-ltr focus:outline-none focus:border-[#B69A68]"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-[#282824] hover:bg-[#1a1a18] text-[#B69A68] font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                <span>{isSubmitting ? 'جاري التحقق...' : 'تسجيل الدخول الآمن'}</span>
              </button>
            </form>
          )}

          <div className="pt-3 border-t border-[#E3DCCD] text-center">
            <button
              onClick={onBackToSite}
              className="text-xs text-[#68675F] hover:text-[#282824] inline-flex items-center gap-1 transition-colors cursor-pointer"
            >
              <ArrowRight className="w-3.5 h-3.5 text-[#B69A68]" />
              <span>العودة للموقع العام</span>
            </button>
          </div>

        </div>
      </div>
    );
  }

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
            <div className="text-left text-xs hidden md:block">
              <span className="text-[#EFE9DF]/70 block text-[10px]">المستخدم الحالي:</span>
              <span className="text-white font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>{currentUser?.name || currentUser?.username || 'المسؤول المعتمد'}</span>
                <span className="px-1.5 py-0.5 rounded bg-[#B69A68]/30 text-[#B69A68] text-[9px] font-mono">
                  {currentUser?.role || 'SUPER_ADMIN'}
                </span>
              </span>
            </div>

            <button
              onClick={handleLogout}
              title="تسجيل الخروج"
              className="p-2 rounded-lg bg-rose-900/30 hover:bg-rose-900/50 text-rose-300 border border-rose-800/40 text-xs flex items-center gap-1 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">خروج</span>
            </button>
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
            <span>إدارة الحجوزات والتعاقدات</span>
          </button>
          <button
            onClick={() => setActiveModule('finance')}
            className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeModule === 'finance' ? 'bg-[#FFFCF6] text-[#282824] font-bold shadow-xs' : 'text-[#EFE9DF]/80 hover:text-white'
            }`}
          >
            <CreditCard className="w-4 h-4 text-[#B69A68]" />
            <span>المالية ومحرك توزيع التكاليف</span>
          </button>
          <button
            onClick={() => setActiveModule('content')}
            className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeModule === 'content' ? 'bg-[#FFFCF6] text-[#282824] font-bold shadow-xs' : 'text-[#EFE9DF]/80 hover:text-white'
            }`}
          >
            <Palette className="w-4 h-4 text-[#B69A68]" />
            <span>تخصيص المحتوى والهوية</span>
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
