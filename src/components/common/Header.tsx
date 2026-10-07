import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../../store/useAppStore';
import {
  Menu,
  X,
  UserCheck,
  Sliders,
  Smartphone,
  CalendarDays,
  User,
  Home,
  Building2,
  Sparkles,
  ConciergeBell,
  HelpCircle,
  Phone,
  ChevronDown
} from 'lucide-react';

interface HeaderProps {
  activeSection: string;
  onOpenClientPortal: () => void;
  onOpenAdmin: () => void;
  onOpenStaffPwa: () => void;
  onScrollToSection: (sectionId: string) => void;
  isMobileDrawerOpen: boolean;
  setIsMobileDrawerOpen: (open: boolean) => void;
  className?: string;
}

const iconMap: Record<string, React.FC<{ className?: string }>> = {
  Home,
  Building2,
  Sparkles,
  ConciergeBell,
  HelpCircle,
  Phone
};

function hexToRgba(hex?: string, alpha: number = 0.72): string {
  if (!hex || !hex.startsWith('#')) return `rgba(255, 252, 246, ${alpha})`;
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  if (c.length === 6) {
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return `rgba(255, 252, 246, ${alpha})`;
}

export const Header: React.FC<HeaderProps> = ({
  activeSection,
  onOpenClientPortal,
  onOpenAdmin,
  onOpenStaffPwa,
  onScrollToSection,
  isMobileDrawerOpen,
  setIsMobileDrawerOpen,
  className
}) => {
  const { state } = useAppStore();
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const desktopNavRef = useRef<HTMLElement | null>(null);
  const [activeIndicator, setActiveIndicator] = useState({ left: 0, width: 0, visible: false });

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 15) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navConfig = state.settings.navigation;
  const navLinks = navConfig?.navLinks?.filter(l => l.visible).sort((a, b) => a.order - b.order) || [
    { id: 'nav_home', label: 'الرئيسية', targetSectionId: 'hero', visible: true, order: 1 },
    { id: 'nav_buildings', label: 'المجمعات', targetSectionId: 'buildings', visible: true, order: 2 },
    { id: 'nav_units', label: 'الوحدات الفاخرة', targetSectionId: 'units', visible: true, order: 3 },
    { id: 'nav_amenities', label: 'الخدمات الفندقية', targetSectionId: 'amenities', visible: true, order: 4 },
    { id: 'nav_faq', label: 'الأسئلة الشائعة', targetSectionId: 'faq', visible: true, order: 5 },
    { id: 'nav_contact', label: 'اتصل بنا', targetSectionId: 'contact', visible: true, order: 6 },
  ];

  const navLayoutKey = navLinks.map(link => `${link.id}:${link.label}:${link.order}:${link.targetSectionId}`).join('|');

  // Position the animated active marker under the current desktop navigation item.
  useEffect(() => {
    const nav = desktopNavRef.current;
    if (!nav) return;

    const measureActiveItem = () => {
      const activeButton = nav.querySelector<HTMLButtonElement>('[data-active="true"]');
      if (!activeButton) {
        setActiveIndicator(current => current.visible ? { ...current, visible: false } : current);
        return;
      }

      const navRect = nav.getBoundingClientRect();
      const buttonRect = activeButton.getBoundingClientRect();
      const left = buttonRect.left - navRect.left;
      const width = buttonRect.width;
      setActiveIndicator(current => (
        current.visible && Math.abs(current.left - left) < 0.5 && Math.abs(current.width - width) < 0.5
          ? current
          : { left, width, visible: true }
      ));
    };

    const frame = window.requestAnimationFrame(measureActiveItem);
    const observer = new ResizeObserver(measureActiveItem);
    observer.observe(nav);
    window.addEventListener('resize', measureActiveItem);
    document.fonts?.ready.then(measureActiveItem).catch(() => undefined);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', measureActiveItem);
    };
  }, [activeSection, navLayoutKey]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (isMobileDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileDrawerOpen]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileDrawerOpen(false);
        setAccountDropdownOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setIsMobileDrawerOpen]);

  const customHeaderBg = state.settings.theme?.headerBg
    ? `linear-gradient(to bottom, ${hexToRgba(state.settings.theme.headerBg, isScrolled ? 0.92 : 0.4)}, ${hexToRgba(state.settings.theme.headerBg, isScrolled ? 0.82 : 0.2)})`
    : undefined;

  return (
    <>
      <header 
        className={`site-header transition-all duration-300 backdrop-blur-2xl backdrop-saturate-200 ${
          isScrolled ? 'is-scrolled shadow-md border-b border-[#E3DCCD]/80' : 'shadow-xs border-b border-white/40'
        } ${className || ''}`}
        style={{
          ...(customHeaderBg ? { background: customHeaderBg } : {}),
          backdropFilter: 'blur(24px) saturate(200%)',
          WebkitBackdropFilter: 'blur(24px) saturate(200%)',
          ...(navConfig?.headerHeightPx && navConfig.headerHeightPx !== 80
            ? ({ '--site-header-height': `${navConfig.headerHeightPx}px` } as React.CSSProperties)
            : {})
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between gap-2 sm:gap-3">
          
          {/* ========================================================= */}
          {/* ZONE 1: BRAND LOGO (RTL Right) */}
          {/* ========================================================= */}
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onScrollToSection('hero');
            }}
            className="flex items-center gap-2 text-right group shrink-0 select-none cursor-pointer"
          >
            {state.settings.logoUrl ? (
              <img 
                src={state.settings.logoUrl} 
                alt={state.settings.companyName} 
                style={{ maxHeight: `${navConfig?.logoMaxHeightPx || 44}px` }}
                className="w-auto object-contain max-w-[180px] sm:max-w-[220px]" 
              />
            ) : (
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-[#282824] text-[#B69A68] flex items-center justify-center font-bold text-base shadow-sm shrink-0 overflow-hidden">
                  {state.settings.iconUrl ? (
                    <img src={state.settings.iconUrl} alt="icon" className="w-full h-full object-cover" />
                  ) : (
                    'LH'
                  )}
                </div>
                <div className="hidden min-[380px]:block">
                  <span className="text-base sm:text-lg font-bold tracking-tight text-[#282824] block leading-none">
                    {state.settings.companyName}
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-medium text-[#68675F] tracking-wide block mt-1">
                    {state.settings.companyNameEn}
                  </span>
                </div>
              </div>
            )}
          </a>

          {/* ========================================================= */}
          {/* ZONE 2: DESKTOP NAVIGATION LINKS (Middle) */}
          {/* ========================================================= */}
          <nav
            ref={desktopNavRef}
            className="hidden lg:flex relative items-center gap-4 xl:gap-6 text-[13px] font-medium text-[var(--header-nav-text-color)]"
            style={{
              '--header-nav-text-color': navConfig?.headerNavTextColor || '#68675F',
              '--header-nav-hover-color': navConfig?.headerNavHoverColor || '#B69A68',
              '--header-nav-active-text-color': navConfig?.headerNavActiveTextColor || '#282824',
            } as React.CSSProperties}
          >
            {navLinks.map(link => {
              const isActive = activeSection === link.targetSectionId;
              return (
                <button
                  key={link.id}
                  onClick={() => onScrollToSection(link.targetSectionId)}
                  data-active={isActive ? "true" : undefined}
                  aria-current={isActive ? "location" : undefined}
                  className={`relative py-1 transition-colors whitespace-nowrap cursor-pointer ${
                    isActive ? 'text-[var(--header-nav-active-text-color)] font-bold' : 'hover:text-[var(--header-nav-hover-color)]'
                  }`}
                >
                  <span>{link.label}</span>

                </button>
              );
            })}
            {activeIndicator.visible && (
              <span
                key={activeSection}
                aria-hidden="true"
                className="header-nav-indicator"
                style={{ left: activeIndicator.left, width: activeIndicator.width, backgroundColor: navConfig?.navActiveColor || '#B69A68' }}
              />
            )}
          </nav>

          {/* ========================================================= */}
          {/* ZONE 3: ACCOUNT & PRIMARY CTA (RTL Left) */}
          {/* ========================================================= */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            
            {/* Desktop Account Menu Dropdown */}
            <div className="relative hidden md:block">
              <button
                onClick={() => setAccountDropdownOpen(!accountDropdownOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#282824] bg-white border border-[#E3DCCD] rounded-xl hover:border-[#B69A68] hover:bg-[#FFFCF6] transition-all shadow-xs cursor-pointer"
                aria-expanded={accountDropdownOpen}
              >
                <User className="w-4 h-4 text-[#B69A68]" />
                <span>الحساب والخدمات</span>
                <ChevronDown className="w-3.5 h-3.5 text-[#68675F]" />
              </button>

              {accountDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setAccountDropdownOpen(false)} 
                  />
                  <div className="absolute left-0 mt-2 w-56 bg-white rounded-2xl border border-[#E3DCCD] shadow-xl z-20 py-2 text-xs text-right animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-3 py-2 border-b border-[#E3DCCD]/60 text-[#68675F] font-semibold">
                      خدمات النزلاء والمشرفين
                    </div>

                    <button
                      onClick={() => {
                        setAccountDropdownOpen(false);
                        onOpenClientPortal();
                      }}
                      className="w-full px-3 py-2.5 hover:bg-[#F7F3EB] flex items-center gap-2 text-[#282824] font-medium cursor-pointer"
                    >
                      <UserCheck className="w-4 h-4 text-[#B69A68]" />
                      <span>بوابة النزلاء وحجوزاتي</span>
                    </button>

                    <button
                      onClick={() => {
                        setAccountDropdownOpen(false);
                        onOpenAdmin();
                      }}
                      className="w-full px-3 py-2.5 hover:bg-[#F7F3EB] flex items-center gap-2 text-[#282824] font-medium cursor-pointer"
                    >
                      <Sliders className="w-4 h-4 text-[#B69A68]" />
                      <span>لوحة التحكم والمشرفين</span>
                    </button>

                    <button
                      onClick={() => {
                        setAccountDropdownOpen(false);
                        onOpenStaffPwa();
                      }}
                      className="w-full px-3 py-2.5 hover:bg-[#F7F3EB] flex items-center gap-2 text-[#282824] font-medium cursor-pointer"
                    >
                      <Smartphone className="w-4 h-4 text-[#B69A68]" />
                      <span>تطبيق طاقم العمل (PWA)</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Primary CTA "احجز الآن" */}
            <button
              onClick={() => onScrollToSection('search_bar')}
              className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-[13px] font-semibold text-white bg-[#282824] hover:bg-[#1a1a18] rounded-xl transition-all whitespace-nowrap shadow-xs flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <CalendarDays className="w-4 h-4 text-[#B69A68]" />
              <span>احجز الآن</span>
            </button>

            {/* Mobile Hamburger / Menu Toggle Button */}
            <button
              onClick={() => setIsMobileDrawerOpen(!isMobileDrawerOpen)}
              className="lg:hidden p-2 text-[#282824] hover:bg-[#EFE9DF] rounded-xl transition-colors cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="قائمة التنقل"
            >
              {isMobileDrawerOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

          </div>
        </div>
      </header>

      {/* ========================================================= */}
      {/* MOBILE DRAWER SHEET (Unified Mobile Navigation Drawer) */}
      {/* ========================================================= */}
      {isMobileDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          
          {/* Backdrop Scrim */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileDrawerOpen(false)}
          />

          {/* Drawer Content Panel (RTL Right-Sliding Panel) */}
          <div className="relative w-full max-w-xs bg-[#FFFCF6] border-l border-[#E3DCCD] shadow-2xl h-full flex flex-col justify-between overflow-y-auto z-10 text-right">
            
            <div className="p-5 space-y-6">
              
              {/* Drawer Top Header */}
              <div className="flex items-center justify-between pb-4 border-b border-[#E3DCCD]">
                <div className="flex items-center gap-2.5">
                  {state.settings.logoUrl ? (
                    <img src={state.settings.logoUrl} alt="logo" className="h-8 w-auto object-contain" />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-[#282824] text-[#B69A68] flex items-center justify-center font-bold text-xs">
                      LH
                    </div>
                  )}
                  <div>
                    <h4 className="font-bold text-xs text-[#282824]">{state.settings.companyName}</h4>
                    <span className="text-[10px] text-[#68675F] block">{state.settings.companyNameEn}</span>
                  </div>
                </div>

                <button
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="p-2 text-[#68675F] hover:text-[#282824] rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation Links */}
              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-[#68675F] px-2 mb-2">أقسام البوابة</div>
                {navLinks.map(link => {
                  const IconComponent = iconMap[link.icon || ''] || Sparkles;
                  const isActive = activeSection === link.targetSectionId;
                  return (
                    <button
                      key={link.id}
                      onClick={() => {
                        setIsMobileDrawerOpen(false);
                        onScrollToSection(link.targetSectionId);
                      }}
                      className={`w-full flex items-center gap-3 py-3 px-3 rounded-xl text-xs font-semibold text-right transition-colors cursor-pointer ${
                        isActive ? 'bg-[#282824] text-white shadow-xs' : 'text-[#282824] hover:bg-[#F7F3EB]'
                      }`}
                    >
                      <IconComponent className={`w-4 h-4 ${isActive ? 'text-[#B69A68]' : 'text-[#68675F]'}`} />
                      <span>{link.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Account & Administration Section */}
              <div className="pt-4 border-t border-[#E3DCCD] space-y-2">
                <div className="text-[11px] font-semibold text-[#68675F] px-2 mb-2">الحساب والتشغيل</div>

                <button
                  onClick={() => {
                    setIsMobileDrawerOpen(false);
                    onOpenClientPortal();
                  }}
                  className="w-full flex items-center justify-between p-3 bg-[#F7F3EB] rounded-xl text-xs font-semibold text-[#282824] border border-[#E3DCCD] cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-[#B69A68]" />
                    <span>بوابة النزلاء وحجوزاتي</span>
                  </div>
                  <span className="text-[10px] text-[#B69A68]">دخول</span>
                </button>

                <button
                  onClick={() => {
                    setIsMobileDrawerOpen(false);
                    onOpenAdmin();
                  }}
                  className="w-full flex items-center gap-2 p-3 bg-white rounded-xl text-xs font-medium text-[#68675F] border border-[#E3DCCD] cursor-pointer hover:text-[#282824]"
                >
                  <Sliders className="w-4 h-4 text-[#B69A68]" />
                  <span>لوحة تحكم المشرفين</span>
                </button>

                <button
                  onClick={() => {
                    setIsMobileDrawerOpen(false);
                    onOpenStaffPwa();
                  }}
                  className="w-full flex items-center gap-2 p-3 bg-white rounded-xl text-xs font-medium text-[#68675F] border border-[#E3DCCD] cursor-pointer hover:text-[#282824]"
                >
                  <Smartphone className="w-4 h-4 text-[#B69A68]" />
                  <span>تطبيق طاقم العمل (PWA)</span>
                </button>
              </div>

            </div>

            {/* Drawer Footer */}
            <div className="p-4 bg-[#F7F3EB] border-t border-[#E3DCCD] text-center text-[10px] text-[#68675F]">
              <span>{state.settings.companyName} · جميع الحقوق محفوظة © 2026</span>
            </div>

          </div>
        </div>
      )}
    </>
  );
};
