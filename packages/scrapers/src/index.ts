export { mercadonaScraper } from './sources/mercadona.js';
export { lidlScraper } from './sources/lidl.js';
export { carrefourScraper } from './sources/carrefour.js';
export { BaseScraper, type ScraperConfig, type ScraperResult } from './base.js';

import { mercadonaScraper } from './sources/mercadona.js';
import { lidlScraper } from './sources/lidl.js';
import { carrefourScraper } from './sources/carrefour.js';
import type { BaseScraper } from './base.js';

export const scrapers: BaseScraper[] = [
  mercadonaScraper,
  lidlScraper,
  carrefourScraper,
];

export function getScraper(name: string): BaseScraper | undefined {
  return scrapers.find(
    (s) => s.getName().toLowerCase() === name.toLowerCase()
  );
}

export function getEnabledScrapers(): BaseScraper[] {
  return scrapers.filter((s) => s.isEnabled());
}
