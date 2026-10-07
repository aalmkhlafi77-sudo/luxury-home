import assert from 'node:assert/strict';
import { createDefaultOfferCarousel, getOfferCarouselPosition } from '../src/data/offerCarousel.ts';
import type { Property } from '../src/types/index.ts';

const properties = [
  {
    id: 'riyadh', name: 'برج الرياض', nameEn: 'Riyadh', city: 'الرياض', status: 'published',
    media: [
      { id: 'r1', url: '/uploads/riyadh-cover.jpg', title: 'واجهة', type: 'image', isCover: true },
      { id: 'r2', url: '/uploads/riyadh-room.jpg', title: 'غرفة', type: 'image' },
    ],
  },
  {
    id: 'draft', name: 'مسودة', nameEn: 'Draft', city: 'جدة', status: 'draft',
    media: [{ id: 'd1', url: '/uploads/draft.jpg', title: 'واجهة', type: 'image', isCover: true }],
  },
] as unknown as Property[];

const config = createDefaultOfferCarousel(properties);
assert.equal(config.slides.length, 1, 'default carousel uses published building photos only');
assert.equal(config.slides[0].imageUrl, '/uploads/riyadh-cover.jpg', 'cover photo is selected');
assert.equal(config.title, 'خصم يصل حتى ٢٠٪ على إقامات الأعمال الطويلة', 'existing offer title is preserved');
assert.equal(getOfferCarouselPosition(0, 0, 3), 0, 'active slide is centered');
assert.equal(getOfferCarouselPosition(0, 1, 3), 1, 'next slide appears on the right');
assert.equal(getOfferCarouselPosition(0, 2, 3), -1, 'previous slide wraps to the left');
assert.equal(getOfferCarouselPosition(1, 0, 3), -1, 'navigation moves the carousel frame');
assert.equal(getOfferCarouselPosition(0, 2, 5), null, 'distant slides remain outside the 3D preview');

console.log('Offer carousel helpers: 7 assertions passed.');
