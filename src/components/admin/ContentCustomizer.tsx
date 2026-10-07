import React, { useState } from 'react';
import { HeroCarouselCustomizer } from './HeroCarouselCustomizer';
import { useAppStore } from '../../store/useAppStore';
import {
  ContentSection,
  NavigationSettings,
  CustomizableTypographyConfig,
  SectionTextElementConfig,
  TextStyleConfig,
  TextAlignment,
  FontWeight
} from '../../types';
import { initialCustomTypography } from '../../data/initialData';
import { SaudiRiyalSymbol, formatNumber, setGlobalCurrencyDisplayMode } from '../../utils/formatters';
import { applyCssThemeVariables } from '../../utils/themeManager';
import {
  Save,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  Type,
  Eye,
  Smartphone,
  Monitor,
  Palette,
  Sparkles,
  Check,
  AlignRight,
  AlignCenter,
  AlignLeft,
  Building2,
  DollarSign,
  HelpCircle,
  Phone
} from 'lucide-react';

const FONT_SIZES = [
  { label: 'صغير جداً (12px / 0.75rem)', value: 0.75 },
  { label: 'صغير (14px / 0.875rem)', value: 0.875 },
  { label: 'متوسط قياسي (16px / 1rem)', value: 1.0 },
  { label: 'متوسط كبير (18px / 1.125rem)', value: 1.125 },
  { label: 'كبير (20px / 1.25rem)', value: 1.25 },
  { label: 'كبير جداً (24px / 1.5rem)', value: 1.5 },
  { label: 'عنوان فرعي (30px / 1.875rem)', value: 1.875 },
  { label: 'عنوان رئيسي (36px / 2.25rem)', value: 2.25 },
  { label: 'عنوان ضخم (48px / 3.0rem)', value: 3.0 },
  { label: 'عنوان فندقي فخم (56px / 3.5rem)', value: 3.5 },
];

const FONT_WEIGHTS: { label: string; value: FontWeight }[] = [
  { label: 'عادي (Regular 400)', value: 'normal' },
  { label: 'متوسط (Medium 500)', value: 'medium' },
  { label: 'شبه عريض (Semibold 600)', value: 'semibold' },
  { label: 'عريض (Bold 700)', value: 'bold' },
  { label: 'عريض جداً (Extrabold 800)', value: 'extrabold' },
];

const SECTION_OPTIONS = [
  { key: 'hero', label: 'القسم الترحيبي الرئيسي (Hero Section)', icon: Sparkles },
  { key: 'search_bar', label: 'محرك البحث والحجز السريع (Search Bar)', icon: Building2 },
  { key: 'buildings', label: 'قسم المجمعات والأبراج (Buildings Carousel)', icon: Building2 },
  { key: 'units', label: 'قسم الوحدات الفاخرة (Featured Units)', icon: Sparkles },
  { key: 'amenities', label: 'قسم الخدمات الفندقية (Hotel Amenities)', icon: Sparkles },
  { key: 'faq', label: 'قسم الأسئلة الشائعة (FAQ Section)', icon: HelpCircle },
  { key: 'contact', label: 'قسم التواصل والكونسيرج (Contact & Concierge)', icon: Phone },
];

interface ContentCustomizerProps {
  initialTab?: 'branding' | 'typography' | 'navigation' | 'sections' | 'theme' | 'hero';
}

export const ContentCustomizer: React.FC<ContentCustomizerProps> = ({ initialTab = 'theme' }) => {
  const { state, updateCompanySettings, updateContentSections, resetToFactoryDefaults } = useAppStore();
  const [activeTab, setActiveTab] = useState<'branding' | 'typography' | 'navigation' | 'sections' | 'theme' | 'hero'>(initialTab);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Selected Section for Typography Customization
  const [selectedTypoSection, setSelectedTypoSection] = useState<string>('hero');
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'mobile'>('desktop');

  // Typography Form State
  const [typoForm, setTypoForm] = useState<CustomizableTypographyConfig>(() => {
    return state.settings.typography || initialCustomTypography;
  });

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
    currency: state.settings.currency || 'SAR',
    currencySymbol: state.settings.currencySymbol || 'ر.س',
    currencyDisplayMode: state.settings.currencyDisplayMode || 'symbol',
    timezone: state.settings.timezone || 'Asia/Riyadh',
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
  const [themeForm, setThemeForm] = useState({
    headerBg: state.settings.theme?.headerBg || '#FFFCF6',
    footerBg: state.settings.theme?.footerBg || '#282824',
    primaryBtnBg: state.settings.theme?.primaryBtnBg || '#B69A68',
    pageBg: state.settings.theme?.pageBg || '#FAF8F5',
    ...state.settings.theme,
  });

  const handleResetThemeColors = () => {
    const defaultTheme = {
      headerBg: '#FFFCF6',
      footerBg: '#282824',
      primaryBtnBg: '#B69A68',
      pageBg: '#FAF8F5',
      primaryColor: '#B69A68',
      ivoryBg: '#F7F3EB',
      ivorySurface: '#FFFCF6',
      textColor: '#282824',
      textMuted: '#68675F',
      borderColor: '#E3DCCD',
      glassBlurIntensity: 14,
      borderRadius: 'xl' as const,
      enableAnimations: true,
    };
    setThemeForm(defaultTheme);
    updateCompanySettings({ theme: defaultTheme });
    setSuccessMsg('تم استعادة الألوان الافتراضية بنجاح.');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Sections State
  const [sections, setSections] = useState<ContentSection[]>(() => {
    return [...state.contentSections].sort((a, b) => a.order - b.order);
  });

  // Save Typography
  const handleSaveTypography = () => {
    updateCompanySettings({ typography: typoForm });
    setSuccessMsg('تم حفظ وتحديث نصوص وتنسيقات الموقع في قاعدة البيانات بنجاح.');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Reset Typography Element
  const handleResetElement = (secKey: string, elKey: string) => {
    const defSec = initialCustomTypography[secKey];
    if (defSec && defSec[elKey]) {
      setTypoForm(prev => ({
        ...prev,
        [secKey]: {
          ...prev[secKey],
          [elKey]: { ...defSec[elKey] }
        }
      }));
    }
  };

  // Reset Entire Section Typography
  const handleResetSection = (secKey: string) => {
    const defSec = initialCustomTypography[secKey];
    if (defSec) {
      setTypoForm(prev => ({
        ...prev,
        [secKey]: JSON.parse(JSON.stringify(defSec))
      }));
      setSuccessMsg(`تم استعادة القيم الافتراضية لقسم (${secKey}) بنجاح.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  // Reset All Typography
  const handleResetAllTypography = () => {
    if (confirm('هل أنت متأكد من رغبتك في استعادة النصوص والتنسيقات الافتراضية لكافة أقسام الموقع؟')) {
      const cloned = JSON.parse(JSON.stringify(initialCustomTypography));
      setTypoForm(cloned);
      updateCompanySettings({ typography: cloned });
      setSuccessMsg('تمت استعادة كافة النصوص والتنسيقات الافتراضية وحفظها بنجاح.');
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  const handleSaveBrand = (e: React.FormEvent) => {
    e.preventDefault();
    const displayMode = (brandForm.currencyDisplayMode === 'code' ? 'code' : 'symbol') as 'symbol' | 'code';
    setGlobalCurrencyDisplayMode(displayMode);
    updateCompanySettings({
      ...brandForm,
      currencyDisplayMode: displayMode,
      currencySymbol: displayMode === 'code' ? 'SAR' : 'ر.س',
      navigation: navForm,
      theme: themeForm,
    });
    setSuccessMsg('تم حفظ وتعديل إعدادات وهوية الكيان وعرض العملة بنجاح.');
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
    const updated = copy.map((sec, i) => ({ ...sec, order: i + 1 }));
    setSections(updated);
  };

  const toggleSectionVisibility = (id: string) => {
    setSections(sections.map(s => s.id === id ? { ...s, visible: !s.visible } : s));
  };

  const currentSectionElements = typoForm[selectedTypoSection] || initialCustomTypography[selectedTypoSection] || {};

  return (
    <div className="space-y-6 text-xs text-right max-w-5xl mx-auto">
      
      {/* Header and Mode Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-white rounded-3xl border border-[#E3DCCD]">
        <div className="flex items-center gap-1.5 p-1 bg-[#F7F3EB] rounded-xl select-none flex-wrap">
          <button
            onClick={() => setActiveTab('hero')}
            className={`px-3.5 py-2 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${activeTab === 'hero' ? 'bg-[#282824] text-white shadow-xs' : 'text-[#68675F] hover:text-[#282824]'}`}
          >
            <Sparkles className="h-4 w-4 text-[#B69A68]" />الهيرو المتحرك
          </button>
          <button
            onClick={() => setActiveTab('typography')}
            className={`px-3.5 py-2 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'typography' ? 'bg-[#282824] text-white shadow-xs' : 'text-[#68675F] hover:text-[#282824]'
            }`}
          >
            <Type className="w-4 h-4 text-[#B69A68]" />
            <span>تخصيص النصوص والتنسيق</span>
          </button>
          <button
            onClick={() => setActiveTab('branding')}
            className={`px-3.5 py-2 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'branding' ? 'bg-[#282824] text-white shadow-xs' : 'text-[#68675F] hover:text-[#282824]'
            }`}
          >
            الهوية والعملة
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
          <Check className="w-4 h-4 text-emerald-600" />
          <span className="font-semibold">{successMsg}</span>
        </div>
      )}

      {activeTab === 'hero' && <HeroCarouselCustomizer />}

      {/* TYPOGRAPHY & TEXT CUSTOMIZATION TAB */}
      {activeTab === 'typography' && (
        <div className="space-y-6">
          
          {/* Controls Header */}
          <div className="bg-white rounded-3xl p-6 border border-[#E3DCCD] shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E3DCCD]">
              <div>
                <h4 className="font-bold text-sm text-[#282824]">تخصيص نصوص وتنسيقات واجهة الموقع العام</h4>
                <p className="text-[#68675F] mt-0.5">
                  تحرير العناوين، الأوصاف، الأزرار، الإحصائيات والشارات، مع التحكم في الحجم واللون والوزن والمحاذاة ومعاينة فورية قبل الحفظ.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleResetAllTypography}
                  className="px-3 py-2 bg-[#F7F3EB] hover:bg-[#EFE9DF] text-[#68675F] hover:text-[#282824] rounded-xl font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="استعادة كافة النصوص الافتراضية"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>استعادة الكل الافتراضي</span>
                </button>

                <button
                  onClick={handleSaveTypography}
                  className="px-5 py-2 bg-[#282824] hover:bg-[#1a1a18] text-[#B69A68] font-bold rounded-xl flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>حفظ التعديلات في الخادم</span>
                </button>
              </div>
            </div>

            {/* Section Selector Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-horizontal-scrollbar">
              {SECTION_OPTIONS.map((sec) => {
                const IconComponent = sec.icon;
                const isSelected = selectedTypoSection === sec.key;
                return (
                  <button
                    key={sec.key}
                    onClick={() => setSelectedTypoSection(sec.key)}
                    className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#282824] text-[#B69A68] shadow-xs'
                        : 'bg-[#F7F3EB] text-[#68675F] hover:bg-[#EFE9DF] hover:text-[#282824]'
                    }`}
                  >
                    <IconComponent className="w-3.5 h-3.5" />
                    <span>{sec.label.split('(')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Editor & Live Preview Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left/Main Column: Text Elements Editor */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between">
                <h5 className="font-bold text-xs text-[#282824] flex items-center gap-1.5">
                  <span>✏️</span>
                  <span>عناصر ومكونات قسم: {SECTION_OPTIONS.find(s => s.key === selectedTypoSection)?.label}</span>
                </h5>
                <button
                  onClick={() => handleResetSection(selectedTypoSection)}
                  className="text-[11px] text-[#B69A68] hover:text-[#8f7547] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>استعادة افتراضيات هذا القسم</span>
                </button>
              </div>

              <div className="space-y-4">
                {Object.entries(currentSectionElements).map(([elKey, elConfig]) => {
                  const element: SectionTextElementConfig = elConfig;

                  const updateElement = (updates: Partial<SectionTextElementConfig>) => {
                    setTypoForm(prev => ({
                      ...prev,
                      [selectedTypoSection]: {
                        ...prev[selectedTypoSection],
                        [elKey]: {
                          ...element,
                          ...updates,
                          style: {
                            ...element.style,
                            ...(updates.style || {})
                          }
                        }
                      }
                    }));
                  };

                  return (
                    <div key={elKey} className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E3DCCD] shadow-xs space-y-3">
                      <div className="flex items-center justify-between border-b border-[#E3DCCD]/60 pb-2">
                        <label className="font-bold text-xs text-[#282824] flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#B69A68]"></span>
                          <span>{element.label}</span>
                        </label>

                        <button
                          type="button"
                          onClick={() => handleResetElement(selectedTypoSection, elKey)}
                          className="text-[10px] text-[#68675F] hover:text-[#282824] flex items-center gap-1 font-semibold cursor-pointer"
                          title="استعادة النص والتنسيق الافتراضي لهذا الحقل"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>استعادة الافتراضي</span>
                        </button>
                      </div>

                      {/* Text Input */}
                      <div>
                        {element.style.fontSizeRem && element.style.fontSizeRem > 1.5 ? (
                          <textarea
                            rows={2}
                            value={element.text}
                            onChange={(e) => updateElement({ text: e.target.value })}
                            className="w-full p-2.5 bg-[#F7F3EB]/40 border border-[#E3DCCD] rounded-xl text-xs text-right font-bold focus:outline-none focus:border-[#B69A68]"
                          />
                        ) : (
                          <input
                            type="text"
                            value={element.text}
                            onChange={(e) => updateElement({ text: e.target.value })}
                            className="w-full p-2.5 bg-[#F7F3EB]/40 border border-[#E3DCCD] rounded-xl text-xs text-right font-medium focus:outline-none focus:border-[#B69A68]"
                          />
                        )}
                        <span className="text-[10px] text-[#68675F] block mt-1">
                          القيمة الافتراضية: "{element.defaultText}"
                        </span>
                      </div>

                      {/* Typography & Style Toolbar */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[#E3DCCD]/40">
                        {/* Color Picker */}
                        <div>
                          <label className="text-[10px] font-semibold text-[#68675F] block mb-1">اللون</label>
                          <div className="flex items-center gap-1.5 bg-[#F7F3EB]/60 p-1 rounded-lg border border-[#E3DCCD]">
                            <input
                              type="color"
                              value={element.style.color || '#282824'}
                              onChange={(e) => updateElement({ style: { ...element.style, color: e.target.value } })}
                              className="w-6 h-6 rounded border border-[#E3DCCD] cursor-pointer"
                            />
                            <span className="text-[10px] font-mono uppercase">{element.style.color || '#282824'}</span>
                          </div>
                        </div>

                        {/* Font Size */}
                        <div>
                          <label className="text-[10px] font-semibold text-[#68675F] block mb-1">حجم الخط</label>
                          <select
                            value={element.style.fontSizeRem || 1.0}
                            onChange={(e) => updateElement({ style: { ...element.style, fontSizeRem: parseFloat(e.target.value) } })}
                            className="w-full p-1.5 bg-white border border-[#E3DCCD] rounded-lg text-[11px] font-bold text-right focus:outline-none"
                          >
                            {FONT_SIZES.map(f => (
                              <option key={f.value} value={f.value}>{f.label}</option>
                            ))}
                          </select>
                        </div>

                        {/* Font Weight */}
                        <div>
                          <label className="text-[10px] font-semibold text-[#68675F] block mb-1">وزن الخط</label>
                          <select
                            value={element.style.fontWeight || 'normal'}
                            onChange={(e) => updateElement({ style: { ...element.style, fontWeight: e.target.value as FontWeight } })}
                            className="w-full p-1.5 bg-white border border-[#E3DCCD] rounded-lg text-[11px] font-bold text-right focus:outline-none"
                          >
                            {FONT_WEIGHTS.map(w => (
                              <option key={w.value} value={w.value}>{w.label}</option>
                            ))}
                          </select>
                        </div>

                        {/* Alignment */}
                        <div>
                          <label className="text-[10px] font-semibold text-[#68675F] block mb-1">المحاذاة</label>
                          <div className="flex items-center gap-1 bg-[#F7F3EB]/60 p-1 rounded-lg border border-[#E3DCCD] justify-center">
                            <button
                              type="button"
                              onClick={() => updateElement({ style: { ...element.style, alignment: 'right' } })}
                              className={`p-1 rounded cursor-pointer ${
                                (element.style.alignment || 'right') === 'right' ? 'bg-[#282824] text-white' : 'text-[#68675F]'
                              }`}
                              title="محاذاة لليمين"
                            >
                              <AlignRight className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => updateElement({ style: { ...element.style, alignment: 'center' } })}
                              className={`p-1 rounded cursor-pointer ${
                                element.style.alignment === 'center' ? 'bg-[#282824] text-white' : 'text-[#68675F]'
                              }`}
                              title="محاذاة للوسط"
                            >
                              <AlignCenter className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => updateElement({ style: { ...element.style, alignment: 'left' } })}
                              className={`p-1 rounded cursor-pointer ${
                                element.style.alignment === 'left' ? 'bg-[#282824] text-white' : 'text-[#68675F]'
                              }`}
                              title="محاذاة لليسار"
                            >
                              <AlignLeft className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Live Interactive Responsive Preview */}
            <div className="lg:col-span-5 sticky top-24 space-y-3">
              <div className="flex items-center justify-between">
                <h5 className="font-bold text-xs text-[#282824] flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-[#B69A68]" />
                  <span>معاينة حية للمكونات المتجاوبة</span>
                </h5>

                <div className="flex items-center gap-1 p-1 bg-[#F7F3EB] rounded-lg border border-[#E3DCCD]">
                  <button
                    type="button"
                    onClick={() => setPreviewViewport('desktop')}
                    className={`p-1 rounded cursor-pointer ${previewViewport === 'desktop' ? 'bg-[#282824] text-white' : 'text-[#68675F]'}`}
                    title="معاينة شاشة الكمبيوتر"
                  >
                    <Monitor className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewViewport('mobile')}
                    className={`p-1 rounded cursor-pointer ${previewViewport === 'mobile' ? 'bg-[#282824] text-white' : 'text-[#68675F]'}`}
                    title="معاينة شاشة الهاتف"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Preview Box Container */}
              <div className={`mx-auto transition-all duration-300 ${previewViewport === 'mobile' ? 'max-w-[320px]' : 'w-full'}`}>
                <div className="bg-[#282824] text-white rounded-3xl p-6 border border-[#3e3e38] shadow-lg space-y-4 text-right">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <span className="text-[10px] text-[#B69A68] font-mono font-bold">
                      LIVE PREVIEW · {selectedTypoSection.toUpperCase()}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/80">
                      {previewViewport === 'mobile' ? '📱 شاشة هاتف' : '💻 شاشة حاسوب'}
                    </span>
                  </div>

                  {/* Render Section Live Preview */}
                  <div className="space-y-3 pt-2">
                    {Object.entries(currentSectionElements).map(([k, el]) => {
                      const item: SectionTextElementConfig = el;
                      const fontWeightClass =
                        item.style.fontWeight === 'extrabold'
                          ? 'font-extrabold'
                          : item.style.fontWeight === 'bold'
                          ? 'font-bold'
                          : item.style.fontWeight === 'semibold'
                          ? 'font-semibold'
                          : item.style.fontWeight === 'medium'
                          ? 'font-medium'
                          : 'font-normal';

                      const alignClass =
                        item.style.alignment === 'center'
                          ? 'text-center'
                          : item.style.alignment === 'left'
                          ? 'text-left'
                          : 'text-right';

                      return (
                        <div
                          key={k}
                          className={`transition-all leading-snug ${fontWeightClass} ${alignClass}`}
                          style={{
                            color: item.style.color || '#FFFFFF',
                            fontSize: `${item.style.fontSizeRem || 1.0}rem`,
                          }}
                        >
                          {item.text}
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-3 border-t border-white/10 text-[10px] text-white/50 text-center">
                    يتم تطبيق هذه النصوص والتنسيقات فور حفظها عبر الخادم لكافة الزوار.
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* BRANDING & CURRENCY FORM */}
      {activeTab === 'branding' && (
        <form onSubmit={handleSaveBrand} className="bg-white rounded-3xl p-6 border border-[#E3DCCD] space-y-4 shadow-xs">
          <h4 className="font-bold text-sm text-[#282824]">تخصيص هوية وبيانات الكيان الفندقي وإعدادات العملة</h4>
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

          {/* BRAND THEME COLOR CUSTOMIZATION */}
          <div className="p-4 bg-[#F7F3EB]/80 rounded-2xl border border-[#E3DCCD] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h5 className="font-bold text-xs text-[#282824] flex items-center gap-2">
                  <Palette className="w-4 h-4 text-[#B69A68]" />
                  <span>تخصيص ألوان الهوية البصرية الرئيسية للموقع (Theme Colors)</span>
                </h5>
                <p className="text-[11px] text-[#68675F] mt-0.5">
                  تعديل ألوان الهيدر، الفوتر، الأزرار الرئيسية، وخلفية الصفحات مع حفظها دائمًا على الخادم عبر API وإمكانيّة استعادة الافتراضي.
                </p>
              </div>

              <button
                type="button"
                onClick={handleResetThemeColors}
                className="px-3 py-1.5 bg-white border border-[#E3DCCD] hover:bg-[#EFE9DF] text-[#68675F] text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center gap-1 shrink-0 self-start sm:self-auto"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#B69A68]" />
                <span>استعادة الألوان الافتراضية</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {/* 1. Header Background */}
              <div className="p-3 bg-white rounded-xl border border-[#E3DCCD] space-y-1.5">
                <label className="block text-xs font-bold text-[#282824]">خلفية الهيدر</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={themeForm.headerBg || '#FFFCF6'}
                    onChange={(e) => {
                      const val = e.target.value;
                      setThemeForm(prev => ({ ...prev, headerBg: val }));
                    }}
                    className="w-8 h-8 rounded-lg border border-[#E3DCCD] cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    value={themeForm.headerBg || '#FFFCF6'}
                    onChange={(e) => {
                      const val = e.target.value;
                      setThemeForm(prev => ({ ...prev, headerBg: val }));
                    }}
                    className="flex-1 p-1.5 text-xs font-mono border border-[#E3DCCD] rounded-lg dir-ltr text-center uppercase"
                  />
                </div>
              </div>

              {/* 2. Footer Background */}
              <div className="p-3 bg-white rounded-xl border border-[#E3DCCD] space-y-1.5">
                <label className="block text-xs font-bold text-[#282824]">خلفية الفوتر</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={themeForm.footerBg || '#282824'}
                    onChange={(e) => {
                      const val = e.target.value;
                      setThemeForm(prev => ({ ...prev, footerBg: val }));
                    }}
                    className="w-8 h-8 rounded-lg border border-[#E3DCCD] cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    value={themeForm.footerBg || '#282824'}
                    onChange={(e) => {
                      const val = e.target.value;
                      setThemeForm(prev => ({ ...prev, footerBg: val }));
                    }}
                    className="flex-1 p-1.5 text-xs font-mono border border-[#E3DCCD] rounded-lg dir-ltr text-center uppercase"
                  />
                </div>
              </div>

              {/* 3. Primary Button Background */}
              <div className="p-3 bg-white rounded-xl border border-[#E3DCCD] space-y-1.5">
                <label className="block text-xs font-bold text-[#282824]">لون الأزرار الرئيسية</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={themeForm.primaryBtnBg || '#B69A68'}
                    onChange={(e) => {
                      const val = e.target.value;
                      setThemeForm(prev => ({ ...prev, primaryBtnBg: val, primaryColor: val }));
                    }}
                    className="w-8 h-8 rounded-lg border border-[#E3DCCD] cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    value={themeForm.primaryBtnBg || '#B69A68'}
                    onChange={(e) => {
                      const val = e.target.value;
                      setThemeForm(prev => ({ ...prev, primaryBtnBg: val, primaryColor: val }));
                    }}
                    className="flex-1 p-1.5 text-xs font-mono border border-[#E3DCCD] rounded-lg dir-ltr text-center uppercase"
                  />
                </div>
              </div>

              {/* 4. Page Body Background */}
              <div className="p-3 bg-white rounded-xl border border-[#E3DCCD] space-y-1.5">
                <label className="block text-xs font-bold text-[#282824]">خلفية هيكل الصفحة</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={themeForm.pageBg || '#FAF8F5'}
                    onChange={(e) => {
                      const val = e.target.value;
                      setThemeForm(prev => ({ ...prev, pageBg: val }));
                    }}
                    className="w-8 h-8 rounded-lg border border-[#E3DCCD] cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    value={themeForm.pageBg || '#FAF8F5'}
                    onChange={(e) => {
                      const val = e.target.value;
                      setThemeForm(prev => ({ ...prev, pageBg: val }));
                    }}
                    className="flex-1 p-1.5 text-xs font-mono border border-[#E3DCCD] rounded-lg dir-ltr text-center uppercase"
                  />
                </div>
              </div>
            </div>

            {/* Real-time Live Preview Card */}
            <div className="p-3.5 bg-stone-100 rounded-xl border border-[#E3DCCD] space-y-2">
              <span className="text-[11px] font-bold text-[#68675F] block">معاينة حية ومباشرة للألوان المختارة:</span>
              <div className="rounded-xl overflow-hidden border border-[#E3DCCD] shadow-xs text-xs">
                <div
                  className="p-2.5 flex items-center justify-between text-xs font-bold"
                  style={{ backgroundColor: themeForm.headerBg || '#FFFCF6' }}
                >
                  <span>الهيدر الرئيسي</span>
                  <button
                    type="button"
                    className="px-3 py-1 text-white font-bold rounded-lg text-[10px]"
                    style={{ backgroundColor: themeForm.primaryBtnBg || '#B69A68' }}
                  >
                    زر رئيسي
                  </button>
                </div>

                <div
                  className="p-4 text-center text-[#282824]"
                  style={{ backgroundColor: themeForm.pageBg || '#FAF8F5' }}
                >
                  <p className="font-semibold text-xs mb-2">محتوى الصفحة العام وهيكل الموقع</p>
                  <button
                    type="button"
                    className="px-4 py-2 text-white font-bold rounded-xl text-xs shadow-xs"
                    style={{ backgroundColor: themeForm.primaryBtnBg || '#B69A68' }}
                  >
                    تأكيد الحجز الفندقي
                  </button>
                </div>

                <div
                  className="p-2.5 text-center text-[#EFE9DF] text-[10px]"
                  style={{ backgroundColor: themeForm.footerBg || '#282824' }}
                >
                  <span>الفوتر السفلي - © 2026 جميع الحقوق محفوظة · تصميم Abdullah-Almkhlafi.2026</span>
                </div>
              </div>
            </div>
          </div>

          {/* CURRENCY FORMATTING OPTIONS */}
          <div className="p-4 bg-[#F7F3EB]/80 rounded-2xl border border-[#E3DCCD] space-y-3">
            <h5 className="font-bold text-xs text-[#282824] flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[#B69A68]" />
              <span>إعدادات عرض العملة الرسمية والمبالغ المالية (Currency Display)</span>
            </h5>
            <p className="text-[11px] text-[#68675F]">
              اختر بين عرض الرمز الرسمي للريال السعودي (Official SVG Emblem) أو كود العملة النصي (SAR / ر.س). الأرقام والمبالغ الحسابية تُحفظ بدقة كاملة دون أي تعديل.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <label className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                brandForm.currencyDisplayMode === 'symbol'
                  ? 'bg-white border-[#B69A68] shadow-xs'
                  : 'bg-white/50 border-[#E3DCCD] hover:bg-white'
              }`}>
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="currencyDisplayMode"
                    value="symbol"
                    checked={brandForm.currencyDisplayMode === 'symbol'}
                    onChange={() => {
                      setBrandForm(prev => ({ ...prev, currencyDisplayMode: 'symbol', currencySymbol: 'ر.س' }));
                      setGlobalCurrencyDisplayMode('symbol');
                    }}
                    className="accent-[#282824] w-4 h-4"
                  />
                  <div>
                    <strong className="block text-xs text-[#282824]">رمز الريال السعودي الرسمي (SAMA SVG)</strong>
                    <span className="text-[10px] text-[#68675F]">الرمز الرسمي المعتمد من البنك المركزي السعودي مع بديل SAR</span>
                  </div>
                </div>

                <bdi dir="ltr" className="inline-flex items-center gap-1 font-bold text-sm text-[#282824] font-mono">
                  <span>5,400</span>
                  <SaudiRiyalSymbol size={16} />
                </bdi>
              </label>

              <label className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                brandForm.currencyDisplayMode === 'code'
                  ? 'bg-white border-[#B69A68] shadow-xs'
                  : 'bg-white/50 border-[#E3DCCD] hover:bg-white'
              }`}>
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="currencyDisplayMode"
                    value="code"
                    checked={brandForm.currencyDisplayMode === 'code'}
                    onChange={() => {
                      setBrandForm(prev => ({ ...prev, currencyDisplayMode: 'code', currencySymbol: 'SAR' }));
                      setGlobalCurrencyDisplayMode('code');
                    }}
                    className="accent-[#282824] w-4 h-4"
                  />
                  <div>
                    <strong className="block text-xs text-[#282824]">رمز العملة النصي (SAR)</strong>
                    <span className="text-[10px] text-[#68675F]">عرض الكود القياسي الدولي SAR بجانب المبالغ</span>
                  </div>
                </div>

                <bdi dir="ltr" className="inline-flex items-center gap-1 font-bold text-sm text-[#282824] font-mono">
                  <span>5,400</span>
                  <span className="text-xs font-bold text-[#68675F]">SAR</span>
                </bdi>
              </label>
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
                className="w-full p-2 bg-[#F7F3EB]/40 border border-[#E3DCCD] rounded-xl tabular-nums font-mono text-left focus:outline-none"
                dir="ltr"
              />
            </div>
            <div>
              <label className="font-semibold text-[#68675F] block mb-1">رقم السجل التجاري الرسمي للمنشأة</label>
              <input
                type="text"
                value={brandForm.commercialReg}
                onChange={(e) => setBrandForm(prev => ({ ...prev, commercialReg: e.target.value }))}
                className="w-full p-2 bg-[#F7F3EB]/40 border border-[#E3DCCD] rounded-xl tabular-nums font-mono text-left focus:outline-none"
                dir="ltr"
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
                  className="w-full p-2 bg-white border border-[#E3DCCD] rounded-xl text-center font-bold focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="font-semibold text-[#68675F] block mb-1">الارتفاع الأقصى للشعار (بكسل)</label>
                <input
                  type="number"
                  value={navForm.logoMaxHeightPx}
                  onChange={(e) => setNavForm(prev => ({ ...prev, logoMaxHeightPx: Number(e.target.value) || 44 }))}
                  className="w-full p-2 bg-white border border-[#E3DCCD] rounded-xl text-center font-bold focus:outline-none font-mono"
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
                  <span className="w-6 h-6 rounded-full bg-[#F7F3EB] text-[#282824] flex items-center justify-center font-bold text-xs tabular-nums select-none font-mono">
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

      {/* THEME & COLOR CUSTOMIZATION TAB */}
      {activeTab === 'theme' && (
        <div className="bg-white rounded-3xl p-6 border border-[#E3DCCD] space-y-6 shadow-xs text-right">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E3DCCD]">
            <div>
              <h4 className="font-bold text-sm text-[#282824] flex items-center gap-2">
                <Palette className="w-5 h-5 text-[#B69A68]" />
                <span>إعدادات المظهر وتخصيص الألوان البصرية (Theme Color Variables)</span>
              </h4>
              <p className="text-[#68675F] mt-0.5">
                تعديل وتطبيق ألوان الهيدر، الفوتر، الأزرار الرئيسية، وخلفية هيكل الصفحات مباشرة وتحديث قيم CSS Variables فوراً مع حفظها دائمًا في قاعدة البيانات عبر API الخادم.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                handleResetThemeColors();
                applyCssThemeVariables({
                  headerBg: '#FFFCF6',
                  footerBg: '#282824',
                  primaryBtnBg: '#B69A68',
                  pageBg: '#FAF8F5'
                });
              }}
              className="px-4 py-2 bg-[#F7F3EB] border border-[#E3DCCD] hover:bg-[#EFE9DF] text-[#282824] text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              <RotateCcw className="w-4 h-4 text-[#B69A68]" />
              <span>استعادة الألوان الافتراضية</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Header Background */}
            <div className="p-4 bg-[#F7F3EB]/50 rounded-2xl border border-[#E3DCCD] space-y-2">
              <label className="font-bold text-xs text-[#282824] block">خلفية الهيدر العلوي</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={themeForm.headerBg || '#FFFCF6'}
                  onChange={(e) => {
                    const val = e.target.value;
                    const updated = { ...themeForm, headerBg: val };
                    setThemeForm(updated);
                    applyCssThemeVariables(updated);
                  }}
                  className="w-10 h-10 rounded-xl border border-[#E3DCCD] cursor-pointer p-1"
                />
                <input
                  type="text"
                  value={themeForm.headerBg || '#FFFCF6'}
                  onChange={(e) => {
                    const val = e.target.value;
                    const updated = { ...themeForm, headerBg: val };
                    setThemeForm(updated);
                    applyCssThemeVariables(updated);
                  }}
                  className="w-full p-2 text-xs font-mono border border-[#E3DCCD] rounded-xl dir-ltr text-center uppercase font-bold"
                />
              </div>
            </div>

            {/* 2. Footer Background */}
            <div className="p-4 bg-[#F7F3EB]/50 rounded-2xl border border-[#E3DCCD] space-y-2">
              <label className="font-bold text-xs text-[#282824] block">خلفية الفوتر السفلي</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={themeForm.footerBg || '#282824'}
                  onChange={(e) => {
                    const val = e.target.value;
                    const updated = { ...themeForm, footerBg: val };
                    setThemeForm(updated);
                    applyCssThemeVariables(updated);
                  }}
                  className="w-10 h-10 rounded-xl border border-[#E3DCCD] cursor-pointer p-1"
                />
                <input
                  type="text"
                  value={themeForm.footerBg || '#282824'}
                  onChange={(e) => {
                    const val = e.target.value;
                    const updated = { ...themeForm, footerBg: val };
                    setThemeForm(updated);
                    applyCssThemeVariables(updated);
                  }}
                  className="w-full p-2 text-xs font-mono border border-[#E3DCCD] rounded-xl dir-ltr text-center uppercase font-bold"
                />
              </div>
            </div>

            {/* 3. Primary Button Background */}
            <div className="p-4 bg-[#F7F3EB]/50 rounded-2xl border border-[#E3DCCD] space-y-2">
              <label className="font-bold text-xs text-[#282824] block">لون الأزرار الرئيسية</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={themeForm.primaryBtnBg || '#B69A68'}
                  onChange={(e) => {
                    const val = e.target.value;
                    const updated = { ...themeForm, primaryBtnBg: val, primaryColor: val };
                    setThemeForm(updated);
                    applyCssThemeVariables(updated);
                  }}
                  className="w-10 h-10 rounded-xl border border-[#E3DCCD] cursor-pointer p-1"
                />
                <input
                  type="text"
                  value={themeForm.primaryBtnBg || '#B69A68'}
                  onChange={(e) => {
                    const val = e.target.value;
                    const updated = { ...themeForm, primaryBtnBg: val, primaryColor: val };
                    setThemeForm(updated);
                    applyCssThemeVariables(updated);
                  }}
                  className="w-full p-2 text-xs font-mono border border-[#E3DCCD] rounded-xl dir-ltr text-center uppercase font-bold"
                />
              </div>
            </div>

            {/* 4. Page Body Background */}
            <div className="p-4 bg-[#F7F3EB]/50 rounded-2xl border border-[#E3DCCD] space-y-2">
              <label className="font-bold text-xs text-[#282824] block">خلفية هيكل الصفحة العام</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={themeForm.pageBg || '#FAF8F5'}
                  onChange={(e) => {
                    const val = e.target.value;
                    const updated = { ...themeForm, pageBg: val };
                    setThemeForm(updated);
                    applyCssThemeVariables(updated);
                  }}
                  className="w-10 h-10 rounded-xl border border-[#E3DCCD] cursor-pointer p-1"
                />
                <input
                  type="text"
                  value={themeForm.pageBg || '#FAF8F5'}
                  onChange={(e) => {
                    const val = e.target.value;
                    const updated = { ...themeForm, pageBg: val };
                    setThemeForm(updated);
                    applyCssThemeVariables(updated);
                  }}
                  className="w-full p-2 text-xs font-mono border border-[#E3DCCD] rounded-xl dir-ltr text-center uppercase font-bold"
                />
              </div>
            </div>
          </div>

          {/* Live Dynamic Preview */}
          <div className="p-4 bg-stone-100 rounded-2xl border border-[#E3DCCD] space-y-3">
            <span className="text-xs font-bold text-[#68675F] block">معاينة حية ومباشرة للألوان والتغيرات البصرية:</span>
            <div className="rounded-2xl overflow-hidden border border-[#E3DCCD] shadow-md text-xs">
              <div
                className="p-3.5 flex items-center justify-between text-xs font-bold transition-all"
                style={{ backgroundColor: themeForm.headerBg || '#FFFCF6' }}
              >
                <span>الهيدر الرئيسي وشريط التنقل</span>
                <button
                  type="button"
                  className="px-3.5 py-1.5 text-white font-bold rounded-xl text-xs transition-all shadow-xs"
                  style={{ backgroundColor: themeForm.primaryBtnBg || '#B69A68' }}
                >
                  زر رئيسي
                </button>
              </div>

              <div
                className="p-6 text-center text-[#282824] transition-all"
                style={{ backgroundColor: themeForm.pageBg || '#FAF8F5' }}
              >
                <p className="font-semibold text-xs mb-3">محتوى الصفحة العام وهيكل موقع منزل الفخامة</p>
                <button
                  type="button"
                  className="px-5 py-2.5 text-white font-bold rounded-xl text-xs shadow-md transition-all"
                  style={{ backgroundColor: themeForm.primaryBtnBg || '#B69A68' }}
                >
                  تأكيد الحجز الفندقي المباشر
                </button>
              </div>

              <div
                className="p-3.5 text-center text-[#EFE9DF] text-xs transition-all"
                style={{ backgroundColor: themeForm.footerBg || '#282824' }}
              >
                <span>الفوتر السفلي - © 2026 جميع الحقوق محفوظة · تصميم Abdullah-Almkhlafi.2026</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[#E3DCCD]/60 flex justify-end">
            <button
              onClick={() => {
                applyCssThemeVariables(themeForm);
                updateCompanySettings({ theme: themeForm });
                setSuccessMsg('تم حفظ وتحديث إعدادات المظهر والألوان في قاعدة البيانات وتطبيق قيم CSS Variables فورياً.');
                setTimeout(() => setSuccessMsg(null), 3000);
              }}
              className="px-6 py-2.5 bg-[#282824] hover:bg-[#1a1a18] text-white font-bold rounded-xl flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Save className="w-4 h-4 text-[#B69A68]" />
              <span>حفظ إعدادات المظهر وتطبيقه دائمًا عبر API</span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
