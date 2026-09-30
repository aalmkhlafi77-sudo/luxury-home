import React, { useState, useEffect } from 'react';
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

  // Search Bar State
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultStart = tomorrow.toISOString().slice(0, 10);

  const nextWeek = new Date(tomorrow);
  nextWeek.setDate(nextWeek.getDate() + 3);
  const defaultEnd = nextWeek.toISOString().slice(0, 10);

  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('all');
  const [rentalType, setRentalType] = useState<'daily' | 'monthly'>('daily');
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
    dates: { checkIn: string; checkOut: string; guests: number; rentalType: 'daily' | 'monthly' };
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
    }

    const available = searchAvailableUnits({
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
    }

    setCheckoutData({
      unit,
      dates: {
        checkIn: startDate,
        checkOut: computedEnd,
        guests: guestsCount,
        rentalType,
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
    <div className="min-h-screen bg-[#F7F3EB] text-[#282824] flex flex-col font-sans selection:bg-[#B69A68]/20 text-right pb-20 md:pb-0 relative">
      
      {/* 1. Glass Header */}
      <Header
        activeSection={activeSection}
        onOpenClientPortal={() => setIsClientPortalOpen(true)}
        onOpenAdmin={() => setViewMode('admin')}
        onOpenStaffPwa={() => setViewMode('staff_pwa')}
        onScrollToSection={handleScrollTo}
        isMobileDrawerOpen={isMobileDrawerOpen}
        setIsMobileDrawerOpen={setIsMobileDrawerOpen}
      />

      {/* Main Public Website Sections */}
      <main className="flex-1">
        
        {/* 2. Hero Section */}
        <HeroSection
          onExploreClick={() => handleScrollTo('units')}
          onBuildingsClick={() => handleScrollTo('buildings')}
        />

        {/* 3. Floating Wide Booking Bar */}
        <FloatingBookingBar
          selectedPropertyId={selectedPropertyId}
          onPropertyChange={(id) => setSelectedPropertyId(id)}
          rentalType={rentalType}
          onRentalTypeChange={(type) => setRentalType(type)}
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

    </div>
  );
}
