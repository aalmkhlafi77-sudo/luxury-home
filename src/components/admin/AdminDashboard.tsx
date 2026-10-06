import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { OperationsGrid } from './OperationsGrid';
import { CalendarTimeline } from './CalendarTimeline';
import { BuildingManager } from './BuildingManager';
import { BookingsLeasesManager } from './BookingsLeasesManager';
import { FinancialsManager } from './FinancialsManager';
import { ContentCustomizer } from './ContentCustomizer';
import { UserManager } from './UserManager';
import { UnitControlModal } from './UnitControlModal';
import { Unit } from '../../types';
import { formatDate } from '../../utils/formatters';
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
  KeyRound,
  Users,
  UserCog,
  CheckCircle2,
  Shield
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

  // Profile Modal State
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [profileTab, setProfileTab] = useState<'profile' | 'password'>('profile');
  const [profileForm, setProfileForm] = useState({
    username: '',
    name: '',
    email: '',
    phone: '',
    currentPassword: '',
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [profileModalMsg, setProfileModalMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // Forced password change state
  const [forcedNewPassword, setForcedNewPassword] = useState('');
  const [forcedConfirmPassword, setForcedConfirmPassword] = useState('');
  const [forcedPasswordCurrent, setForcedPasswordCurrent] = useState('');
  const [forcedPasswordError, setForcedPasswordError] = useState<string | null>(null);

  const [activeModule, setActiveModule] = useState<'grid' | 'buildings' | 'timeline' | 'bookings' | 'finance' | 'content' | 'theme' | 'users' | 'audit'>('grid');
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
            <button
              onClick={() => {
                setShowProfileModal(true);
                setProfileModalMsg(null);
                setProfileTab('profile');
                setProfileForm({
                  username: currentUser?.username || '',
                  name: currentUser?.name || '',
                  email: currentUser?.email || '',
                  phone: currentUser?.phone || '',
                  currentPassword: '',
                });
                setPasswordForm({
                  currentPassword: '',
                  newPassword: '',
                  confirmPassword: '',
                });
              }}
              className="text-left text-xs hidden md:flex items-center gap-2 p-1.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer text-white"
              title="تعديل الملف الشخصي وكلمة المرور"
            >
              <div className="w-8 h-8 rounded-lg bg-[#B69A68]/30 border border-[#B69A68]/50 flex items-center justify-center text-[#B69A68] font-bold text-xs">
                <UserCog className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[#EFE9DF]/70 block text-[9px]">حسابي الشخصي:</span>
                <span className="text-white font-bold flex items-center gap-1.5 leading-tight">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>{currentUser?.name || currentUser?.username || 'المسؤول المعتمد'}</span>
                  <span className="px-1.5 py-0.2 rounded bg-[#B69A68]/30 text-[#B69A68] text-[9px] font-mono">
                    {currentUser?.role || 'SUPER_ADMIN'}
                  </span>
                </span>
              </div>
            </button>

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
            onClick={() => setActiveModule('theme')}
            className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeModule === 'theme' ? 'bg-[#FFFCF6] text-[#282824] font-bold shadow-xs' : 'text-[#EFE9DF]/80 hover:text-white'
            }`}
          >
            <Palette className="w-4 h-4 text-[#B69A68]" />
            <span>إعدادات المظهر</span>
          </button>

          {currentUser?.role === 'SUPER_ADMIN' && (
            <button
              onClick={() => setActiveModule('users')}
              className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeModule === 'users' ? 'bg-[#FFFCF6] text-[#282824] font-bold shadow-xs' : 'text-[#EFE9DF]/80 hover:text-white'
              }`}
            >
              <Users className="w-4 h-4 text-[#B69A68]" />
              <span>المستخدمون والصلاحيات</span>
            </button>
          )}

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
          <ContentCustomizer initialTab="typography" />
        )}
        {activeModule === 'theme' && (
          <ContentCustomizer initialTab="theme" />
        )}
        {activeModule === 'users' && currentUser?.role === 'SUPER_ADMIN' && (
          <UserManager />
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
                    <bdi dir="ltr">{formatDate(log.timestamp, 'short')}</bdi>
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

      {/* USER PROFILE & PASSWORD MODAL */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-[#E3DCCD] shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-[#E3DCCD]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#282824] text-[#B69A68] flex items-center justify-center">
                  <UserCog className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#282824]">إعدادات الحساب والأمان الشخصي</h3>
                  <span className="text-[11px] text-[#68675F]">المستخدم: @{currentUser?.username}</span>
                </div>
              </div>
              <button
                onClick={() => setShowProfileModal(false)}
                className="text-[#68675F] hover:text-[#282824] font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-[#F7F3EB] rounded-xl">
              <button
                onClick={() => {
                  setProfileTab('profile');
                  setProfileModalMsg(null);
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  profileTab === 'profile' ? 'bg-[#282824] text-white shadow-xs' : 'text-[#68675F] hover:text-[#282824]'
                }`}
              >
                تعديل اسم المستخدم والبيانات
              </button>
              <button
                onClick={() => {
                  setProfileTab('password');
                  setProfileModalMsg(null);
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  profileTab === 'password' ? 'bg-[#282824] text-white shadow-xs' : 'text-[#68675F] hover:text-[#282824]'
                }`}
              >
                تغيير كلمة المرور
              </button>
            </div>

            {profileModalMsg && (
              <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                profileModalMsg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}>
                {profileModalMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
                <span>{profileModalMsg.text}</span>
              </div>
            )}

            {profileTab === 'profile' ? (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setProfileModalMsg(null);
                  try {
                    const res = await authService.changeProfile(profileForm);
                    if (res.success && res.user) {
                      setCurrentUser(res.user);
                      setProfileModalMsg({ type: 'success', text: 'تم تحديث بيانات الحساب بنجاح.' });
                      setProfileForm(prev => ({ ...prev, currentPassword: '' }));
                    }
                  } catch (err: any) {
                    setProfileModalMsg({ type: 'error', text: err.message || 'فشل تحديث البيانات.' });
                  }
                }}
                className="space-y-3.5"
              >
                <div>
                  <label className="block text-xs font-semibold text-[#282824] mb-1">اسم المستخدم (Username) *</label>
                  <input
                    type="text"
                    required
                    value={profileForm.username}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, username: e.target.value }))}
                    className="w-full p-2.5 bg-[#F7F3EB]/50 border border-[#E3DCCD] rounded-xl text-xs text-left dir-ltr focus:outline-none focus:border-[#B69A68]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#282824] mb-1">الاسم الكامل *</label>
                  <input
                    type="text"
                    required
                    value={profileForm.name}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full p-2.5 bg-[#F7F3EB]/50 border border-[#E3DCCD] rounded-xl text-xs text-right focus:outline-none focus:border-[#B69A68]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#282824] mb-1">البريد الإلكتروني</label>
                    <input
                      type="email"
                      value={profileForm.email}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full p-2.5 bg-[#F7F3EB]/50 border border-[#E3DCCD] rounded-xl text-xs text-left dir-ltr focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#282824] mb-1">رقم الجوال</label>
                    <input
                      type="text"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full p-2.5 bg-[#F7F3EB]/50 border border-[#E3DCCD] rounded-xl text-xs text-left dir-ltr font-mono focus:outline-none"
                    />
                  </div>
                </div>

                <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl space-y-1">
                  <label className="block text-xs font-bold text-amber-950 mb-1">
                    أدخل كلمة المرور الحالية لتأكيد التعديلات *
                  </label>
                  <input
                    type="password"
                    required
                    value={profileForm.currentPassword}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full p-2 bg-white border border-amber-300 rounded-lg text-xs text-left dir-ltr focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowProfileModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-[#68675F] hover:bg-[#F7F3EB] rounded-xl cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-[#282824] hover:bg-[#1a1a18] text-[#B69A68] font-bold rounded-xl shadow-xs cursor-pointer"
                  >
                    حفظ التعديلات
                  </button>
                </div>
              </form>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setProfileModalMsg(null);
                  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
                    setProfileModalMsg({ type: 'error', text: 'كلمة المرور الجديدة وتأكيدها غير متطابقين.' });
                    return;
                  }
                  if (passwordForm.newPassword.length < 6) {
                    setProfileModalMsg({ type: 'error', text: 'كلمة المرور يجب ألا تقل عن ٦ خانات.' });
                    return;
                  }
                  try {
                    const res = await authService.changePassword(passwordForm.currentPassword, passwordForm.newPassword);
                    if (res.success) {
                      setProfileModalMsg({ type: 'success', text: 'تم تغيير كلمة المرور بنجاح.' });
                      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                    }
                  } catch (err: any) {
                    setProfileModalMsg({ type: 'error', text: err.message || 'فشل تغيير كلمة المرور.' });
                  }
                }}
                className="space-y-3.5"
              >
                <div>
                  <label className="block text-xs font-semibold text-[#282824] mb-1">كلمة المرور الحالية *</label>
                  <input
                    type="password"
                    required
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full p-2.5 bg-[#F7F3EB]/50 border border-[#E3DCCD] rounded-xl text-xs text-left dir-ltr focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#282824] mb-1">كلمة المرور الجديدة (٦ خانات على الأقل) *</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full p-2.5 bg-[#F7F3EB]/50 border border-[#E3DCCD] rounded-xl text-xs text-left dir-ltr focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#282824] mb-1">تأكيد كلمة المرور الجديدة *</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full p-2.5 bg-[#F7F3EB]/50 border border-[#E3DCCD] rounded-xl text-xs text-left dir-ltr focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowProfileModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-[#68675F] hover:bg-[#F7F3EB] rounded-xl cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-[#282824] hover:bg-[#1a1a18] text-[#B69A68] font-bold rounded-xl shadow-xs cursor-pointer"
                  >
                    تأكيد تغيير كلمة المرور
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* FORCED PASSWORD CHANGE ON NEXT LOGIN MODAL */}
      {currentUser?.mustChangePassword && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-amber-300 shadow-2xl space-y-4">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
                <KeyRound className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-[#282824]">تنبيه أمني: يلزم تعيين كلمة مرور جديدة</h3>
              <p className="text-xs text-[#68675F] leading-relaxed">
                تم تسجيل دخولك باستخدام كلمة مرور مؤقتة أو بناءً على طلب إعادة تعيين من الإدارة. يرجى تعيين كلمة مرور شخصية جديدة وآمنة للاستمرار.
              </p>
            </div>

            {forcedPasswordError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{forcedPasswordError}</span>
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setForcedPasswordError(null);
                if (forcedNewPassword !== forcedConfirmPassword) {
                  setForcedPasswordError('كلمة المرور الجديدة وتأكيدها غير متطابقين.');
                  return;
                }
                if (forcedNewPassword.length < 6) {
                  setForcedPasswordError('يجب أن تتكون كلمة المرور من ٦ خانات على الأقل.');
                  return;
                }
                try {
                  const res = await authService.changePassword(forcedPasswordCurrent, forcedNewPassword);
                  if (res.success && res.user) {
                    setCurrentUser({ ...res.user, mustChangePassword: false });
                    setAuthUser({ ...res.user, mustChangePassword: false });
                  }
                } catch (err: any) {
                  setForcedPasswordError(err.message || 'فشل تعيين كلمة المرور الجديدة. تأكد من إدخال كلمة المرور المؤقتة بشكل صحيح.');
                }
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-semibold text-[#282824] mb-1">كلمة المرور المؤقتة الحالية *</label>
                <input
                  type="password"
                  required
                  value={forcedPasswordCurrent}
                  onChange={(e) => setForcedPasswordCurrent(e.target.value)}
                  placeholder="••••••••"
                  className="w-full p-2.5 bg-[#F7F3EB]/50 border border-[#E3DCCD] rounded-xl text-xs text-left dir-ltr focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#282824] mb-1">كلمة المرور الجديدة الدائمة *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={forcedNewPassword}
                  onChange={(e) => setForcedNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full p-2.5 bg-[#F7F3EB]/50 border border-[#E3DCCD] rounded-xl text-xs text-left dir-ltr focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#282824] mb-1">تأكيد كلمة المرور الجديدة *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={forcedConfirmPassword}
                  onChange={(e) => setForcedConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full p-2.5 bg-[#F7F3EB]/50 border border-[#E3DCCD] rounded-xl text-xs text-left dir-ltr focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-[#282824] hover:bg-[#1a1a18] text-[#B69A68] font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2 mt-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>حفظ كلمة المرور والدخول إلى لوحة الإدارة</span>
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
