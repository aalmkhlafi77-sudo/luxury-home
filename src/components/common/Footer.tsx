import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Phone, Mail, MapPin, ShieldCheck } from 'lucide-react';

interface FooterProps {
  onScrollToSection: (sectionId: string) => void;
  onOpenAdmin: () => void;
  onOpenStaffPwa: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onScrollToSection,
  onOpenAdmin,
  onOpenStaffPwa,
}) => {
  const { state } = useAppStore();

  return (
    <footer className="bg-[#282824] text-[#EFE9DF] pt-16 pb-12 border-t border-[#3e3e38]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 pb-12 border-b border-[#3e3e38]">
          
          {/* Col 1: Brand & Identity */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {state.settings.logoUrl ? (
                <img 
                  src={state.settings.logoUrl} 
                  alt={state.settings.companyName} 
                  className="h-10 w-auto object-contain max-w-[150px] brightness-0 invert" 
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-[#B69A68] text-[#282824] flex items-center justify-center font-bold text-base overflow-hidden">
                  {state.settings.iconUrl ? (
                    <img src={state.settings.iconUrl} alt="icon" className="w-full h-full object-cover" />
                  ) : (
                    'LH'
                  )}
                </div>
              )}
              <div>
                <span className="text-lg font-bold tracking-tight text-white block leading-none">
                  {state.settings.companyName}
                </span>
                <span className="text-xs text-[#EFE9DF]/60 block mt-1">
                  {state.settings.companyNameEn}
                </span>
              </div>
            </div>
            <p className="text-sm text-[#EFE9DF]/75 leading-relaxed">
              {state.settings.tagline}
            </p>
            <div className="flex items-center gap-2 text-xs text-[#B69A68]">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>{state.settings.companyName} لإدارة الفنادق والضيافة المعتمدة رسمياً</span>
            </div>
          </div>

          {/* Col 2: Buildings */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-white tracking-wide">
              مشاريعنا العقارية
            </h4>
            <ul className="space-y-2.5 text-sm text-[#EFE9DF]/75">
              {state.properties.map(prop => (
                <li key={prop.id}>
                  <button
                    onClick={() => onScrollToSection('buildings')}
                    className="hover:text-white transition-colors text-right block cursor-pointer"
                  >
                    <span className="font-medium text-white/90">{prop.name}</span>
                    <span className="block text-xs text-[#EFE9DF]/50">{prop.district} · {prop.totalFloors} طوابق مخصصة</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3: Quick Navigation */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-white tracking-wide">
              روابط سريعة
            </h4>
            <ul className="space-y-2 text-sm text-[#EFE9DF]/75">
              <li>
                <button onClick={() => onScrollToSection('hero')} className="hover:text-white transition-colors cursor-pointer">
                  مقدمة الترحيب
                </button>
              </li>
              <li>
                <button onClick={() => onScrollToSection('units')} className="hover:text-white transition-colors cursor-pointer">
                  أجنحتنا السكنية المتاحة
                </button>
              </li>
              <li>
                <button onClick={() => onScrollToSection('amenities')} className="hover:text-white transition-colors cursor-pointer">
                  الخدمات والمرافق
                </button>
              </li>
              <li>
                <button onClick={() => onScrollToSection('faq')} className="hover:text-white transition-colors cursor-pointer">
                  الأسئلة الشائعة
                </button>
              </li>
              <li>
                <button onClick={onOpenAdmin} className="text-[#B69A68] hover:underline font-medium cursor-pointer">
                  إدارة الملاك والمشرفين
                </button>
              </li>
              <li>
                <button onClick={onOpenStaffPwa} className="text-[#B69A68] hover:underline font-medium cursor-pointer">
                  بوابة الطواقم والخدمة (PWA)
                </button>
              </li>
            </ul>
          </div>

          {/* Col 4: Contact & Registry */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-white tracking-wide">
              البيانات الضريبية والتواصل
            </h4>
            <div className="space-y-2.5 text-xs text-[#EFE9DF]/75">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-[#B69A68] shrink-0 mt-0.5" />
                <span>{state.settings.address}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#B69A68] shrink-0" />
                <span dir="ltr">{state.settings.phone}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#B69A68] shrink-0" />
                <span>{state.settings.email}</span>
              </div>
              <div className="pt-2 border-t border-[#3e3e38]/70 text-[11px] text-[#EFE9DF]/50 space-y-1">
                <div>الرقم الضريبي الموحد: {state.settings.taxNumber}</div>
                <div>السجل التجاري المرخص: {state.settings.commercialReg}</div>
              </div>
            </div>
          </div>

        </div>

        {/* Quiet Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-[#EFE9DF]/50 gap-4">
          <p>© {new Date().getFullYear()} {state.settings.companyName}. جميع الحقوق محفوظة لشركة منزل الفخامة المحدودة.</p>
          <div className="flex items-center gap-6">
            <span>الشروط والأحكام</span>
            <span>سياسة الخصوصية والأمن</span>
            <span>لوائح الإقامة الفندقية</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
