import type { OfferCarouselConfig, Property } from '../types';

export const DEFAULT_OFFER_COPY = {
  badge: 'عرض الأعمال وعقود السكن الطويلة للشركات',
  title: 'خصم يصل حتى ٢٠٪ على إقامات الأعمال الطويلة',
  description: 'احصل على خصومات حصرية للإقامات الممتدة وعقود الإيجار السنوية تشمل خدمات التدبير المنزلي المتكاملة وبدون فواتير كهرباء أو خدمات إضافية.',
  buttonLabel: 'تواصل مع الكونسيرج للحجز التعاقدي',
};

export function createDefaultOfferCarousel(
  properties: readonly Property[],
  legacy: { imageUrl?: string | null; title?: string | null; description?: string | null } = {},
): OfferCarouselConfig {
  const seen = new Set<string>();
  const slides = properties
    .filter(property => property.status === 'published')
    .flatMap(property => {
      const images = (property.media || []).filter(media => media.type === 'image' && Boolean(media.url?.trim()));
      const image = images.find(media => media.isCover) || images[0];
      if (!image || seen.has(image.url)) return [];
      seen.add(image.url);
      return [{
        id: `property-${property.id}`,
        label: [property.city, property.name].filter(Boolean).join(' · ') || property.nameEn,
        imageUrl: image.url,
        visible: true,
      }];
    })
    .slice(0, 8);

  if (slides.length === 0) {
    const fallbackImage = legacy.imageUrl?.trim()
      || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=80';
    slides.push({
      id: 'offer-building-default',
      label: 'عروض الإقامة',
      imageUrl: fallbackImage,
      visible: true,
    });
  }

  return {
    ...DEFAULT_OFFER_COPY,
    title: legacy.title?.trim() || DEFAULT_OFFER_COPY.title,
    description: legacy.description?.trim() || DEFAULT_OFFER_COPY.description,
    autoplayMs: 6500,
    slides,
  };
}

export function getOfferCarouselPosition(activeIndex: number, slideIndex: number, slideCount: number): -1 | 0 | 1 | null {
  if (slideCount <= 0 || activeIndex < 0 || activeIndex >= slideCount || slideIndex < 0 || slideIndex >= slideCount) return null;
  if (activeIndex === slideIndex) return 0;
  const forward = (slideIndex - activeIndex + slideCount) % slideCount;
  const backward = forward - slideCount;
  const distance = Math.abs(forward) <= Math.abs(backward) ? forward : backward;
  return distance === -1 ? -1 : distance === 1 ? 1 : null;
}
