import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { ContentSection, NavigationSettings } from '../../types';
import {
  Save,
  RotateCcw,
  ArrowUp,
  ArrowDown
} from 'lucide-react';

export const ContentCustomizer: React.FC = () => {
  const { state, updateCompanySettings, updateContentSections, resetToFactoryDefaults } = useAppStore();
  const [activeTab, setActiveTab] = useState<'branding' | 'navigation' | 'sections' | 'theme'>('branding');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Navigation Form State
  const [navForm, setNavForm] = useState<NavigationSettings>(() => {
    return state.settings.navigation || {
      enableBottomNav: true,
      headerHeightPx: 80,
      logoMaxHeightPx: 44,
      stickyHeader: true,
      navActiveColor: '#B69A68',
      navLinks: [
        { id: 'nav_home', label: 'الرئيسية', targetSectionId: 'hero', visible: true, order: 1 },
        { id: 'nav_buildings', label: 'المجمعات', targetSectionId: 'buildings', visible: true, order: 2 },
        { id: 'nav_units', label: 'الوحدات الفاخرة', targetSectionId: 'units', visible: true, order: 3 },
        { id: 'nav_amenities', label: 'الخدمات الفندقية', targetSectionId: 'amenities', visible: true, order: 4 },
        { id: 'nav_faq', label: 'الأسئلة الشائعة', targetSectionId: 'faq', visible: true, order: 5 },
        { id: 'nav_contact', label: 'اتصل بنا', targetSectionId: 'contact', visible: true, order: 6 },
      ],
      bottomNavItems: [
        { id: 'bnav_home', label: 'الرئيسية', type: 'section' as const, targetSectionId: 'hero', icon: 'Home', visible: true, order: 1 },
        { id: 'bnav_units', label: 'الوحدات', type: 'section' as const, targetSectionId: 'units', icon: 'Sparkles', visible: true, order: 2 },
        { id: 'bnav_bookings', label: 'حجوزاتي', type: 'my_bookings' as const, icon: 'CalendarDays', visible: true, order: 3 },
        { id: 'bnav_account', label: 'حسابي', type: 'account' as const, icon: 'User', visible: true, order: 4 },
        { id: 'bnav_more', label: 'المزيد', type: 'more' as const, icon: 'Menu', visible: true, order: 5 },
      ]
    };
  });

  // Branding Form State
  const [brandForm, setBrandForm] = useState({
    companyName: state.settings.companyName,
    companyNameEn: state.settings.companyNameEn,
    tagline: state.settings.tagline,
    logoUrl: state.settings.logoUrl || '',
    iconUrl: state.settings.iconUrl || '',
    phone: state.settings.phone,
    whatsapp: state.settings.whatsapp,
    email: state.settings.email,
    taxNumber: state.settings.taxNumber,
    commercialReg: state.settings.commercialReg,
    address: state.settings.address,
    currency: state.settings.currency,
    timezone: state.settings.timezone,
  });

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'logoUrl' | 'iconUrl') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setBrandForm(prev => ({ ...prev, [field]: reader.result as string }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Theme Form State
  const [themeForm, setThemeForm] = useState({ ...state.settings.theme });

  // Sections State
  const [sections, setSections] = useState<ContentSection[]>(() => {
    return [...state.contentSections].sort((a, b) => a.order - b.order);
  });

  const handleSaveBrand = (e: React.FormEvent) => {
    e.preventDefault();
    updateCompanySettings({ ...brandForm, navigation: navForm, theme: themeForm });
    setSuccessMsg('تم حفظ وتعديل إعدادات وهوية الكيان بنجاح.');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleSaveNavigation = (e: React.FormEvent) => {
    e.preventDefault();
    updateCompanySettings({ navigation: navForm });
    setSuccessMsg('تم حفظ وتحديث إعدادات نظام التنقل الهيدر والشريط السفلي بنجاح.');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleSaveSections = () => {
    updateContentSections(sections);
    setSuccessMsg('تم حفظ ترتيب وظهور أقسام الموقع الإلكتروني بنجاح.');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const moveSection = (idx: number, dir: 'up' | 'down') => {
    const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= sections.length) return;
    const copy = [...sections];
    const temp = copy[idx];
    copy[idx] = copy[targetIdx];
    copy[targetIdx] = temp;
    // re-index order
    const updated = copy.map((sec, i) => ({ ...sec, order: i + 1 }));
    setSections(updated);
  };

  const toggleSectionVisibility = (id: string) => {
    setSections(sections.map(s => s.id === id ? { ...s, visible: !s.visible } : s));
  };

  return (
    <div className="space-y-6 text-xs text-right max-w-4xl mx-auto">
      
      {/* Header and Mode Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-white rounded-3xl border border-[#E3DCCD]">
        <div className="flex items-center gap-1.5 p-1 bg-[#F7F3EB] rounded-xl select-none flex-wrap">
          <button
            onClick={() => setActiveTab('branding')}
            className={`px-3.5 py-2 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'branding' ? 'bg-[#282824] text-white shadow-xs' : 'text-[#68675F] hover:text-[#282824]'
            }`}
          >
            الهوية والشعار
          </button>
          <button
            onClick={() => setActiveTab('navigation')}
            className={`px-3.5 py-2 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'navigation' ? 'bg-[#282824] text-white shadow-xs' : 'text-[#68675F] hover:text-[#282824]'
            }`}
          >
            نظام التنقل والشريط السفلي
          </button>
          <button
            onClick={() => setActiveTab('sections')}
            className={`px-3.5 py-2 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'sections' ? 'bg-[#282824] text-white shadow-xs' : 'text-[#68675F] hover:text-[#282824]'
            }`}
          >
            ترتيب أقسام البوابة
          </button>
          <button
            onClick={() => setActiveTab('theme')}
            className={`px-3.5 py-2 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'theme' ? 'bg-[#282824] text-white shadow-xs' : 'text-[#68675F] hover:text-[#282824]'
            }`}
          >
            المظهر والألوان
          </button>
        </div>
        
        <button
          onClick={() => {
            if (confirm('هل أنت متأكد من رغبتك في إعادة ضبط كامل محتويات النظام وهوية منزل الفخامة لقيم المصنع الافتراضية؟')) {
              resetToFactoryDefaults();
              window.location.reload();
            }
          }}
          className="text-xs text-rose-700 hover:bg-rose-50 px-3 py-2 border border-rose-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer select-none"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>إعادة ضبط المصنع بالكامل</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 flex items-center gap-2">
          ✓ <span>{successMsg}</span>
        </div>
      )}

      {/* BRANDING FORM */}
      {activeTab === 'branding' && (
        <form onSubmit={handleSaveBrand} className="bg-white rounded-3xl p-6 border border-[#E3DCCD] space-y-4 shadow-xs">
          <h4 className="font-bold text-sm text-[#282824]">تخصيص هوية وبيانات الكيان الفندقي</h4>
          <p className="text-[#68675F]">البيانات المطبوعة على سندات القبض، الفواتير، المطبوعات الرسمية، وهوية البريد الإلكتروني الموجه للنزلاء:</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-[#68675F] block mb-1">اسم المؤسسة / الشركة (عربي) *</label>
              <input
                type="text"
                required
                value={brandForm.companyName}
                onChange={(e) => setBrandForm(prev => ({ ...prev, companyName: e.target.value }))}
                className="w-full p-2.5 bg-[#F7F3EB]/40 border border-[#E3DCCD] rounded-xl font-bold text-right focus:outline-none focus:border-[#B69A68]"
              />
            </div>
            <div>
              <label className="font-semibold text-[#68675F] block mb-1">اسم المؤسسة (إنجليزي)</label>
              <input
                type="text"
                value={brandForm.companyNameEn}
                onChange={(e) => setBrandForm(prev => ({ ...prev, companyNameEn: e.target.value }))}
                className="w-full p-2.5 bg-[#F7F3EB]/40 border border-[#E3DCCD] rounded-xl text-left focus:outline-none"
              />
            </div>
          </div>

          {/* LOGO & FAVICON UPLOAD SECTION */}
          <div className="p-4 bg-[#F7F3EB]/60 rounded-2xl border border-[#E3DCCD] space-y-3">
            <h5 className="font-bold text-xs text-[#282824] flex items-center gap-2">
              <span>🖼️</span>
              <span>تحميل شعار المنشأة وأيقونة الشعار (Logo & Favicon)</span>
            </h5>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Main Logo Field */}
              <div className="bg-white p-3.5 rounded-xl border border-[#E3DCCD] space-y-2">
                <label className="font-semibold text-[#282824] block text-xs">شعار المنشأة الرئيسي (Full Logo)</label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-14 rounded-lg bg-[#F7F3EB] border border-[#E3DCCD] flex items-center justify-center overflow-hidden shrink-0">
                    {brandForm.logoUrl ? (
                      <img src={brandForm.logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                    ) : (
                      <span className="text-[10px] text-[#68675F] text-center">لا يوجد شعار</span>
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageFileUpload(e, 'logoUrl')}
                      className="block w-full text-xs text-[#68675F] file:mr-0 file:ml-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#282824] file:text-white hover:file:bg-[#1a1a18] cursor-pointer"
                    />
                    <input
                      type="text"
                      placeholder="أو أدخل رابط الشعار المباشر (URL)"
                      value={brandForm.logoUrl}
                      onChange={(e) => setBrandForm(prev => ({ ...prev, logoUrl: e.target.value }))}
                      className="w-full p-1.5 text-[11px] bg-[#F7F3EB]/30 border border-[#E3DCCD] rounded-lg dir-ltr text-left"
                    />
                  </div>
                </div>
              </div>

              {/* Favicon / Icon Field */}
              <div className="bg-white p-3.5 rounded-xl border border-[#E3DCCD] space-y-2">
                <label className="font-semibold text-[#282824] block text-xs">أيقونة الشعار / الفافيكون (Favicon / Icon)</label>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl bg-[#282824] border border-[#E3DCCD] flex items-center justify-center overflow-hidden shrink-0 text-[#B69A68] font-bold text-sm">
                    {brandForm.iconUrl ? (
                      <img src={brandForm.iconUrl} alt="Icon" className="w-full h-full object-cover" />
                    ) : (
                      'LH'
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageFileUpload(e, 'iconUrl')}
                      className="block w-full text-xs text-[#68675F] file:mr-0 file:ml-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#282824] file:text-white hover:file:bg-[#1a1a18] cursor-pointer"
                    />
                    <input
                      type="text"
                      placeholder="أو أدخل رابط الأيقونة المباشر (URL)"
                      value={brandForm.iconUrl}
                      onChange={(e) => setBrandForm(prev => ({ ...prev, iconUrl: e.target.value }))}
                      className="w-full p-1.5 text-[11px] bg-[#F7F3EB]/30 border border-[#E3DCCD] rounded-lg dir-ltr text-left"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="font-semibold text-[#68675F] block mb-1">الشعار والعبارة الترويجية السكنية (Slogan)</label>
            <input
              type="text"
              value={brandForm.tagline}
              onChange={(e) => setBrandForm(prev => ({ ...prev, tagline: e.target.value }))}
              className="w-full p-2.5 bg-[#F7F3EB]/40 border border-[#E3DCCD] rounded-xl text-right focus:outline-none focus:border-[#B69A68]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-semibold text-[#68675F] block mb-1">هاتف الاستقبال الفندقي</label>
              <input
                type="text"
                value={brandForm.phone}
                onChange={(e) => setBrandForm(prev => ({ ...prev, phone: e.target.value }))}
                className="w-full p-2 bg-[#F7F3EB]/40 border border-[#E3DCCD] rounded-xl text-left font-mono focus:outline-none"
                dir="ltr"
              />
            </div>
            <div>
              <label className="font-semibold text-[#68675F] block mb-1">رقم الواتساب النشط</label>
              <input
                type="text"
                value={brandForm.whatsapp}
                onChange={(e) => setBrandForm(prev => ({ ...prev, whatsapp: e.target.value }))}
                className="w-full p-2 bg-[#F7F3EB]/40 border border-[#E3DCCD] rounded-xl text-left font-mono focus:outline-none"
                dir="ltr"
              />
            </div>
            <div>
              <label className="font-semibold text-[#68675F] block mb-1">بريد الاستفسارات الإلكتروني</label>
              <input
                type="email"
                value={brandForm.email}
                onChange={(e) => setBrandForm(prev => ({ ...prev, email: e.target.value }))}
                className="w-full p-2 bg-[#F7F3EB]/40 border border-[#E3DCCD] rounded-xl text-left focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-[#68675F] block mb-1">الرقم الضريبي المعتمد (VAT)</label>
              <input
                type="text"
                value={brandForm.taxNumber}
                onChange={(e) => setBrandForm(prev => ({ ...prev, taxNumber: e.target.value }))}
                className="w-full p-2 bg-[#F7F3EB]/40 border border-[#E3DCCD] rounded-xl tabular-nums text-right focus:outline-none"
              />
            </div>
            <div>
              <label className="font-semibold text-[#68675F] block mb-1">رقم السجل التجاري الرسمي للمنشأة</label>
              <input
                type="text"
                value={brandForm.commercialReg}
                onChange={(e) => setBrandForm(prev => ({ ...prev, commercialReg: e.target.value }))}
                className="w-full p-2 bg-[#F7F3EB]/40 border border-[#E3DCCD] rounded-xl tabular-nums text-right focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-[#68675F] block mb-1">العنوان والموقع الإداري الرئيسي للشركة</label>
            <input
              type="text"
              value={brandForm.address}
              onChange={(e) => setBrandForm(prev => ({ ...prev, address: e.target.value }))}
              className="w-full p-2 bg-[#F7F3EB]/40 border border-[#E3DCCD] rounded-xl text-right focus:outline-none focus:border-[#B69A68]"
            />
          </div>

          <div className="flex justify-end pt-3">
            <button
              type="submit"
              className="px-6 py-2.5 bg-[#282824] hover:bg-[#1a1a18] text-white font-bold rounded-xl flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Save className="w-4 h-4 text-[#B69A68]" />
              <span>حفظ بيانات وتعديلات الهوية الرسمية</span>
            </button>
          </div>
        </form>
      )}

      {/* NAVIGATION CUSTOMIZER FORM */}
      {activeTab === 'navigation' && (
        <form onSubmit={handleSaveNavigation} className="bg-white rounded-3xl p-6 border border-[#E3DCCD] space-y-6 shadow-xs text-right">
          <div className="flex items-center justify-between pb-3 border-b border-[#E3DCCD]">
            <div>
              <h4 className="font-bold text-sm text-[#282824]">تخصيص نظام التنقل وقوائم الموبايل والكمبيوتر</h4>
              <p className="text-[#68675F] mt-0.5">التحكم الكامل في روابط الهيدر الرئيسي وتفضيلات شريط التنقل السفلي للهواتف الذكية</p>
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 bg-[#282824] hover:bg-[#1a1a18] text-white font-bold rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Save className="w-4 h-4 text-[#B69A68]" />
              <span>حفظ إعدادات التنقل</span>
            </button>
          </div>

          {/* Header Layout & Dimensions */}
          <div className="p-4 bg-[#F7F3EB]/60 rounded-2xl border border-[#E3DCCD] space-y-3">
            <h5 className="font-bold text-xs text-[#282824]">📐 أبعاد الهيدر والشعار علوياً</h5>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-semibold text-[#68675F] block mb-1">ارتفاع الهيدر (بكسل)</label>
                <input
                  type="number"
                  value={navForm.headerHeightPx}
                  onChange={(e) => setNavForm(prev => ({ ...prev, headerHeightPx: Number(e.target.value) || 80 }))}
                  className="w-full p-2 bg-white border border-[#E3DCCD] rounded-xl text-center font-bold focus:outline-none"
                />
              </div>
              <div>
                <label className="font-semibold text-[#68675F] block mb-1">الارتفاع الأقصى للشعار (بكسل)</label>
                <input
                  type="number"
                  value={navForm.logoMaxHeightPx}
                  onChange={(e) => setNavForm(prev => ({ ...prev, logoMaxHeightPx: Number(e.target.value) || 44 }))}
                  className="w-full p-2 bg-white border border-[#E3DCCD] rounded-xl text-center font-bold focus:outline-none"
                />
              </div>
              <div className="flex items-center justify-between sm:justify-start gap-3 pt-6">
                <label className="font-semibold text-[#282824] cursor-pointer">تثبيت الهيدر أعلى الشاشة (Sticky)</label>
                <input
                  type="checkbox"
                  checked={navForm.stickyHeader}
                  onChange={(e) => setNavForm(prev => ({ ...prev, stickyHeader: e.target.checked }))}
                  className="w-4 h-4 accent-[#282824] cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Header Nav Links Reorder & Edit */}
          <div className="space-y-3">
            <h5 className="font-bold text-xs text-[#282824]">🔗 روابط قائمة الكمبيوتر (الرئيسية)</h5>
            <div className="divide-y divide-[#E3DCCD] border border-[#E3DCCD] rounded-2xl overflow-hidden bg-white">
              {navForm.navLinks.map((link, idx) => (
                <div key={link.id} className="p-3 flex items-center justify-between gap-3 bg-white hover:bg-stone-50 transition-colors">
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="text"
                      value={link.label}
                      onChange={(e) => {
                        const updated = navForm.navLinks.map((l, i) => i === idx ? { ...l, label: e.target.value } : l);
                        setNavForm(prev => ({ ...prev, navLinks: updated }));
                      }}
                      className="p-1.5 text-xs font-bold border border-[#E3DCCD] rounded-lg w-36 text-right"
                    />
                    <select
                      value={link.targetSectionId}
                      onChange={(e) => {
                        const updated = navForm.navLinks.map((l, i) => i === idx ? { ...l, targetSectionId: e.target.value } : l);
                        setNavForm(prev => ({ ...prev, navLinks: updated }));
                      }}
                      className="p-1.5 text-[11px] border border-[#E3DCCD] rounded-lg text-right bg-[#F7F3EB]/50"
                    >
                      <option value="hero">الرئيسية (hero)</option>
                      <option value="buildings">المجمعات السكنية (buildings)</option>
                      <option value="units">الوحدات والأجنحة (units)</option>
                      <option value="amenities">الخدمات الفندقية (amenities)</option>
                      <option value="faq">الأسئلة الشائعة (faq)</option>
                      <option value="contact">اتصل بنا (contact)</option>
                      <option value="search_bar">محرك البحث والحجز (search_bar)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2 select-none">
                    <button
                      type="button"
                      onClick={() => {
                        if (idx === 0) return;
                        const copy = [...navForm.navLinks];
                        const temp = copy[idx];
                        copy[idx] = copy[idx - 1];
                        copy[idx - 1] = temp;
                        setNavForm(prev => ({ ...prev, navLinks: copy.map((l, i) => ({ ...l, order: i + 1 })) }));
                      }}
                      disabled={idx === 0}
                      className="p-1 text-[#68675F] hover:text-[#282824] disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (idx === navForm.navLinks.length - 1) return;
                        const copy = [...navForm.navLinks];
                        const temp = copy[idx];
                        copy[idx] = copy[idx + 1];
                        copy[idx + 1] = temp;
                        setNavForm(prev => ({ ...prev, navLinks: copy.map((l, i) => ({ ...l, order: i + 1 })) }));
                      }}
                      disabled={idx === navForm.navLinks.length - 1}
                      className="p-1 text-[#68675F] hover:text-[#282824] disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[#68675F] cursor-pointer mr-2">
                      <input
                        type="checkbox"
                        checked={link.visible}
                        onChange={(e) => {
                          const updated = navForm.navLinks.map((l, i) => i === idx ? { ...l, visible: e.target.checked } : l);
                          setNavForm(prev => ({ ...prev, navLinks: updated }));
                        }}
                        className="w-3.5 h-3.5 accent-[#282824]"
                      />
                      <span>تفعيل الظهور</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mobile Bottom Navigation Settings */}
          <div className="p-4 bg-[#F7F3EB]/60 rounded-2xl border border-[#E3DCCD] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h5 className="font-bold text-xs text-[#282824]">📱 شريط التنقل السفلي الثابت للهواتف الذكية</h5>
                <p className="text-[11px] text-[#68675F]">التحكم في العناصر الخمسة المعروضة في شريط الموبايل السفلي</p>
              </div>
              <label className="flex items-center gap-2 text-xs font-bold text-[#282824] cursor-pointer">
                <input
                  type="checkbox"
                  checked={navForm.enableBottomNav}
                  onChange={(e) => setNavForm(prev => ({ ...prev, enableBottomNav: e.target.checked }))}
                  className="w-4 h-4 accent-[#282824]"
                />
                <span>تفعيل شريط الموبايل السفلي</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {navForm.bottomNavItems.map((bitem, bidx) => (
                <div key={bitem.id} className="p-3 bg-white rounded-xl border border-[#E3DCCD] space-y-2">
                  <div className="flex items-center justify-between border-b border-[#E3DCCD]/60 pb-1.5">
                    <span className="font-bold text-xs text-[#282824]">عنصر رقم #{bidx + 1}</span>
                    <label className="flex items-center gap-1 text-[11px] text-[#68675F] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={bitem.visible}
                        onChange={(e) => {
                          const updated = navForm.bottomNavItems.map((b, i) => i === bidx ? { ...b, visible: e.target.checked } : b);
                          setNavForm(prev => ({ ...prev, bottomNavItems: updated }));
                        }}
                        className="w-3.5 h-3.5 accent-[#282824]"
                      />
                      <span>نشط</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-[#68675F] block mb-0.5">العنوان العربي</label>
                      <input
                        type="text"
                        value={bitem.label}
                        onChange={(e) => {
                          const updated = navForm.bottomNavItems.map((b, i) => i === bidx ? { ...b, label: e.target.value } : b);
                          setNavForm(prev => ({ ...prev, bottomNavItems: updated }));
                        }}
                        className="w-full p-1.5 text-xs font-bold border border-[#E3DCCD] rounded-lg text-right"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-[#68675F] block mb-0.5">نوع الإجراء</label>
                      <select
                        value={bitem.type}
                        onChange={(e) => {
                          const updated = navForm.bottomNavItems.map((b, i) => i === bidx ? { ...b, type: e.target.value as any } : b);
                          setNavForm(prev => ({ ...prev, bottomNavItems: updated }));
                        }}
                        className="w-full p-1.5 text-[11px] border border-[#E3DCCD] rounded-lg text-right bg-[#F7F3EB]/40"
                      >
                        <option value="section">انتقال لقسم في الصفحة</option>
                        <option value="my_bookings">حجوزاتي وبوابة النزلاء</option>
                        <option value="account">حسابي والخدمات</option>
                        <option value="more">المزيد (فتح القائمة)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-[#68675F] block mb-0.5">الأيقونة</label>
                      <select
                        value={bitem.icon}
                        onChange={(e) => {
                          const updated = navForm.bottomNavItems.map((b, i) => i === bidx ? { ...b, icon: e.target.value } : b);
                          setNavForm(prev => ({ ...prev, bottomNavItems: updated }));
                        }}
                        className="w-full p-1.5 text-[11px] border border-[#E3DCCD] rounded-lg text-right bg-white"
                      >
                        <option value="Home">الرئيسية (Home)</option>
                        <option value="Building2">المجمعات (Building2)</option>
                        <option value="Sparkles">الوحدات الفاخرة (Sparkles)</option>
                        <option value="CalendarDays">حجوزاتي (CalendarDays)</option>
                        <option value="User">حسابي (User)</option>
                        <option value="Menu">المزيد (Menu)</option>
                        <option value="Phone">اتصل بنا (Phone)</option>
                      </select>
                    </div>

                    {bitem.type === 'section' && (
                      <div>
                        <label className="text-[10px] text-[#68675F] block mb-0.5">القسم المستهدف</label>
                        <select
                          value={bitem.targetSectionId || 'hero'}
                          onChange={(e) => {
                            const updated = navForm.bottomNavItems.map((b, i) => i === bidx ? { ...b, targetSectionId: e.target.value } : b);
                            setNavForm(prev => ({ ...prev, bottomNavItems: updated }));
                          }}
                          className="w-full p-1.5 text-[11px] border border-[#E3DCCD] rounded-lg text-right bg-white"
                        >
                          <option value="hero">الرئيسية</option>
                          <option value="buildings">المجمعات</option>
                          <option value="units">الوحدات</option>
                          <option value="amenities">الخدمات</option>
                          <option value="faq">الأسئلة الشائعة</option>
                          <option value="contact">اتصل بنا</option>
                        </select>
                      </div>
                    )}
                  </div>

                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-6 py-2.5 bg-[#282824] hover:bg-[#1a1a18] text-white font-bold rounded-xl flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Save className="w-4 h-4 text-[#B69A68]" />
              <span>حفظ إعدادات الهيدر والتنقل وشريط الموبايل</span>
            </button>
          </div>
        </form>
      )}

      {/* SECTIONS RE-ORDER & VISIBILITY */}
      {activeTab === 'sections' && (
        <div className="bg-white rounded-3xl p-6 border border-[#E3DCCD] space-y-4 shadow-xs text-right">
          <div className="flex items-center justify-between pb-3 border-b border-[#E3DCCD]/50 select-none">
            <div>
              <h4 className="font-bold text-sm text-[#282824]">ترتيب وتفعيل ظهور أقسام البوابة الرئيسية</h4>
              <p className="text-[#68675F] mt-0.5">يمكنك تغيير هيكل عرض وترتيب الأقسام في الصفحة الهبوطية العامة لزوار موقع منزل الفخامة.</p>
            </div>
            <button
              onClick={handleSaveSections}
              className="px-5 py-2 bg-[#282824] hover:bg-[#1a1a18] text-white font-bold rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Save className="w-4 h-4 text-[#B69A68]" />
              <span>حفظ ترتيب الأقسام الحالي</span>
            </button>
          </div>

          <div className="divide-y divide-[#E3DCCD]">
            {sections.map((sec, idx) => (
              <div key={sec.id} className="py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#F7F3EB] text-[#282824] flex items-center justify-center font-bold text-xs tabular-nums select-none">
                    {idx + 1}
                  </span>
                  <div>
                    <strong className="block text-sm text-[#282824]">{sec.name}</strong>
                    <span className="text-[11px] text-[#68675F] block mt-0.5">{sec.title}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer select-none font-semibold">
                    <input
                      type="checkbox"
                      checked={sec.visible}
                      onChange={() => toggleSectionVisibility(sec.id)}
                      className="accent-[#B69A68] w-4 h-4 cursor-pointer"
                    />
                    <span>{sec.visible ? 'معروض للكل' : 'مخفي حالياً'}</span>
                  </label>
                  
                  <div className="flex items-center gap-1 select-none">
                    <button
                      disabled={idx === 0}
                      onClick={() => moveSection(idx, 'up')}
                      className="p-1.5 border border-[#E3DCCD] hover:bg-[#F7F3EB] disabled:opacity-30 rounded-lg cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5 text-[#68675F]" />
                    </button>
                    <button
                      disabled={idx === sections.length - 1}
                      onClick={() => moveSection(idx, 'down')}
                      className="p-1.5 border border-[#E3DCCD] hover:bg-[#F7F3EB] disabled:opacity-30 rounded-lg cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5 text-[#68675F]" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* THEME & GLASSMORPHISM */}
      {activeTab === 'theme' && (
        <div className="bg-white rounded-3xl p-6 border border-[#E3DCCD] space-y-4 shadow-xs text-right">
          <h4 className="font-bold text-sm text-[#282824]">تخصيص الهوية البصرية والألوان السكنية المترفة</h4>
          <p className="text-[#68675F]">التحكم الحصري بلون السطح، اللون المميز للكونسيرج، والتناغم البصري لعلامة منزل الفخامة الفاخرة:</p>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <label className="font-semibold text-[#68675F] block mb-1">اللون المميز الفاخر (Accent Color)</label>
              <div className="flex items-center gap-2 justify-start mt-1">
                <input
                  type="color"
                  value={themeForm.primaryColor}
                  onChange={(e) => setThemeForm(prev => ({ ...prev, primaryColor: e.target.value }))}
                  className="w-10 h-10 rounded-lg border border-[#E3DCCD] cursor-pointer"
                />
                <span className="font-mono text-sm uppercase">{themeForm.primaryColor}</span>
              </div>
            </div>
            <div>
              <label className="font-semibold text-[#68675F] block mb-1">لون خلفية الكانفاس (Background Field)</label>
              <div className="flex items-center gap-2 justify-start mt-1">
                <input
                  type="color"
                  value={themeForm.ivoryBg}
                  onChange={(e) => setThemeForm(prev => ({ ...prev, ivoryBg: e.target.value }))}
                  className="w-10 h-10 rounded-lg border border-[#E3DCCD] cursor-pointer"
                />
                <span className="font-mono text-sm uppercase">{themeForm.ivoryBg}</span>
              </div>
            </div>
            <div>
              <label className="font-semibold text-[#68675F] block mb-1">لون خلفية أسطح الكروت والبطاقات</label>
              <div className="flex items-center gap-2 justify-start mt-1">
                <input
                  type="color"
                  value={themeForm.ivorySurface}
                  onChange={(e) => setThemeForm(prev => ({ ...prev, ivorySurface: e.target.value }))}
                  className="w-10 h-10 rounded-lg border border-[#E3DCCD] cursor-pointer"
                />
                <span className="font-mono text-sm uppercase">{themeForm.ivorySurface}</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[#E3DCCD]/60">
            <button
              onClick={() => {
                updateCompanySettings({ theme: themeForm });
                setSuccessMsg('تم حفظ وتحديث المظهر البصري لعلامة منزل الفخامة الفندقية بنجاح.');
                setTimeout(() => setSuccessMsg(null), 3000);
              }}
              className="px-6 py-2.5 bg-[#282824] hover:bg-[#1a1a18] text-white font-bold rounded-xl flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Save className="w-4 h-4 text-[#B69A68]" />
              <span>تفعيل وحفظ خيارات المظهر الجديد</span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
