import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { ImageWithFallback } from '../common/ImageWithFallback';
import { ChevronDown, Sparkles, Building } from 'lucide-react';

interface HeroSectionProps {
  onExploreClick: () => void;
  onBuildingsClick: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onExploreClick,
  onBuildingsClick,
}) => {
  const { state } = useAppStore();
  const heroSection = state.contentSections.find(s => s.sectionKey === 'hero');

  const title = heroSection?.title || 'اكتشف أرقى مستويات المعيشة الفندقية الفاخرة في قلب الرياض';
  const subtitle = heroSection?.subtitle || 'شقق وأجنحة سكنية مفروشة بالكامل تدمج بسلاسة تامة بين دفء وخصوصية المنزل وخدمات الضيافة الفندقية المتكاملة الراقية، في أكثر الأحياء جاذبية في العاصمة.';
  const bgImage = heroSection?.mediaUrl || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1920&q=85';

  return (
    <section id="hero" className="relative min-h-[640px] lg:min-h-[720px] flex items-center justify-center overflow-hidden">
      {/* Background Media with Measured Scrim */}
      <div className="absolute inset-0 z-0">
        <ImageWithFallback
          src={bgImage}
          alt="صورة خلفية ترحيبية فاخرة لـ Luxury home منزل الفخامة"
          className="w-full h-full object-cover scale-105 transform motion-safe:transition-transform duration-1000"
        />
        {/* Anti-AI Slop Scrim: measured gradient for WCAG contrast without muddying colors */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#282824]/90 via-[#282824]/50 to-[#282824]/30" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white pt-12 pb-24">
        
        {/* Quiet Subtitle Marker */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs sm:text-sm font-medium text-[#FFFCF6] mb-6 select-none">
          <Sparkles className="w-3.5 h-3.5 text-[#B69A68]" />
          <span>بوابة السكن المترف والضيافة الراقية بالمملكة</span>
        </div>

        {/* Display Headline with Balance Wrapping */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-6 leading-tight max-w-4xl mx-auto" style={{ textWrap: 'balance' }}>
          {title}
        </h1>

        {/* Lead Paragraph */}
        <p className="text-base sm:text-xl text-[#FFFCF6]/85 max-w-2xl mx-auto mb-10 leading-relaxed font-normal">
          {subtitle}
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={onExploreClick}
            className="w-full sm:w-auto px-8 py-3.5 text-sm sm:text-base font-semibold text-[#282824] bg-[#FFFCF6] hover:bg-[#EFE9DF] rounded-xl shadow-lg transition-all duration-200 hover:scale-[1.02] flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
          >
            <span>استعرض الشقق المتاحة</span>
            <ChevronDown className="w-4 h-4 text-[#B69A68]" />
          </button>
          
          <button
            onClick={onBuildingsClick}
            className="w-full sm:w-auto px-6 py-3.5 text-sm sm:text-base font-medium text-white bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/25 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
          >
            <Building className="w-4 h-4 text-[#B69A68]" />
            <span>مشروعاتنا وأبراجنا الفندقية</span>
          </button>
        </div>

        {/* Trust Markers */}
        <div className="mt-14 pt-8 border-t border-white/15 grid grid-cols-3 gap-4 max-w-xl mx-auto text-xs text-white/80">
          <div>
            <span className="block text-xl sm:text-2xl font-bold text-white tabular-nums">٢</span>
            <span>وجهة متميزة في الرياض</span>
          </div>
          <div>
            <span className="block text-xl sm:text-2xl font-bold text-white tabular-nums">١٠٠٪</span>
            <span>نسبة إشغال وخدمة ممتازة</span>
          </div>
          <div>
            <span className="block text-xl sm:text-2xl font-bold text-white tabular-nums">٢٤/٧</span>
            <span>خدمة غرف وكونسيرج رقمي</span>
          </div>
        </div>

      </div>
    </section>
  );
};
