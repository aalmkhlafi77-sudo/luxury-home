import React, { useState } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { applyCssThemeVariables } from '../../../utils/themeManager';
import { Palette, RotateCcw, Save, Check, Eye } from 'lucide-react';

export const AppearanceSettings: React.FC = () => {
  const { state, updateCompanySettings } = useAppStore();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [themeForm, setThemeForm] = useState({
    headerBg: state.settings.theme?.headerBg || '#FFFCF6',
    footerBg: state.settings.theme?.footerBg || '#282824',
    primaryBtnBg: state.settings.theme?.primaryBtnBg || '#B69A68',
    pageBg: state.settings.theme?.pageBg || '#FAF8F5',
    primaryColor: state.settings.theme?.primaryColor || '#B69A68',
    ivoryBg: state.settings.theme?.ivoryBg || '#F7F3EB',
    ivorySurface: state.settings.theme?.ivorySurface || '#FFFCF6',
    textColor: state.settings.theme?.textColor || '#282824',
    textMuted: state.settings.theme?.textMuted || '#68675F',
    borderColor: state.settings.theme?.borderColor || '#E3DCCD',
    glassBlurIntensity: state.settings.theme?.glassBlurIntensity || 14,
    borderRadius: state.settings.theme?.borderRadius || 'xl',
    enableAnimations: state.settings.theme?.enableAnimations ?? true,
  });

  const handleColorChange = (key: keyof typeof themeForm, value: any) => {
    const updated = { ...themeForm, [key]: value };
    if (key === 'primaryBtnBg') {
      updated.primaryColor = value;
    }
    setThemeForm(updated);
    // Directly update CSS Variables on document.documentElement (:root)
    applyCssThemeVariables(updated);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    // Update CSS variables directly on document.documentElement
    applyCssThemeVariables(themeForm);
    // Persist to database via API through store/settings endpoint
    updateCompanySettings({ theme: themeForm });
    setSuccessMsg('تم حفظ وتحديث إعدادات المظهر والألوان في قاعدة البيانات وتطبيق متغيرات CSS مباشرة بنجاح.');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleResetDefaults = () => {
    const defaults = {
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
    setThemeForm(defaults);
    applyCssThemeVariables(defaults);
    updateCompanySettings({ theme: defaults });
    setSuccessMsg('تمت استعادة الألوان والإعدادات الافتراضية وتحديث قيم CSS Variables بنجاح.');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  return (
    <div className="bg-white rounded-3xl p-6 border border-[#E3DCCD] space-y-6 shadow-xs text-right animate-in fade-in select-text">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E3DCCD]">
        <div>
          <h3 className="font-bold text-base text-[#282824] flex items-center gap-2">
            <Palette className="w-5 h-5 text-[#B69A68]" />
            <span>إعدادات المظهر وتخصيص الألوان البصرية (Appearance Settings)</span>
          </h3>
          <p className="text-xs text-[#68675F] mt-1">
            إدارة وتحديث ألوان الهيدر، الفوتر، الأزرار الرئيسية، وخلفية الهيكل العام مع حفظها دائمًا في قاعدة البيانات وتطبيق قيم CSS Variables فوراً على :root.
          </p>
        </div>

        <button
          type="button"
          onClick={handleResetDefaults}
          className="px-4 py-2 bg-[#F7F3EB] border border-[#E3DCCD] hover:bg-[#EFE9DF] text-[#282824] text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
        >
          <RotateCcw className="w-4 h-4 text-[#B69A68]" />
          <span>استعادة الألوان الافتراضية</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 flex items-center gap-2 text-xs">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{successMsg}</span>
        </div>
      )}

      {/* Main Color Form */}
      <form onSubmit={handleSave} className="space-y-6">
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* 1. Header Background */}
          <div className="p-4 bg-[#F7F3EB]/50 rounded-2xl border border-[#E3DCCD] space-y-2">
            <label className="font-bold text-xs text-[#282824] block">خلفية الهيدر العلوي</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={themeForm.headerBg}
                onChange={(e) => handleColorChange('headerBg', e.target.value)}
                className="w-10 h-10 rounded-xl border border-[#E3DCCD] cursor-pointer p-1"
              />
              <input
                type="text"
                value={themeForm.headerBg}
                onChange={(e) => handleColorChange('headerBg', e.target.value)}
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
                value={themeForm.footerBg}
                onChange={(e) => handleColorChange('footerBg', e.target.value)}
                className="w-10 h-10 rounded-xl border border-[#E3DCCD] cursor-pointer p-1"
              />
              <input
                type="text"
                value={themeForm.footerBg}
                onChange={(e) => handleColorChange('footerBg', e.target.value)}
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
                value={themeForm.primaryBtnBg}
                onChange={(e) => handleColorChange('primaryBtnBg', e.target.value)}
                className="w-10 h-10 rounded-xl border border-[#E3DCCD] cursor-pointer p-1"
              />
              <input
                type="text"
                value={themeForm.primaryBtnBg}
                onChange={(e) => handleColorChange('primaryBtnBg', e.target.value)}
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
                value={themeForm.pageBg}
                onChange={(e) => handleColorChange('pageBg', e.target.value)}
                className="w-10 h-10 rounded-xl border border-[#E3DCCD] cursor-pointer p-1"
              />
              <input
                type="text"
                value={themeForm.pageBg}
                onChange={(e) => handleColorChange('pageBg', e.target.value)}
                className="w-full p-2 text-xs font-mono border border-[#E3DCCD] rounded-xl dir-ltr text-center uppercase font-bold"
              />
            </div>
          </div>

        </div>

        {/* Live Interactive Preview Card */}
        <div className="p-4 bg-stone-100 rounded-2xl border border-[#E3DCCD] space-y-3">
          <div className="flex items-center justify-between text-xs text-[#68675F]">
            <span className="font-bold flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-[#B69A68]" />
              <span>معاينة حية ومباشرة لقيم CSS Variables المطبقة:</span>
            </span>
            <span className="font-mono dir-ltr text-[11px] text-[#282824]">
              :root &#123; --color-header-bg: {themeForm.headerBg}; --color-primary-btn-bg: {themeForm.primaryBtnBg}; &#125;
            </span>
          </div>

          <div className="rounded-2xl overflow-hidden border border-[#E3DCCD] shadow-md text-xs">
            {/* Header Preview */}
            <div
              className="p-3.5 flex items-center justify-between text-xs font-bold transition-all"
              style={{ backgroundColor: themeForm.headerBg }}
            >
              <span>الهيدر الرئيسي وشريط التنقل العلوي</span>
              <button
                type="button"
                className="px-3.5 py-1.5 text-white font-bold rounded-xl text-xs transition-all shadow-xs"
                style={{ backgroundColor: themeForm.primaryBtnBg }}
              >
                زر إجراء رئيسي
              </button>
            </div>

            {/* Page Body Preview */}
            <div
              className="p-6 text-center text-[#282824] transition-all"
              style={{ backgroundColor: themeForm.pageBg }}
            >
              <p className="font-semibold text-xs mb-3">محتوى الصفحة العام وهيكل موقع منزل الفخامة</p>
              <button
                type="button"
                className="px-5 py-2.5 text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer active:scale-95"
                style={{ backgroundColor: themeForm.primaryBtnBg }}
              >
                تأكيد وتفعيل الحجز الفندقي
              </button>
            </div>

            {/* Footer Preview */}
            <div
              className="p-3.5 text-center text-[#EFE9DF] text-xs transition-all"
              style={{ backgroundColor: themeForm.footerBg }}
            >
              <span>الفوتر السفلي - © 2026 جميع الحقوق محفوظة · تصميم Abdullah-Almkhlafi.2026</span>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="pt-3 border-t border-[#E3DCCD]/60 flex justify-end">
          <button
            type="submit"
            className="px-6 py-2.5 bg-[#282824] hover:bg-[#1a1a18] text-white font-bold rounded-xl flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <Save className="w-4 h-4 text-[#B69A68]" />
            <span>حفظ إعدادات المظهر وتطبيقها في قاعدة البيانات عبر API</span>
          </button>
        </div>

      </form>
    </div>
  );
};
