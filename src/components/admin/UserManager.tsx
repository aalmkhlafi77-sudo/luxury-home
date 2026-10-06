import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { userService, ApiError } from '../../services/api';
import { AppUser, UserRole } from '../../types';
import {
  Users,
  UserPlus,
  Shield,
  ShieldAlert,
  ShieldCheck,
  KeyRound,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Search,
  RefreshCw,
  Copy,
  Check,
  AlertTriangle,
  Building2,
  Lock,
  Mail,
  Phone,
  User as UserIcon,
  Filter
} from 'lucide-react';

const ROLE_LABELS: Record<UserRole, { label: string; desc: string; color: string; badgeBg: string }> = {
  SUPER_ADMIN: {
    label: 'مسؤول النظام العام (Super Admin)',
    desc: 'كامل الصلاحيات والتحكم الإداري والمالي والأمني وحسابات الموظفين',
    color: 'text-amber-800',
    badgeBg: 'bg-amber-100 border-amber-300 text-amber-900',
  },
  PROPERTY_MANAGER: {
    label: 'مدير عقارات وتشغيل (Property Manager)',
    desc: 'إدارة المباني، الوحدات، الحجوزات، العقود، والعمليات للمباني المخصصة',
    color: 'text-blue-800',
    badgeBg: 'bg-blue-100 border-blue-300 text-blue-900',
  },
  ACCOUNTANT: {
    label: 'المحاسب المالي (Accountant)',
    desc: 'إدارة القيود المالية والمصاريف والتقارير وسندات القبض ومحرك التوزيع',
    color: 'text-emerald-800',
    badgeBg: 'bg-emerald-100 border-emerald-300 text-emerald-900',
  },
  RECEPTIONIST: {
    label: 'موظف استقبال وضيافة (Receptionist)',
    desc: 'استقبال النزلاء، تسجيل الدخول والمغادرة، وإنشاء الحجوزات الميدانية',
    color: 'text-purple-800',
    badgeBg: 'bg-purple-100 border-purple-300 text-purple-900',
  },
  HOUSEKEEPING: {
    label: 'مشرف نظافة وتجهيز (Housekeeping)',
    desc: 'متابعة مهام التنظيف وتجهيز الشقق والفحص الدوري بعد المغادرة',
    color: 'text-teal-800',
    badgeBg: 'bg-teal-100 border-teal-300 text-teal-900',
  },
  MAINTENANCE: {
    label: 'فني صيانة (Maintenance)',
    desc: 'استلام بلاغات الصيانة، الفحص الفني، وإصلاح أعطال الوحدات والأقفال',
    color: 'text-orange-800',
    badgeBg: 'bg-orange-100 border-orange-300 text-orange-900',
  },
  TENANT: {
    label: 'نزيل / مستأجر (Tenant/Guest)',
    desc: 'بوابة النزيل لعرض عقوده، فواتيره، وطلب الخدمات الفندقية',
    color: 'text-stone-800',
    badgeBg: 'bg-stone-100 border-stone-300 text-stone-900',
  },
};

export const UserManager: React.FC = () => {
  const { state } = useAppStore();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<AppUser | null>(null);
  const [generatedTempPassword, setGeneratedTempPassword] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Form States
  const [createForm, setCreateForm] = useState({
    username: '',
    password: '',
    name: '',
    email: '',
    phone: '',
    role: 'PROPERTY_MANAGER' as UserRole,
    allowedProperties: ['all'] as string[],
    mustChangePassword: true,
  });

  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'PROPERTY_MANAGER' as UserRole,
    allowedProperties: ['all'] as string[],
    isActive: true,
  });

  // Fetch Users
  const fetchUsers = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await userService.getUsers();
      if (res.success && Array.isArray(res.users)) {
        setUsers(res.users);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل تحميل قائمة المستخدمين من الخادم.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleGenerateSecurePass = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*';
    const pass = 'Luxe-' + Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('') + '!';
    setCreateForm(prev => ({ ...prev, password: pass }));
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      const res = await userService.createUser(createForm);
      if (res.success) {
        setSuccessMsg(`تم إنشاء حساب المستخدم (${createForm.username}) بنجاح.`);
        setShowCreateModal(false);
        setCreateForm({
          username: '',
          password: '',
          name: '',
          email: '',
          phone: '',
          role: 'PROPERTY_MANAGER',
          allowedProperties: ['all'],
          mustChangePassword: true,
        });
        await fetchUsers();
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل إنشاء حساب المستخدم.');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setErrorMsg(null);
    try {
      const res = await userService.updateUser(editingUser.id, editForm);
      if (res.success) {
        setSuccessMsg(`تم تحديث بيانات وصلاحيات (${editingUser.username}) بنجاح.`);
        setEditingUser(null);
        await fetchUsers();
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل تحديث بيانات المستخدم.');
    }
  };

  const handleToggleStatus = async (user: AppUser) => {
    const newStatus = !user.isActive;
    setErrorMsg(null);
    try {
      const res = await userService.updateUser(user.id, { isActive: newStatus });
      if (res.success) {
        setSuccessMsg(`تم ${newStatus ? 'تفعيل' : 'تعطيل'} حساب (${user.username}) بنجاح.`);
        await fetchUsers();
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل تغيير حالة الحساب.');
    }
  };

  const handleResetPasswordSubmit = async () => {
    if (!resetPasswordUser) return;
    setErrorMsg(null);
    try {
      const res = await userService.resetPassword(resetPasswordUser.id);
      if (res.success && res.temporaryPassword) {
        setGeneratedTempPassword(res.temporaryPassword);
        setSuccessMsg(`تم إنشاء كلمة المرور المؤقتة بنجاح للحساب (${resetPasswordUser.username}).`);
        await fetchUsers();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل إعادة تعيين كلمة المرور.');
    }
  };

  const handleDeleteUser = async (user: AppUser) => {
    if (!confirm(`هل أنت متأكد من رغبتك في حذف حساب المستخدم (${user.name} - @${user.username}) نهائياً؟ هذا الإجراء لا يمكن التراجع عنه.`)) {
      return;
    }
    setErrorMsg(null);
    try {
      const res = await userService.deleteUser(user.id);
      if (res.success) {
        setSuccessMsg(`تم حذف حساب (${user.username}) بنجاح.`);
        await fetchUsers();
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل حذف المستخدم.');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2500);
  };

  // Filtered Users
  const filteredUsers = users.filter(u => {
    const matchesSearch =
      !searchQuery ||
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.phone && u.phone.includes(searchQuery));

    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && u.isActive) ||
      (statusFilter === 'inactive' && !u.isActive);

    return matchesSearch && matchesRole && matchesStatus;
  });

  const activeSuperAdmins = users.filter(u => u.role === 'SUPER_ADMIN' && u.isActive).length;

  return (
    <div className="space-y-6 text-xs text-right animate-in fade-in">
      
      {/* Top Banner & Quick Metrics */}
      <div className="bg-white rounded-3xl p-6 border border-[#E3DCCD] shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E3DCCD]">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#B69A68]" />
              <h3 className="text-base font-bold text-[#282824]">إدارة حسابات ومستخدمي الشركة وصلاحيات النفاذ</h3>
            </div>
            <p className="text-[#68675F] mt-1 text-xs">
              التحكم في أدوار المشرفين والموظفين، نطاق المباني المخصصة، إعادة تعيين كلمات المرور المؤقتة، وتعطيل الحسابات بأمان.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchUsers}
              className="p-2.5 bg-[#F7F3EB] hover:bg-[#EFE9DF] text-[#282824] rounded-xl font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="تحديث البيانات من قاعدة البيانات"
            >
              <RefreshCw className={`w-4 h-4 text-[#B69A68] ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">تحديث</span>
            </button>
            <button
              onClick={() => {
                setShowCreateModal(true);
                handleGenerateSecurePass();
              }}
              className="px-4 py-2.5 bg-[#282824] hover:bg-[#1a1a18] text-[#B69A68] font-bold rounded-xl flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>إضافة مستخدم جديد</span>
            </button>
          </div>
        </div>

        {/* Status Messages */}
        {errorMsg && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="font-semibold">{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-700 font-bold">✕</button>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700 font-bold">✕</button>
          </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="p-3.5 bg-[#F7F3EB]/60 rounded-2xl border border-[#E3DCCD]">
            <span className="text-[11px] text-[#68675F] block mb-1">إجمالي الحسابات</span>
            <span className="text-xl font-bold text-[#282824] font-mono tabular-nums">{users.length}</span>
          </div>
          <div className="p-3.5 bg-[#F7F3EB]/60 rounded-2xl border border-[#E3DCCD]">
            <span className="text-[11px] text-[#68675F] block mb-1">المسؤولون العامون (Super Admins)</span>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-amber-700 font-mono tabular-nums">{activeSuperAdmins}</span>
              {activeSuperAdmins === 1 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                  محمي
                </span>
              )}
            </div>
          </div>
          <div className="p-3.5 bg-[#F7F3EB]/60 rounded-2xl border border-[#E3DCCD]">
            <span className="text-[11px] text-[#68675F] block mb-1">مديرو العقارات والتشغيل</span>
            <span className="text-xl font-bold text-blue-700 font-mono tabular-nums">
              {users.filter(u => u.role === 'PROPERTY_MANAGER' && u.isActive).length}
            </span>
          </div>
          <div className="p-3.5 bg-[#F7F3EB]/60 rounded-2xl border border-[#E3DCCD]">
            <span className="text-[11px] text-[#68675F] block mb-1">المحاسبون وموظفو الضيافة</span>
            <span className="text-xl font-bold text-emerald-700 font-mono tabular-nums">
              {users.filter(u => ['ACCOUNTANT', 'RECEPTIONIST', 'HOUSEKEEPING', 'MAINTENANCE'].includes(u.role) && u.isActive).length}
            </span>
          </div>
        </div>

        {/* Search & Filters Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-2">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-[#68675F] absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="البحث باسم المستخدم، الاسم الكامل، أو البريد..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-9 pl-3 py-2 bg-white border border-[#E3DCCD] rounded-xl text-xs text-right focus:outline-none focus:border-[#B69A68]"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
            <div className="flex items-center gap-1.5 bg-[#F7F3EB] px-2.5 py-1.5 rounded-xl border border-[#E3DCCD]">
              <Filter className="w-3.5 h-3.5 text-[#B69A68]" />
              <span className="text-[11px] font-semibold text-[#68675F]">الدور:</span>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="bg-transparent border-none text-xs font-bold text-[#282824] focus:outline-none cursor-pointer"
              >
                <option value="all">جميع الصلاحيات والأدوار</option>
                <option value="SUPER_ADMIN">مسؤول النظام العام (SUPER_ADMIN)</option>
                <option value="PROPERTY_MANAGER">مدير عقارات (PROPERTY_MANAGER)</option>
                <option value="ACCOUNTANT">محاسب مالي (ACCOUNTANT)</option>
                <option value="RECEPTIONIST">موظف استقبال (RECEPTIONIST)</option>
                <option value="HOUSEKEEPING">مشرف نظافة (HOUSEKEEPING)</option>
                <option value="MAINTENANCE">فني صيانة (MAINTENANCE)</option>
                <option value="TENANT">نزيل (TENANT)</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-[#F7F3EB] px-2.5 py-1.5 rounded-xl border border-[#E3DCCD]">
              <span className="text-[11px] font-semibold text-[#68675F]">الحالة:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent border-none text-xs font-bold text-[#282824] focus:outline-none cursor-pointer"
              >
                <option value="all">الكل</option>
                <option value="active">الحسابات النشطة فقط</option>
                <option value="inactive">الحسابات المعطلة فقط</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Users List Table */}
      <div className="bg-white rounded-3xl border border-[#E3DCCD] shadow-xs overflow-hidden">
        <div className="overflow-x-auto custom-horizontal-scrollbar">
          <table className="w-full text-right border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-[#F7F3EB]/80 border-b border-[#E3DCCD] text-[#68675F] text-[11px] font-bold">
                <th className="p-4">المستخدم</th>
                <th className="p-4">الدور والصلاحية</th>
                <th className="p-4">نطاق المباني المخصصة</th>
                <th className="p-4">الحالة</th>
                <th className="p-4">تاريخ الإنشاء</th>
                <th className="p-4 text-center">الإجراءات والتحكم</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3DCCD]">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-[#68675F]">
                    لا توجد حسابات مستخدمين تطابق معايير البحث والفلترة.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const roleConfig = ROLE_LABELS[user.role] || ROLE_LABELS.PROPERTY_MANAGER;
                  const isLastSuperAdmin = user.role === 'SUPER_ADMIN' && user.isActive && activeSuperAdmins <= 1;

                  return (
                    <tr key={user.id} className={`hover:bg-[#F7F3EB]/30 transition-colors ${!user.isActive ? 'opacity-60 bg-stone-50' : ''}`}>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-[#282824] text-[#B69A68] font-bold flex items-center justify-center shrink-0 text-xs">
                            {user.name ? user.name.slice(0, 2) : user.username.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-sm text-[#282824] block">
                              {user.name}
                            </span>
                            <div className="flex items-center gap-2 text-[11px] text-[#68675F] mt-0.5">
                              <span className="font-mono dir-ltr text-right">@{user.username}</span>
                              {user.phone && <span>· <bdi dir="ltr">{user.phone}</bdi></span>}
                              {user.mustChangePassword && (
                                <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px] font-semibold">
                                  مطلوب تغيير كلمة المرور
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-[#68675F]/80 block font-mono mt-0.5">{user.email}</span>
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <span className={`inline-block px-2.5 py-1 rounded-lg border text-[11px] font-bold ${roleConfig.badgeBg}`}>
                          {roleConfig.label.split('(')[0]}
                        </span>
                        <span className="block text-[10px] text-[#68675F] mt-1 line-clamp-1 max-w-xs">
                          {roleConfig.desc}
                        </span>
                      </td>

                      <td className="p-4">
                        {user.allowedProperties.includes('all') ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold text-[11px]">
                            <Building2 className="w-3 h-3" />
                            <span>جميع المجمعات والأبراج</span>
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {user.allowedProperties.map((pId) => {
                              const prop = state.properties.find(p => p.id === pId);
                              return (
                                <span key={pId} className="px-2 py-0.5 rounded bg-[#F7F3EB] border border-[#E3DCCD] text-[10px] font-bold text-[#282824]">
                                  {prop ? prop.name : pId}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </td>

                      <td className="p-4">
                        <button
                          onClick={() => handleToggleStatus(user)}
                          disabled={isLastSuperAdmin}
                          title={isLastSuperAdmin ? 'لا يمكن تعطيل آخر مسؤول عام نشط' : 'تبديل حالة التفعيل'}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold text-[11px] transition-all cursor-pointer ${
                            user.isActive
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                              : 'bg-rose-100 text-rose-800 border border-rose-300 hover:bg-rose-200'
                          } ${isLastSuperAdmin ? 'opacity-80 cursor-not-allowed' : ''}`}
                        >
                          <span className={`w-2 h-2 rounded-full ${user.isActive ? 'bg-emerald-600' : 'bg-rose-600'}`}></span>
                          <span>{user.isActive ? 'حساب نشط' : 'معطل'}</span>
                        </button>
                      </td>

                      <td className="p-4 text-[#68675F] font-mono tabular-nums text-[11px]">
                        {new Date(user.createdAt).toLocaleDateString('en-GB')}
                      </td>

                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              setEditingUser(user);
                              setEditForm({
                                name: user.name,
                                email: user.email,
                                phone: user.phone || '',
                                role: user.role,
                                allowedProperties: [...user.allowedProperties],
                                isActive: user.isActive,
                              });
                            }}
                            className="p-1.5 text-[#282824] hover:bg-[#F7F3EB] rounded-lg border border-[#E3DCCD] transition-colors cursor-pointer"
                            title="تعديل الدور ونطاق الصلاحيات"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-[#B69A68]" />
                          </button>

                          <button
                            onClick={() => {
                              setResetPasswordUser(user);
                              setGeneratedTempPassword(null);
                            }}
                            className="p-1.5 text-[#282824] hover:bg-[#F7F3EB] rounded-lg border border-[#E3DCCD] transition-colors cursor-pointer"
                            title="إعادة تعيين كلمة المرور وتوليد كلمة مؤقتة"
                          >
                            <KeyRound className="w-3.5 h-3.5 text-amber-700" />
                          </button>

                          <button
                            onClick={() => handleDeleteUser(user)}
                            disabled={isLastSuperAdmin}
                            className={`p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer ${
                              isLastSuperAdmin ? 'opacity-30 cursor-not-allowed' : ''
                            }`}
                            title={isLastSuperAdmin ? 'محمي: لا يمكن حذف آخر مسؤول عام' : 'حذف الحساب'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE USER MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-[#E3DCCD] shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-[#E3DCCD]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#282824] text-[#B69A68] flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#282824]">إنشاء حساب مستخدم جديد</h3>
                  <span className="text-[11px] text-[#68675F]">إضافة حساب إداري أو تشغيلي جديد للنظام</span>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-[#68675F] hover:text-[#282824] font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#282824] mb-1">اسم المستخدم (Username) *</label>
                  <input
                    type="text"
                    required
                    value={createForm.username}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="مثال: ahmed_mgr"
                    className="w-full p-2.5 bg-[#F7F3EB]/50 border border-[#E3DCCD] rounded-xl text-xs text-left dir-ltr focus:outline-none focus:border-[#B69A68]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#282824] mb-1">الاسم الكامل *</label>
                  <input
                    type="text"
                    required
                    value={createForm.name}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="مثال: أحمد عبد الله"
                    className="w-full p-2.5 bg-[#F7F3EB]/50 border border-[#E3DCCD] rounded-xl text-xs text-right focus:outline-none focus:border-[#B69A68]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#282824] mb-1">البريد الإلكتروني</label>
                  <input
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="name@luxuryhome.sa"
                    className="w-full p-2.5 bg-[#F7F3EB]/50 border border-[#E3DCCD] rounded-xl text-xs text-left dir-ltr focus:outline-none focus:border-[#B69A68]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#282824] mb-1">رقم الجوال</label>
                  <input
                    type="text"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+966 50 000 0000"
                    className="w-full p-2.5 bg-[#F7F3EB]/50 border border-[#E3DCCD] rounded-xl text-xs text-left dir-ltr font-mono focus:outline-none focus:border-[#B69A68]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#282824] mb-1">الدور والصلاحية *</label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, role: e.target.value as UserRole }))}
                  className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl text-xs text-right font-bold focus:outline-none focus:border-[#B69A68]"
                >
                  {Object.entries(ROLE_LABELS).map(([rKey, config]) => (
                    <option key={rKey} value={rKey}>{config.label}</option>
                  ))}
                </select>
                <p className="text-[10px] text-[#68675F] mt-1">{ROLE_LABELS[createForm.role]?.desc}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#282824] mb-1">نطاق المباني المسموح للمستخدم إدارتها</label>
                <div className="space-y-2 p-3 bg-[#F7F3EB]/50 rounded-xl border border-[#E3DCCD]">
                  <label className="flex items-center gap-2 text-xs font-bold text-[#282824] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createForm.allowedProperties.includes('all')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setCreateForm(prev => ({ ...prev, allowedProperties: ['all'] }));
                        } else {
                          setCreateForm(prev => ({ ...prev, allowedProperties: [] }));
                        }
                      }}
                      className="accent-[#282824] w-4 h-4"
                    />
                    <span>جميع المجمعات والأبراج (نطاق شامل)</span>
                  </label>

                  {!createForm.allowedProperties.includes('all') && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-[#E3DCCD]/60">
                      {state.properties.map(p => (
                        <label key={p.id} className="flex items-center gap-2 text-[11px] text-[#282824] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={createForm.allowedProperties.includes(p.id)}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setCreateForm(prev => {
                                const list = prev.allowedProperties.filter(id => id !== 'all');
                                return {
                                  ...prev,
                                  allowedProperties: checked ? [...list, p.id] : list.filter(id => id !== p.id)
                                };
                              });
                            }}
                            className="accent-[#282824] w-3.5 h-3.5"
                          />
                          <span>{p.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Password Section */}
              <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" />
                    <span>كلمة المرور الأولية (مؤقتة أو مخصصة) *</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateSecurePass}
                    className="text-[11px] text-amber-800 hover:text-amber-950 font-bold underline cursor-pointer"
                  >
                    توليد كلمة آمنة عشوائياً
                  </button>
                </div>
                <input
                  type="text"
                  required
                  minLength={6}
                  value={createForm.password}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="••••••••"
                  className="w-full p-2 bg-white border border-amber-300 rounded-xl text-xs text-left dir-ltr font-mono font-bold focus:outline-none"
                />
                <label className="flex items-center gap-2 text-[11px] text-amber-900 font-semibold cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={createForm.mustChangePassword}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, mustChangePassword: e.target.checked }))}
                    className="accent-amber-800 w-3.5 h-3.5"
                  />
                  <span>إجبار المستخدم على تعيين كلمة مرور جديدة خاصة به عند أول تسجيل دخول</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E3DCCD]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#68675F] hover:bg-[#F7F3EB] rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#282824] hover:bg-[#1a1a18] text-[#B69A68] font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>تأكيد وإنشاء الحساب</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-[#E3DCCD] shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-[#E3DCCD]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#282824] text-[#B69A68] flex items-center justify-center">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#282824]">تعديل حساب المستخدم (@{editingUser.username})</h3>
                  <span className="text-[11px] text-[#68675F]">تحديث الصلاحيات، نطاق المباني، وتفاصيل الحساب</span>
                </div>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="text-[#68675F] hover:text-[#282824] font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#282824] mb-1">الاسم الكامل *</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full p-2.5 bg-[#F7F3EB]/50 border border-[#E3DCCD] rounded-xl text-xs text-right focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#282824] mb-1">البريد الإلكتروني</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full p-2.5 bg-[#F7F3EB]/50 border border-[#E3DCCD] rounded-xl text-xs text-left dir-ltr focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#282824] mb-1">رقم الجوال</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full p-2.5 bg-[#F7F3EB]/50 border border-[#E3DCCD] rounded-xl text-xs text-left dir-ltr font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#282824] mb-1">الدور والصلاحية *</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm(prev => ({ ...prev, role: e.target.value as UserRole }))}
                  className="w-full p-2.5 bg-white border border-[#E3DCCD] rounded-xl text-xs text-right font-bold focus:outline-none"
                >
                  {Object.entries(ROLE_LABELS).map(([rKey, config]) => (
                    <option key={rKey} value={rKey}>{config.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#282824] mb-1">نطاق المباني المسموح للمستخدم إدارتها</label>
                <div className="space-y-2 p-3 bg-[#F7F3EB]/50 rounded-xl border border-[#E3DCCD]">
                  <label className="flex items-center gap-2 text-xs font-bold text-[#282824] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.allowedProperties.includes('all')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setEditForm(prev => ({ ...prev, allowedProperties: ['all'] }));
                        } else {
                          setEditForm(prev => ({ ...prev, allowedProperties: [] }));
                        }
                      }}
                      className="accent-[#282824] w-4 h-4"
                    />
                    <span>جميع المجمعات والأبراج (نطاق شامل)</span>
                  </label>

                  {!editForm.allowedProperties.includes('all') && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-[#E3DCCD]/60">
                      {state.properties.map(p => (
                        <label key={p.id} className="flex items-center gap-2 text-[11px] text-[#282824] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editForm.allowedProperties.includes(p.id)}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setEditForm(prev => {
                                const list = prev.allowedProperties.filter(id => id !== 'all');
                                return {
                                  ...prev,
                                  allowedProperties: checked ? [...list, p.id] : list.filter(id => id !== p.id)
                                };
                              });
                            }}
                            className="accent-[#282824] w-3.5 h-3.5"
                          />
                          <span>{p.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-[#282824] cursor-pointer p-3 bg-[#F7F3EB] rounded-xl">
                  <input
                    type="checkbox"
                    checked={editForm.isActive}
                    onChange={(e) => setEditForm(prev => ({ ...prev, isActive: e.target.checked }))}
                    className="accent-[#282824] w-4 h-4"
                  />
                  <span>الحساب نشط ويملك إمكانية تسجيل الدخول</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E3DCCD]">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-xs font-semibold text-[#68675F] hover:bg-[#F7F3EB] rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#282824] hover:bg-[#1a1a18] text-[#B69A68] font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>حفظ التعديلات</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {resetPasswordUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-[#E3DCCD] shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#E3DCCD]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#282824]">إعادة تعيين كلمة المرور</h3>
                  <span className="text-[11px] text-[#68675F]">المستخدم: @{resetPasswordUser.username}</span>
                </div>
              </div>
              <button
                onClick={() => {
                  setResetPasswordUser(null);
                  setGeneratedTempPassword(null);
                }}
                className="text-[#68675F] hover:text-[#282824] font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-[#68675F] leading-relaxed">
                سيتم توليد كلمة مرور مؤقتة آمنة لمرة واحدة، وإلغاء كافة الجلسات النشطة للمستخدم.
                <strong className="block text-[#282824] font-bold mt-1">
                  سيُجبر المستخدم على إدخال وتعيين كلمة مرور سرية جديدة خاصة به عند محاولة تسجيل دخوله القادم.
                </strong>
              </p>

              {generatedTempPassword ? (
                <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl space-y-3">
                  <span className="text-xs font-bold text-emerald-900 block">
                    ✓ تم توليد كلمة المرور المؤقتة بنجاح:
                  </span>
                  <div className="flex items-center justify-between gap-2 p-3 bg-white border border-emerald-300 rounded-xl font-mono text-sm font-bold text-[#282824] dir-ltr text-center">
                    <span>{generatedTempPassword}</span>
                    <button
                      onClick={() => copyToClipboard(generatedTempPassword)}
                      className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-sans font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey ? 'تم النسخ' : 'نسخ'}</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-emerald-800">
                    انسخ كلمة المرور وزوّد بها المستخدم. لن تُعرض مرة أخرى لأسباب أمنية.
                  </p>
                </div>
              ) : (
                <button
                  onClick={handleResetPasswordSubmit}
                  className="w-full py-3 bg-[#282824] hover:bg-[#1a1a18] text-[#B69A68] font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>توليد كلمة المرور المؤقتة وإلغاء الجلسات القائمة</span>
                </button>
              )}

              <div className="pt-2 text-left">
                <button
                  onClick={() => {
                    setResetPasswordUser(null);
                    setGeneratedTempPassword(null);
                  }}
                  className="px-4 py-2 bg-[#F7F3EB] hover:bg-[#EFE9DF] text-[#282824] font-bold rounded-xl text-xs cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
