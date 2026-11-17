export { MercadonaScraper, mercadonaScraper } from './sources/mercadona.js';
export { lidlScraper } from './sources/lidl.js';
export { CarrefourScraper, carrefourScraper, normalizeCarrefourProduct } from './sources/carrefour.js';
export { ConsumScraper, consumScraper } from './sources/consum.js';
export { DIAScraper, diaScraper, normalizeDIAProduct } from './sources/dia.js';
export { AlcampoScraper, alcampoScraper, normalizeAlcampoProduct } from './sources/alcampo.js';
export { AldiScraper, aldiScraper, normalizeAldiProduct } from './sources/aldi.js';
export { BonpreuScraper, bonpreuScraper, normalizeBonpreuProduct } from './sources/bonpreu.js';
export { BonareaScraper, bonareaScraper, normalizeBonareaProduct } from './sources/bonarea.js';
export { SorliScraper, sorliScraper, normalizeSorliProduct } from './sources/sorli.js';
export { AmetllerScraper, ametllerScraper } from './sources/ametller.js';
export { CapraboScraper, capraboScraper } from './sources/caprabo.js';
export { lasirenaScraper } from './sources/lasirena.js';
export { plusfrescScraper } from './sources/plusfresc.js';
export { VeritasScraper, veritasScraper, normalizeVeritasProduct } from './sources/veritas.js';
export { CondisScraper, condisScraper, normalizeCondisProduct } from './sources/condis.js';
export { EroskiScraper, eroskiScraper, normalizeEroskiProduct } from './sources/eroski.js';
export { BaseScraper, type ScraperConfig, type ScraperResult } from './base.js';

import { mercadonaScraper } from './sources/mercadona.js';
import { lidlScraper } from './sources/lidl.js';
import { carrefourScraper } from './sources/carrefour.js';
import { consumScraper } from './sources/consum.js';
import { diaScraper } from './sources/dia.js';
import { alcampoScraper } from './sources/alcampo.js';
import { aldiScraper } from './sources/aldi.js';
import { bonpreuScraper } from './sources/bonpreu.js';
import { bonareaScraper } from './sources/bonarea.js';
import { sorliScraper } from './sources/sorli.js';
import { ametllerScraper } from './sources/ametller.js';
import { capraboScraper } from './sources/caprabo.js';
import { lasirenaScraper } from './sources/lasirena.js';
import { plusfrescScraper } from './sources/plusfresc.js';
import { veritasScraper } from './sources/veritas.js';
import { condisScraper } from './sources/condis.js';
import { eroskiScraper } from './sources/eroski.js';
import type { BaseScraper } from './base.js';

export const scrapers: BaseScraper[] = [
  mercadonaScraper,
  lidlScraper,
  carrefourScraper,
  consumScraper,
  diaScraper,
  alcampoScraper,
  aldiScraper,
  bonpreuScraper,
  bonareaScraper,
  sorliScraper,
  ametllerScraper,
  capraboScraper,
  lasirenaScraper,
  plusfrescScraper,
  veritasScraper,
  condisScraper,
  eroskiScraper,
];

export function getScraper(name: string): BaseScraper | undefined {
  return scrapers.find(
    (s) => s.getName().toLowerCase() === name.toLowerCase()
  );
}

export function getEnabledScrapers(): BaseScraper[] {
  return scrapers.filter((s) => s.isEnabled());
}
