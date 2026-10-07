import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, ArrowRight, Building2, ChevronDown, MapPin, Pause, Play, Sparkles } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { DEFAULT_HERO_CAROUSEL, getHeroCarouselFrame } from '../../data/heroCarousel';

interface HeroSectionProps {
  onExploreClick: () => void;
  onBuildingsClick: () => void;
}

const heroEase = [0.22, 1, 0.36, 1] as const;
const previewCount = 4;

export const HeroSection: React.FC<HeroSectionProps> = ({ onExploreClick, onBuildingsClick }) => {
  const { state } = useAppStore();
  const reduceMotion = useReducedMotion();
  const configuredSlides = (state.settings.themeConfig as any)?.heroCarousel?.slides;
  const slides = useMemo(() => {
    const source = Array.isArray(configuredSlides) ? configuredSlides : DEFAULT_HERO_CAROUSEL.slides;
    const visible = source.filter((item: any) =>
      item && item.visible !== false && typeof item.title === 'string' && item.imageUrl
    );
    return visible.length ? visible : DEFAULT_HERO_CAROUSEL.slides.slice(0, 1);
  }, [configuredSlides]);

  const configuredDelay = Number((state.settings.themeConfig as any)?.heroCarousel?.autoplayMs);
  const delay = Number.isFinite(configuredDelay)
    ? Math.min(15000, Math.max(4000, configuredDelay))
    : DEFAULT_HERO_CAROUSEL.autoplayMs;
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const frame = getHeroCarouselFrame(slides, activeIndex, previewCount);
  const slide = frame.active;

  useEffect(() => setActiveIndex(0), [slides]);
  useEffect(() => {
    if (paused || slides.length < 2) return;
    const timer = window.setInterval(() => {
      setActiveIndex(index => (index + 1) % slides.length);
    }, delay);
    return () => window.clearInterval(timer);
  }, [delay, paused, slides.length]);

  if (!slide) return null;

  const changeSlide = (step: number) => {
    setActiveIndex(index => (index + step + slides.length) % slides.length);
  };
  const titleText = String(slide.title || '').replace(/\s+/g, ' ').trim();
  const motionDuration = reduceMotion ? 0 : 1.05;

  return (
    <section
      id="hero"
      className="relative isolate min-h-[780px] overflow-hidden bg-[#24231f] text-white sm:min-h-[820px] lg:min-h-[780px]"
      aria-roledescription="carousel"
      aria-label="وجهات الإقامة"
    >
      <LayoutGroup id="luxury-home-hero-carousel">
        <div className="absolute inset-0 z-0" aria-hidden="true">
          <AnimatePresence initial={false}>
            <motion.div
              key={slide.id}
              layoutId={`hero-image-${slide.id}`}
              className="absolute inset-0"
              initial={false}
              animate={{ borderRadius: 0 }}
              transition={{ layout: { duration: motionDuration, ease: heroEase }, borderRadius: { duration: motionDuration } }}
            >
              <img
                src={slide.imageUrl}
                alt=""
                className="block h-full w-full object-fill object-center"
                fetchPriority="high"
              />
            </motion.div>
          </AnimatePresence>
        </div>

        <motion.div
          className="pointer-events-none absolute inset-0 z-10"
          aria-hidden="true"
          animate={{ opacity: Number(slide.overlayOpacity ?? 0.64) / 0.8 }}
          transition={{ duration: motionDuration }}
          style={{
            background:
              'linear-gradient(270deg, rgba(20,20,18,.82) 0%, rgba(20,20,18,.53) 48%, rgba(20,20,18,.12) 100%), linear-gradient(0deg, rgba(20,20,18,.68), transparent 62%)',
          }}
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 mx-auto h-full max-w-none px-5 sm:px-8 lg:px-[5vw]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={slide.id}
              className="pointer-events-auto absolute inset-x-5 top-28 max-w-xl text-right sm:inset-x-8 sm:top-32 lg:inset-x-auto lg:right-[5vw] lg:left-auto lg:top-[16%] lg:w-[46vw] lg:max-w-[52rem]"
              dir="rtl"
              initial={reduceMotion ? false : { opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -12 }}
              transition={{ duration: reduceMotion ? 0 : 0.62, ease: heroEase }}
            >
              <div
                className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/25 bg-black/20 px-4 py-2 text-sm text-white/90 backdrop-blur-md"
              >
                <Sparkles className="h-4 w-4" style={{ color: slide.accentColor || '#C8A96B' }} />
                <span>{slide.badge}</span>
              </div>

              <div className="mb-3 flex items-center justify-start gap-2 text-sm font-medium tracking-wide text-white/80">
                <MapPin className="h-4 w-4" style={{ color: slide.accentColor || '#C8A96B' }} />
                <span>{slide.location}</span>
              </div>

              <h1
                className="mb-4 text-4xl font-semibold leading-[1.2] tracking-tight sm:text-5xl lg:mb-5 lg:text-6xl xl:text-7xl"
                style={{ textWrap: 'balance' }}
              >
                {titleText}
              </h1>

              <p className="mb-6 max-w-none text-sm leading-7 text-white/85 sm:text-base sm:leading-8 lg:mb-8 lg:max-w-[48rem] lg:text-lg">
                {slide.description}
              </p>

              <div className="flex flex-wrap justify-start gap-3">
                <button
                  onClick={onExploreClick}
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 font-semibold text-[#282824] transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:px-7 sm:py-3.5"
                  style={{ backgroundColor: slide.accentColor || '#C8A96B' }}
                >
                  <span>{slide.primaryLabel || 'اكتشف الوحدات'}</span>
                  <ChevronDown className="h-4 w-4" />
                </button>

                <button
                  onClick={onBuildingsClick}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/35 bg-white/10 px-6 py-3 font-semibold text-white backdrop-blur transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:px-7 sm:py-3.5"
                >
                  <Building2 className="h-4 w-4" />
                  <span>{slide.secondaryLabel || 'تعرّف على مبانينا'}</span>
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div
          className="absolute inset-x-0 bottom-[86px] z-30 mx-auto max-w-7xl overflow-hidden px-5 sm:px-8 lg:bottom-[92px] lg:px-12"
          dir="ltr"
          aria-hidden="true"
        >
          <div className="flex items-end justify-start gap-3 sm:gap-4 lg:gap-5">
            {frame.previews.map((item: any, index: number) => (
              <motion.article
                key={item.id}
                layout
                transition={{ layout: { duration: motionDuration, ease: heroEase } }}
                className="relative h-[178px] w-[132px] flex-none overflow-hidden rounded-2xl border border-white/20 bg-black/20 shadow-[0_18px_45px_rgba(0,0,0,.36)] sm:h-[224px] sm:w-[158px] lg:h-[260px] lg:w-[184px]"
                style={{ zIndex: previewCount - index }}
              >
                <motion.div
                  layoutId={`hero-image-${item.id}`}
                  className="absolute inset-0 overflow-hidden"
                  initial={false}
                  animate={{ borderRadius: 16 }}
                  transition={{ layout: { duration: motionDuration, ease: heroEase }, borderRadius: { duration: motionDuration } }}
                >
                  <img
                    src={item.imageUrl}
                    alt=""
                    className="block h-full w-full object-fill object-center"
                    loading="lazy"
                  />
                </motion.div>

                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3 text-right text-white sm:p-4" dir="rtl">
                  <span className="mb-1 block truncate text-[10px] font-medium text-white/80 sm:text-xs">{item.location}</span>
                  <strong className="block line-clamp-2 text-sm font-semibold leading-5 sm:text-base">{item.title}</strong>
                </div>
              </motion.article>
            ))}
          </div>
        </div>

        <div
          className="absolute inset-x-0 bottom-[104px] z-40 mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 sm:px-8 lg:px-12"
          dir="ltr"
        >
          <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-5">
            <span className="shrink-0 text-sm font-medium tabular-nums text-white/80" dir="ltr">
              {String(frame.activeIndex + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
            </span>
            <div className="h-[2px] max-w-[420px] flex-1 overflow-hidden bg-white/30">
              <motion.div
                key={slide.id}
                className="h-full origin-left"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: paused ? 0 : 1 }}
                transition={{ duration: reduceMotion || paused ? 0 : delay / 1000, ease: 'linear' }}
                style={{ backgroundColor: slide.accentColor || '#C8A96B' }}
              />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setPaused(value => !value)}
              aria-label={paused ? 'تشغيل العرض' : 'إيقاف العرض'}
              className="rounded-full border border-white/30 bg-black/20 p-2.5 text-white backdrop-blur transition hover:bg-white/15 sm:p-3"
            >
              {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => changeSlide(-1)}
              aria-label="الشريحة السابقة"
              className="rounded-full border border-white/30 bg-black/20 p-2.5 text-white backdrop-blur transition hover:bg-white/15 sm:p-3"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => changeSlide(1)}
              aria-label="الشريحة التالية"
              className="rounded-full border border-white/30 bg-black/20 p-2.5 text-white backdrop-blur transition hover:bg-white/15 sm:p-3"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          </div>
        </div>
      </LayoutGroup>
    </section>
  );
};
