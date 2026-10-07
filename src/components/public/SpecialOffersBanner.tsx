import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarRange, Sparkles } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { createDefaultOfferCarousel, getOfferCarouselPosition } from '../../data/offerCarousel';
import type { OfferCarouselConfig, OfferCarouselSlide } from '../../types';
import { ImageWithFallback } from '../common/ImageWithFallback';

interface SpecialOffersBannerProps {
  onContactClick: () => void;
}

export const SpecialOffersBanner: React.FC<SpecialOffersBannerProps> = ({ onContactClick }) => {
  const { state } = useAppStore();
  const sectionMeta = state.contentSections.find(item => item.sectionKey === 'offers');
  const saved = (state.settings.themeConfig as any)?.offersCarousel as OfferCarouselConfig | undefined;
  const defaults = useMemo(() => createDefaultOfferCarousel(state.properties, {
    imageUrl: sectionMeta?.mediaUrl,
    title: sectionMeta?.title,
    description: sectionMeta?.subtitle,
  }), [state.properties, sectionMeta?.mediaUrl, sectionMeta?.title, sectionMeta?.subtitle]);
  const config = saved || defaults;
  const slides = config.slides.filter(slide => slide.visible && slide.imageUrl?.trim());
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => setActiveIndex(index => slides.length ? index % slides.length : 0), [slides.length]);
  useEffect(() => {
    if (paused || slides.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setActiveIndex(index => (index + 1) % slides.length), config.autoplayMs || 6500);
    return () => window.clearInterval(timer);
  }, [config.autoplayMs, paused, slides.length]);

  if (sectionMeta && !sectionMeta.visible) return null;
  if (!slides.length) return null;

  const navigate = (direction: -1 | 1) => setActiveIndex(index => (index + direction + slides.length) % slides.length);
  const field = (name: keyof OfferCarouselConfig, fallback: string) => {
    const value = config[name];
    return typeof value === 'string' && value.trim() ? value : fallback;
  };

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8" aria-label="العروض الخاصة">
      <div
        className="relative overflow-hidden rounded-[2rem] bg-[#211F1B] px-2 py-10 shadow-xl sm:px-8 sm:py-14"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false); }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(182,154,104,0.18),transparent_65%)]" />
        <div className="relative mx-auto h-[440px] max-w-6xl sm:h-[500px]" aria-live="polite">
          {slides.map((slide, index) => {
            const position = getOfferCarouselPosition(activeIndex, index, slides.length);
            if (position === null) return null;
            const active = position === 0;
            const style: React.CSSProperties = {
              zIndex: active ? 30 : 20,
              opacity: active ? 1 : 0.64,
              transform: position === 0
                ? 'translate(-50%, -50%) scale(1) rotateY(0deg)'
                : position < 0
                  ? 'translate(calc(-50% - 27%), -50%) scale(.78) rotateY(15deg)'
                  : 'translate(calc(-50% + 27%), -50%) scale(.78) rotateY(-15deg)',
              filter: active ? 'none' : 'saturate(.72) brightness(.72)',
              pointerEvents: active ? 'auto' : 'auto',
            };
            const cardClass = `absolute left-1/2 top-1/2 block h-[360px] w-[88%] overflow-hidden rounded-3xl border border-white/15 text-right shadow-2xl transition-[transform,opacity,filter] duration-700 ease-[cubic-bezier(.2,.75,.25,1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C8A96B] sm:h-[420px] sm:w-[72%] ${active ? 'cursor-default' : 'cursor-pointer'}`;
            const cardContent = (
              <>
                <ImageWithFallback src={slide.imageUrl} alt={slide.label} className="absolute inset-0 h-full w-full object-cover" />
                <div className={`absolute inset-0 ${active ? 'bg-gradient-to-t from-[#161512]/95 via-[#161512]/30 to-transparent' : 'bg-gradient-to-t from-[#161512]/80 via-transparent to-[#161512]/10'}`} />
                <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-9">
                  {active ? (
                    <>
                      <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#C8A96B]/50 bg-black/25 px-3 py-1.5 text-xs font-semibold text-[#FFF9EC] backdrop-blur-sm">
                        <Sparkles className="h-3.5 w-3.5 text-[#C8A96B]" />{field('badge', 'عرض خاص')}
                      </span>
                      <p className="mb-2 text-xs text-white/80">{slide.label}</p>
                      <h2 className="mb-3 max-w-2xl text-2xl font-bold leading-tight sm:text-4xl">{field('title', defaults.title)}</h2>
                      <p className="mb-6 max-w-2xl text-sm leading-7 text-white/85 sm:text-base">{field('description', defaults.description)}</p>
                      <button
                        type="button"
                        onClick={onContactClick}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#B69A68] px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-[#a68a58]"
                      >
                        <CalendarRange className="h-4 w-4" />{field('buttonLabel', defaults.buttonLabel)}<ArrowLeft className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <span className="inline-flex items-center rounded-full border border-white/20 bg-black/35 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur-sm">{slide.label}</span>
                  )}
                </div>
              </>
            );
            return active ? (
              <div key={slide.id} role="group" aria-label={`العرض الحالي: ${slide.label}`} className={cardClass} style={style}>
                {cardContent}
              </div>
            ) : (
              <button
                key={slide.id}
                type="button"
                aria-label={`عرض ${slide.label}`}
                onClick={() => setActiveIndex(index)}
                className={cardClass}
                style={style}
              >
                {cardContent}
              </button>
            )
          })}
        </div>

        {slides.length > 1 && (
          <div className="relative z-40 mt-2 flex items-center justify-center gap-4">
            <button type="button" aria-label="العرض السابق" onClick={() => navigate(-1)} className="rounded-full border border-white/20 p-3 text-white transition hover:border-[#C8A96B] hover:text-[#C8A96B]"><ArrowRight className="h-5 w-5" /></button>
            <div className="flex items-center gap-2">
              {slides.map((slide, index) => <button key={slide.id} type="button" aria-label={`الانتقال إلى ${slide.label}`} aria-current={index === activeIndex ? 'true' : undefined} onClick={() => setActiveIndex(index)} className={`h-2.5 rounded-full transition-all ${index === activeIndex ? 'w-8 bg-[#C8A96B]' : 'w-2.5 bg-white/45 hover:bg-white'}`} />)}
            </div>
            <button type="button" aria-label="العرض التالي" onClick={() => navigate(1)} className="rounded-full border border-white/20 p-3 text-white transition hover:border-[#C8A96B] hover:text-[#C8A96B]"><ArrowLeft className="h-5 w-5" /></button>
          </div>
        )}
      </div>
    </section>
  );
};
