import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';
import { useAppStore } from './store/useAppStore';
import { Header } from './components/common/Header';
import { Footer } from './components/common/Footer';
import { MobileBottomNav } from './components/common/MobileBottomNav';
import { HeroSection } from './components/public/HeroSection';
import { FloatingBookingBar } from './components/public/FloatingBookingBar';
import { BuildingsCarousel } from './components/public/BuildingsCarousel';
import { FeaturedUnitsCarousel } from './components/public/FeaturedUnitsCarousel';
import { SpecialOffersBanner } from './components/public/SpecialOffersBanner';
import { AmenitiesSection } from './components/public/AmenitiesSection';
import { BookingStepsSection } from './components/public/BookingStepsSection';
import { FaqSection } from './components/public/FaqSection';
import { ContactSection } from './components/public/ContactSection';
import { BuildingDetailModal } from './components/details/BuildingDetailModal';
import { UnitDetailModal } from './components/details/UnitDetailModal';
import { BookingCheckoutModal } from './components/checkout/BookingCheckoutModal';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { StaffPwaApp } from './components/pwa/StaffPwaApp';
import { ClientPortalModal } from './components/client/ClientPortalModal';
import { Property, Unit, Booking } from './types';

export default function App() {
  const { state, searchAvailableUnits } = useAppStore();

  // Root view mode: 'public' | 'admin' | 'staff_pwa'
  const [viewMode, setViewMode] = useState<'public' | 'admin' | 'staff_pwa'>('public');

  // Navigation & Active Section State
  const [activeSection, setActiveSection] = useState<string>('hero');
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleScrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  // Search Bar State
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultStart = tomorrow.toISOString().slice(0, 10);

  const nextWeek = new Date(tomorrow);
  nextWeek.setDate(nextWeek.getDate() + 3);
  const defaultEnd = nextWeek.toISOString().slice(0, 10);

  const [selectedCityId, setSelectedCityId] = useState<string>('all');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('all');
  const [rentalType, setRentalType] = useState<'daily' | 'monthly' | 'yearly'>('daily');
  const [annualPaymentTerms, setAnnualPaymentTerms] = useState<'single' | 'semi_annual'>('single');
  const [startDate, setStartDate] = useState<string>(defaultStart);
  const [endDate, setEndDate] = useState<string>(defaultEnd);
  const [monthsCount, setMonthsCount] = useState<number>(1);
  const [guestsCount, setGuestsCount] = useState<number>(1);

  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [filteredUnitsList, setFilteredUnitsList] = useState<Unit[] | undefined>(undefined);

  // Modals state
  const [activePropertyModal, setActivePropertyModal] = useState<Property | null>(null);
  const [activeUnitModal, setActiveUnitModal] = useState<Unit | null>(null);
  
  const [checkoutData, setCheckoutData] = useState<{
    unit: Unit;
    dates: {
      checkIn: string;
      checkOut: string;
      guests: number;
      rentalType: 'daily' | 'monthly' | 'yearly';
      annualPaymentTerms?: 'single' | 'semi_annual';
    };
  } | null>(null);

  const [isClientPortalOpen, setIsClientPortalOpen] = useState(false);
  const [clientPortalBookingNumber, setClientPortalBookingNumber] = useState<string | undefined>(undefined);

  // IntersectionObserver to observe active section while scrolling
  useEffect(() => {
    if (viewMode !== 'public') return;

    const sections = ['hero', 'search_bar', 'buildings', 'units', 'amenities', 'faq', 'contact'];
    const observerOptions = {
      root: null,
      rootMargin: '-20% 0px -60% 0px',
      threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    }, observerOptions);

    sections.forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [viewMode]);

  // Handle Search Execution
  const handlePerformSearch = () => {
    let computedEnd = endDate;
    if (rentalType === 'monthly') {
      const d = new Date(`${startDate}T15:00:00`);
      d.setMonth(d.getMonth() + monthsCount);
      computedEnd = d.toISOString().slice(0, 10);
    } else if (rentalType === 'yearly') {
      const d = new Date(`${startDate}T15:00:00`);
      d.setFullYear(d.getFullYear() + 1);
      d.setDate(d.getDate() - 1);
      computedEnd = d.toISOString().slice(0, 10);
    }

    const available = searchAvailableUnits({
      cityId: selectedCityId !== 'all' ? selectedCityId : undefined,
      propertyId: selectedPropertyId,
      rentalType,
      startDate,
      endDate: computedEnd,
      guestsCount,
    });

    setFilteredUnitsList(available);
    setHasSearched(true);

    handleScrollTo('units');
  };

  // Scroll to Section with Header Height Offset so title is completely visible
  const handleScrollTo = (sectionId: string) => {
    setActiveSection(sectionId);
    const el = document.getElementById(sectionId);
    if (el) {
      const headerHeight = state.settings.navigation?.headerHeightPx || 80;
      const elementPosition = el.getBoundingClientRect().top + window.pageYOffset;
      const offsetPosition = elementPosition - (headerHeight + 16); // 16px buffer
      
      window.scrollTo({
        top: Math.max(0, offsetPosition),
        behavior: 'smooth'
      });
    }
  };

  // Direct Book Button Click from unit card
  const handleDirectBookUnit = (unit: Unit) => {
    let computedEnd = endDate;
    if (rentalType === 'monthly') {
      const d = new Date(`${startDate}T15:00:00`);
      d.setMonth(d.getMonth() + monthsCount);
      computedEnd = d.toISOString().slice(0, 10);
    } else if (rentalType === 'yearly') {
      const d = new Date(`${startDate}T15:00:00`);
      d.setFullYear(d.getFullYear() + 1);
      d.setDate(d.getDate() - 1);
      computedEnd = d.toISOString().slice(0, 10);
    }

    setCheckoutData({
      unit,
      dates: {
        checkIn: startDate,
        checkOut: computedEnd,
        guests: guestsCount,
        rentalType,
        annualPaymentTerms,
      }
    });
  };

  // Handle booking completed
  const handleBookingCompleted = (booking: Booking) => {
    setClientPortalBookingNumber(booking.bookingNumber);
    setIsClientPortalOpen(true);
  };

  // If Admin mode is active
  if (viewMode === 'admin') {
    return (
      <AdminDashboard onBackToSite={() => setViewMode('public')} />
    );
  }

  // If Staff PWA mode is active
  if (viewMode === 'staff_pwa') {
    return (
      <StaffPwaApp onBackToSite={() => setViewMode('public')} />
    );
  }

  return (
    <div
      className="min-h-screen text-[#282824] flex flex-col font-sans selection:bg-[#B69A68]/20 text-right pb-20 md:pb-0 relative transition-colors duration-200"
      style={{ backgroundColor: state.settings.theme?.pageBg || '#FAF8F5' }}
    >
      
      {/* 1. Glass Header */}
      <Header
        className="sticky top-0 z-50 bg-[#F7F3EB] shadow-sm"
        activeSection={activeSection}
        onOpenClientPortal={() => setIsClientPortalOpen(true)}
        onOpenAdmin={() => setViewMode('admin')}
        onOpenStaffPwa={() => setViewMode('staff_pwa')}
        onScrollToSection={handleScrollTo}
        isMobileDrawerOpen={isMobileDrawerOpen}
        setIsMobileDrawerOpen={setIsMobileDrawerOpen}
      />

      {/* Main Public Website Sections */}
      <main className="flex-1" style={{ paddingTop: 'var(--site-header-height)' }}>
        
        {/* 2. Hero Section */}
        <HeroSection
          onExploreClick={() => handleScrollTo('units')}
          onBuildingsClick={() => handleScrollTo('buildings')}
        />

        {/* 3. Floating Wide Booking Bar */}
        <FloatingBookingBar
          selectedCityId={selectedCityId}
          onCityChange={(cId) => setSelectedCityId(cId)}
          selectedPropertyId={selectedPropertyId}
          onPropertyChange={(id) => setSelectedPropertyId(id)}
          rentalType={rentalType}
          onRentalTypeChange={(type) => setRentalType(type)}
          annualPaymentTerms={annualPaymentTerms}
          onAnnualPaymentTermsChange={(terms) => setAnnualPaymentTerms(terms)}
          startDate={startDate}
          onStartDateChange={(d) => setStartDate(d)}
          endDate={endDate}
          onEndDateChange={(d) => setEndDate(d)}
          monthsCount={monthsCount}
          onMonthsCountChange={(m) => setMonthsCount(m)}
          guestsCount={guestsCount}
          onGuestsCountChange={(g) => setGuestsCount(g)}
          onSearch={handlePerformSearch}
          availableCount={hasSearched ? filteredUnitsList?.length : undefined}
        />

        {/* 4. Buildings Carousel & Showcase */}
        <BuildingsCarousel
          onSelectProperty={(prop) => setActivePropertyModal(prop)}
        />

        {/* 5. Featured Units Grid / Carousel */}
        <FeaturedUnitsCarousel
          filteredUnits={filteredUnitsList}
          rentalType={rentalType}
          onSelectUnit={(unit) => setActiveUnitModal(unit)}
          onBookUnit={handleDirectBookUnit}
        />

        {/* 6. Special Offers Wide Banner */}
        <SpecialOffersBanner
          onContactClick={() => handleScrollTo('contact')}
        />

        {/* 7. Hotel Amenities & Services */}
        <AmenitiesSection />

        {/* 8. 3-Step Booking Journey */}
        <BookingStepsSection />

        {/* 9. FAQs Accordion */}
        <FaqSection />

        {/* 10. Contact & Inquiries Section */}
        <ContactSection />

      </main>

      {/* 11. Refined Quiet Footer */}
      <Footer
        onScrollToSection={handleScrollTo}
        onOpenAdmin={() => setViewMode('admin')}
        onOpenStaffPwa={() => setViewMode('staff_pwa')}
      />

      {/* MODAL 1: Building Detail Modal */}
      {activePropertyModal && (
        <BuildingDetailModal
          property={activePropertyModal}
          onClose={() => setActivePropertyModal(null)}
          onSelectUnit={(unit) => {
            setActivePropertyModal(null);
            setActiveUnitModal(unit);
          }}
          onBookUnit={(unit) => {
            setActivePropertyModal(null);
            handleDirectBookUnit(unit);
          }}
        />
      )}

      {/* MODAL 2: Unit Detail Modal */}
      {activeUnitModal && (
        <UnitDetailModal
          unit={activeUnitModal}
          initialCheckIn={startDate}
          initialCheckOut={endDate}
          initialRentalType={rentalType}
          onClose={() => setActiveUnitModal(null)}
          onProceedToCheckout={(unit, dates) => {
            setActiveUnitModal(null);
            setCheckoutData({ unit, dates });
          }}
        />
      )}

      {/* MODAL 3: Multi-step Booking Checkout */}
      {checkoutData && (
        <BookingCheckoutModal
          unit={checkoutData.unit}
          dates={checkoutData.dates}
          onClose={() => setCheckoutData(null)}
          onBookingComplete={handleBookingCompleted}
        />
      )}

      {/* MODAL 4: Client Portal Modal */}
      {isClientPortalOpen && (
        <ClientPortalModal
          defaultBookingNumber={clientPortalBookingNumber}
          onClose={() => setIsClientPortalOpen(false)}
        />
      )}

      {/* 12. Mobile Bottom Navigation Bar */}
      <MobileBottomNav
        activeSection={activeSection}
        onScrollToSection={handleScrollTo}
        onOpenClientPortal={() => setIsClientPortalOpen(true)}
        onOpenAccount={() => setIsClientPortalOpen(true)}
        onOpenMoreMenu={() => setIsMobileDrawerOpen(true)}
        isVisible={viewMode === 'public'}
      />

      {/* 13. Floating Back to Top Button */}
      {showScrollTop && viewMode === 'public' && (
        <button
          onClick={handleScrollToTop}
          className="fixed bottom-24 md:bottom-8 left-6 md:left-8 z-30 p-3.5 rounded-full bg-[#282824] hover:bg-[#1a1a18] text-[#B69A68] hover:text-[#FFFCF6] shadow-xl border border-[#E3DCCD]/25 transition-all duration-300 animate-in fade-in zoom-in-75 cursor-pointer focus-visible:ring-2 focus-visible:ring-[#B69A68] outline-none motion-reduce:transition-none"
          aria-label="العودة إلى أعلى الصفحة"
          title="العودة إلى أعلى الصفحة"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}

    </div>
  );
}
