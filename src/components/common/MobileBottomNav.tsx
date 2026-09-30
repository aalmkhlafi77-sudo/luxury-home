import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import {
  Home,
  Building2,
  Sparkles,
  CalendarDays,
  User,
  Menu,
  Phone,
  HelpCircle,
  ConciergeBell,
  Sliders,
  Smartphone
} from 'lucide-react';

interface MobileBottomNavProps {
  activeSection: string;
  onScrollToSection: (sectionId: string) => void;
  onOpenClientPortal: (defaultBookingNumber?: string) => void;
  onOpenAccount: () => void;
  onOpenMoreMenu: () => void;
  isVisible: boolean;
}

const iconMap: Record<string, React.FC<{ className?: string }>> = {
  Home,
  Building2,
  Sparkles,
  CalendarDays,
  User,
  Menu,
  Phone,
  HelpCircle,
  ConciergeBell,
  Sliders,
  Smartphone
};

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeSection,
  onScrollToSection,
  onOpenClientPortal,
  onOpenAccount,
  onOpenMoreMenu,
  isVisible
}) => {
  const { state } = useAppStore();

  if (!isVisible) return null;

  const navConfig = state.settings.navigation;
  if (navConfig?.enableBottomNav === false) return null;

  const items = navConfig?.bottomNavItems || [
    { id: 'bnav_home', label: 'الرئيسية', type: 'section', targetSectionId: 'hero', icon: 'Home', visible: true, order: 1 },
    { id: 'bnav_units', label: 'الوحدات', type: 'section', targetSectionId: 'units', icon: 'Sparkles', visible: true, order: 2 },
    { id: 'bnav_bookings', label: 'حجوزاتي', type: 'my_bookings', icon: 'CalendarDays', visible: true, order: 3 },
    { id: 'bnav_account', label: 'حسابي', type: 'account', icon: 'User', visible: true, order: 4 },
    { id: 'bnav_more', label: 'المزيد', type: 'more', icon: 'Menu', visible: true, order: 5 },
  ];

  const visibleItems = [...items]
    .filter(i => i.visible)
    .sort((a, b) => a.order - b.order)
    .slice(0, 5);

  const handleClickItem = (item: typeof items[0]) => {
    if (item.type === 'section' && item.targetSectionId) {
      onScrollToSection(item.targetSectionId);
    } else if (item.type === 'my_bookings') {
      // Check if client has active booking or login
      onOpenClientPortal();
    } else if (item.type === 'account') {
      onOpenAccount();
    } else if (item.type === 'more') {
      onOpenMoreMenu();
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden pointer-events-auto">
      <nav 
        className="w-full glass-ivory border-t border-[#E3DCCD] bg-[#FFFCF6]/95 backdrop-blur-md px-2 pt-2 shadow-2xl flex items-center justify-around"
        style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
        aria-label="التنقل السفلي للهواتف"
      >
        {visibleItems.map(item => {
          const IconComp = iconMap[item.icon] || Home;
          
          let isActive = false;
          if (item.type === 'section' && item.targetSectionId) {
            isActive = activeSection === item.targetSectionId;
          }

          return (
            <button
              key={item.id}
              onClick={() => handleClickItem(item as any)}
              className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-1.5 rounded-xl transition-all cursor-pointer relative ${
                isActive ? 'text-[#B69A68] font-bold' : 'text-[#68675F] hover:text-[#282824]'
              }`}
            >
              {/* Active Dot / Indicator */}
              {isActive && (
                <span className="absolute -top-1 w-1.5 h-1.5 rounded-full bg-[#B69A68] animate-pulse" />
              )}
              
              <IconComp className={`w-5 h-5 transition-transform ${isActive ? 'scale-110 text-[#B69A68]' : 'text-[#68675F]'}`} />
              <span className="text-[10px] leading-tight mt-1 whitespace-nowrap tracking-tight">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
