import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, ArrowRight, Building2, ChevronDown, MapPin, Pause, Play, Sparkles } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { DEFAULT_HERO_CAROUSEL } from '../../data/heroCarousel';

interface HeroSectionProps {
  onExploreClick: () => void;
  onBuildingsClick: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onExploreClick, onBuildingsClick }) => {
  const { state } = useAppStore();
  const reduceMotion = useReducedMotion();
  const configuredSlides = (state.settings.themeConfig as any)?.heroCarousel?.slides;
  const slides = useMemo(() => {
    const source = Array.isArray(configuredSlides) ? configuredSlides : DEFAULT_HERO_CAROUSEL.slides;
    const visible = source.filter((slide: any) =>
      slide && slide.visible !== false && typeof slide.title === 'string' && slide.imageUrl
    );
    return visible.length ? visible : DEFAULT_HERO_CAROUSEL.slides.slice(0, 1);
  }, [configuredSlides]);
  const configuredDelay = Number((state.settings.themeConfig as any)?.heroCarousel?.autoplayMs);
  const delay = Number.isFinite(configuredDelay) ? Math.min(15000, Math.max(4000, configuredDelay)) : DEFAULT_HERO_CAROUSEL.autoplayMs;
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const slide = slides[activeIndex % slides.length];

  useEffect(() => setActiveIndex(0), [slides.length]);
  useEffect(() => {
    if (reduceMotion || paused || slides.length < 2) return;
    const timer = window.setInterval(() => setActiveIndex(index => (index + 1) % slides.length), delay);
    return () => window.clearInterval(timer);
  }, [delay, paused, reduceMotion, slides.length]);

  const selectSlide = (index: number) => setActiveIndex((index + slides.length) % slides.length);
  const titleParts = String(slide.title || '').split('\n');

  return (
    <section id="hero" className="relative isolate flex min-h-[660px] overflow-hidden bg-[#24231f] text-white sm:min-h-[720px] lg:min-h-[780px]" aria-roledescription="carousel" aria-label="وجهات الإقامة">
      <AnimatePresence initial={false}>
        <motion.div
          key={slide.id}
          className="absolute inset-0 -z-10"
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 1.15, ease: [0.22, 1, 0.36, 1] }}
        >
          <img src={slide.imageUrl} alt="" className="h-full w-full object-cover" fetchPriority="high" />
          <div className="absolute inset-0" style={{ background: `linear-gradient(90deg, rgba(20,20,18,${slide.overlayOpacity ?? 0.64}) 0%, rgba(20,20,18,.42) 55%, rgba(20,20,18,.18) 100%), linear-gradient(0deg, rgba(20,20,18,.55), transparent 55%)` }} />
        </motion.div>
      </AnimatePresence>

      <div className="relative mx-auto flex w-full max-w-7xl items-center px-5 pb-32 pt-20 sm:px-8 lg:px-12">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={slide.id}
            className="max-w-3xl"
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -10 }}
            transition={{ duration: reduceMotion ? 0 : 0.65, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/25 bg-black/20 px-4 py-2 text-sm text-white/90 backdrop-blur-md">
              <Sparkles className="h-4 w-4" style={{ color: slide.accentColor || '#C8A96B' }} />
              <span>{slide.badge}</span>
            </div>
            <div className="mb-5 flex items-center gap-2 text-sm font-medium tracking-wide text-white/80">
              <MapPin className="h-4 w-4" style={{ color: slide.accentColor || '#C8A96B' }} />
              <span>{slide.location}</span>
            </div>
            <motion.h1
              className="mb-6 whitespace-pre-line text-4xl font-semibold leading-[1.25] tracking-tight sm:text-6xl lg:text-7xl"
              style={{ textWrap: 'balance' }}
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduceMotion ? 0 : 0.12, duration: reduceMotion ? 0 : 0.7 }}
            >
              {titleParts.map((part: string, index: number) => (
                <React.Fragment key={index}>{part}{index < titleParts.length - 1 && <br />}</React.Fragment>
              ))}
            </motion.h1>
            <motion.p
              className="mb-9 max-w-2xl text-base leading-8 text-white/80 sm:text-lg"
              initial={reduceMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduceMotion ? 0 : 0.25, duration: reduceMotion ? 0 : 0.65 }}
            >
              {slide.description}
            </motion.p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button onClick={onExploreClick} className="inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 font-semibold text-[#282824] transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ backgroundColor: slide.accentColor || '#C8A96B' }}>
                <span>{slide.primaryLabel || 'اكتشف الوحدات'}</span><ChevronDown className="h-4 w-4" />
              </button>
              <button onClick={onBuildingsClick} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/35 bg-white/10 px-7 py-3.5 font-semibold text-white backdrop-blur transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
                <Building2 className="h-4 w-4" /><span>{slide.secondaryLabel || 'تعرّف على مبانينا'}</span>
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="absolute inset-x-0 bottom-0 mx-auto flex max-w-7xl items-end justify-between gap-6 px-5 pb-6 sm:px-8 lg:px-12">
        <div className="flex items-center gap-2" role="group" aria-label="اختيار الشريحة">
          {slides.map((item: any, index: number) => (
            <button key={item.id} type="button" onClick={() => selectSlide(index)} aria-label={`عرض الشريحة ${index + 1}: ${item.location}`} aria-current={index === activeIndex ? 'true' : undefined} className={`h-1.5 rounded-full transition-all duration-500 ${index === activeIndex ? 'w-12 bg-white' : 'w-5 bg-white/45 hover:bg-white/75'}`} />
          ))}
          <span className="ms-2 text-xs tabular-nums text-white/75" dir="ltr">{String(activeIndex + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}</span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setPaused(value => !value)} aria-label={paused ? 'تشغيل العرض' : 'إيقاف العرض'} className="rounded-full border border-white/30 bg-black/20 p-3 text-white backdrop-blur hover:bg-white/15">
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
          <button type="button" onClick={() => selectSlide(activeIndex - 1)} aria-label="الشريحة السابقة" className="rounded-full border border-white/30 bg-black/20 p-3 text-white backdrop-blur hover:bg-white/15"><ArrowRight className="h-4 w-4" /></button>
          <button type="button" onClick={() => selectSlide(activeIndex + 1)} aria-label="الشريحة التالية" className="rounded-full border border-white/30 bg-black/20 p-3 text-white backdrop-blur hover:bg-white/15"><ArrowLeft className="h-4 w-4" /></button>
        </div>
      </div>
    </section>
  );
};
