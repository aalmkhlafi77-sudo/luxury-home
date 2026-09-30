import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { ImageWithFallback } from '../common/ImageWithFallback';
import { Sparkles, CalendarRange, ArrowLeft } from 'lucide-react';

interface SpecialOffersBannerProps {
  onContactClick: () => void;
}

export const SpecialOffersBanner: React.FC<SpecialOffersBannerProps> = ({
  onContactClick,
}) => {
  const { state } = useAppStore();
  const sectionMeta = state.contentSections.find(s => s.sectionKey === 'offers');

  if (sectionMeta && !sectionMeta.visible) return null;

  const bgImage = sectionMeta?.mediaUrl || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=80';

  return (
    <section className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="relative rounded-3xl overflow-hidden shadow-xl border border-[#E3DCCD]">
        {/* Background Frame */}
        <div className="absolute inset-0">
          <ImageWithFallback
            src={bgImage}
            alt="صورة عروض السكن الخاصة"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#282824]/95 via-[#282824]/80 to-[#282824]/50" />
        </div>

        {/* Text Area */}
        <div className="relative z-10 p-8 sm:p-14 max-w-2xl text-white">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#B69A68]/30 border border-[#B69A68]/40 text-xs font-semibold text-[#FFFCF6] mb-4 select-none">
            <Sparkles className="w-3.5 h-3.5 text-[#B69A68]" />
            <span>عرض الأعمال وعقود السكن الطويلة للشركات</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-bold tracking-tight mb-4 text-white leading-tight">
            {sectionMeta?.title || 'خصم يصل حتى ٢٠٪ على إقامات الأعمال الطويلة'}
          </h2>
          <p className="text-sm sm:text-base text-[#FFFCF6]/85 mb-8 leading-relaxed">
            {sectionMeta?.subtitle || 'احصل على خصومات حصرية للإقامات الممتدة وعقود الإيجار السنوية تشمل خدمات التدبير المنزلي المتكاملة وبدون فواتير كهرباء أو خدمات إضافية.'}
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <button
              onClick={onContactClick}
              className="px-6 py-3 bg-[#B69A68] hover:bg-[#a68a58] text-[#FFFCF6] font-semibold text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer hover:scale-[1.02]"
            >
              <CalendarRange className="w-4 h-4" />
              <span>تواصل مع الكونسيرج للحجز التعاقدي</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </section>
  );
};
