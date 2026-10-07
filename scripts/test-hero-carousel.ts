import assert from 'node:assert/strict';
import { getHeroCarouselFrame } from '../src/data/heroCarousel.ts';

const slides = [
  { id: 'a' },
  { id: 'b' },
  { id: 'c' },
  { id: 'd' },
  { id: 'e' },
];

assert.deepEqual(
  getHeroCarouselFrame(slides, 0, 4),
  { activeIndex: 0, active: slides[0], previews: slides.slice(1) },
  'The thumbnail rail starts with the next four slides in order.',
);

assert.deepEqual(
  getHeroCarouselFrame(slides, 1, 4),
  { activeIndex: 1, active: slides[1], previews: [slides[2], slides[3], slides[4], slides[0]] },
  'On each automatic advance, the next thumbnail becomes the hero and the previous hero moves to the rail end.',
);

assert.deepEqual(
  getHeroCarouselFrame(slides, -1, 3),
  { activeIndex: 4, active: slides[4], previews: [slides[0], slides[1], slides[2]] },
  'The sequence wraps and normalizes negative indexes.',
);

assert.deepEqual(
  getHeroCarouselFrame([], 8, 4),
  { activeIndex: 0, active: null, previews: [] },
  'An empty carousel returns a safe frame.',
);

assert.deepEqual(
  getHeroCarouselFrame([slides[0]], 0, 4),
  { activeIndex: 0, active: slides[0], previews: [] },
  'A single slide does not create previews or attempt a rotation.',
);

console.log('PASS: hero carousel automatic order, preview rail rotation, wraparound, empty and single-slide states.');
