export { mercadonaScraper } from './sources/mercadona.js';
export { lidlScraper } from './sources/lidl.js';
export { carrefourScraper } from './sources/carrefour.js';
export { consumScraper } from './sources/consum.js';
export { diaScraper } from './sources/dia.js';
export { bonpreuScraper } from './sources/bonpreu.js';
export { ametllerScraper } from './sources/ametller.js';
export { capraboScraper } from './sources/caprabo.js';
export { BaseScraper, type ScraperConfig, type ScraperResult } from './base.js';

import { mercadonaScraper } from './sources/mercadona.js';
import { lidlScraper } from './sources/lidl.js';
import { carrefourScraper } from './sources/carrefour.js';
import { consumScraper } from './sources/consum.js';
import { diaScraper } from './sources/dia.js';
import { bonpreuScraper } from './sources/bonpreu.js';
import { ametllerScraper } from './sources/ametller.js';
import { capraboScraper } from './sources/caprabo.js';
import type { BaseScraper } from './base.js';

export const scrapers: BaseScraper[] = [
  mercadonaScraper,
  lidlScraper,
  carrefourScraper,
  consumScraper,
  diaScraper,
  bonpreuScraper,
  ametllerScraper,
  capraboScraper,
];

export function getScraper(name: string): BaseScraper | undefined {
  return scrapers.find(
    (s) => s.getName().toLowerCase() === name.toLowerCase()
  );
}

export function getEnabledScrapers(): BaseScraper[] {
  return scrapers.filter((s) => s.isEnabled());
}
