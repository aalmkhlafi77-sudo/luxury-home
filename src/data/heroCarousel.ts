import type { HeroCarouselConfig } from '../types';

export const DEFAULT_HERO_CAROUSEL: HeroCarouselConfig = {
  autoplayMs: 7000,
  slides: [
    {
      id: 'hero-riyadh',
      badge: 'إقامة راقية في قلب المملكة',
      location: 'الرياض',
      title: 'مساحة تنتمي إليك،\nوتفاصيل تليق بك',
      description: 'اكتشف أجنحة سكنية فاخرة تجمع هدوء المنزل بخدمة ضيافة استثنائية، في مواقع مختارة بعناية.',
      imageUrl: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=2200&q=88',
      primaryLabel: 'اكتشف الوحدات',
      secondaryLabel: 'تعرّف على مبانينا',
      accentColor: '#C8A96B',
      overlayOpacity: 0.64,
      visible: true
    },
    {
      id: 'hero-jeddah',
      badge: 'واجهة البحر وأسلوب حياة مختلف',
      location: 'جدة',
      title: 'رفاهية هادئة،\nعلى إيقاع البحر',
      description: 'إقامة مرنة وتجربة ضيافة مصممة لتمنحك الراحة والخصوصية في أجمل وجهات جدة.',
      imageUrl: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=2200&q=88',
      primaryLabel: 'اكتشف الوحدات',
      secondaryLabel: 'تعرّف على مبانينا',
      accentColor: '#C8A96B',
      overlayOpacity: 0.64,
      visible: true
    },
    {
      id: 'hero-dammam',
      badge: 'إقامة تلائم أعمالك وراحتك',
      location: 'الدمام',
      title: 'حين تجتمع الراحة\nبأناقة التفاصيل',
      description: 'اختر إقامتك اليومية أو الشهرية أو السنوية، واستمتع بمساحات متكاملة وخدمات موثوقة.',
      imageUrl: 'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=2200&q=88',
      primaryLabel: 'اكتشف الوحدات',
      secondaryLabel: 'تعرّف على مبانينا',
      accentColor: '#C8A96B',
      overlayOpacity: 0.64,
      visible: true
    }
  ]
};
