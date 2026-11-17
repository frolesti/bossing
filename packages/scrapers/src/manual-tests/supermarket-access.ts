import type { ScrapedPrice } from '@bossing/shared';
import {
  MercadonaScraper, consumScraper, ametllerScraper, bonpreuScraper,
  bonareaScraper, capraboScraper, condisScraper, sorliScraper,
  plusfrescScraper, lasirenaScraper, veritasScraper, aldiScraper, lidlScraper,
} from '../index.js';

const checks: Record<string, () => Promise<ScrapedPrice[]>> = {
  mercadona: async () => {
    const scraper = new MercadonaScraper();
    await scraper.setPostalCode('08001');
    return [await scraper.getProductPrice('merc-10382')];
  },
  consum: async () => [await consumScraper.getProductPrice('consum-5932')],
  ametller: async () => [await ametllerScraper.getProductPrice('ametller-2390',
    'https://www.ametllerorigen.com/ca/llet-semidesnatada-a2-llet-llet-ametller-origen-1l/2390.html')],
  bonpreu: async () => [await bonpreuScraper.getProductPrice('bonpreu-81178',
    'https://www.compraonline.bonpreuesclat.cat/products/bonpreu-llet-semidesnatada-en-cartr%C3%B3/81178')],
  bonarea: async () => [await bonareaScraper.getProductPrice('bonarea-13_9103',
    'https://www.bonarea-online.com/online/producto/leche-semidesnatada/13_9103')],
  caprabo: async () => [await capraboScraper.getProductPrice('caprabo-18581678',
    'https://www.capraboacasa.com/ca/productdetail/18581678-llet-semidesnatada-de-catalunya-eroski-brik-1-litre/')],
  condis: async () => [await condisScraper.getProductPrice('condis-704004',
    'https://compraonline.condis.es/leche-ato-natura-semidesnatada-1-l/p/704004/es_ES')],
  sorli: async () => [await sorliScraper.getProductPrice('sorli-1019',
    'https://www.sorliclic.com/ca/p/oli-girasol-1l/1019')],
  veritas: async () => [await veritasScraper.getProductPrice('veritas-24059',
    'https://www.veritas.es/compra/leche-desnatada-ecologica-veritas-1l-24059')],
  plusfresc: () => plusfrescScraper.searchProducts('llet desnatada'),
  lasirena: () => lasirenaScraper.searchProducts('guisantes'),
  aldi: async () => [await aldiScraper.getProductPrice('aldi-80500',
    'https://www.aldi.es/producto/leche-semidesnatada-80500.html')],
  lidl: () => lidlScraper.searchProducts('leche semidesnatada'),
};

async function main() {
  const source = process.argv[2];
  if (!source || (source !== 'all' && !Object.hasOwn(checks, source))) {
    throw new Error(`Usage: test:access <${Object.keys(checks).join('|')}|all>`);
  }
  for (const [chain, check] of Object.entries(checks)) {
    if (source !== 'all' && chain !== source) continue;
    const started = Date.now();
    try {
      const quotes = await check();
      const valid = quotes.filter(quote => Number.isFinite(quote.price) && quote.price > 0 &&
        quote.source?.url && quote.packageSize && quote.packageSize.amount > 0 &&
        typeof quote.available === 'boolean');
      if (!valid.length) throw new Error(`No verified price with provenance and packaging (${quotes.length} results)`);
      const quote = valid[0];
      console.log(JSON.stringify({ chain, status: 'verified_sample', checkedAt: new Date().toISOString(),
        durationMs: Date.now() - started, count: valid.length, productId: quote.productId,
        price: quote.price, available: quote.available, packageSize: quote.packageSize, source: quote.source }));
    } catch (error) {
      console.error(JSON.stringify({ chain, status: 'failed', checkedAt: new Date().toISOString(),
        durationMs: Date.now() - started, error: error instanceof Error ? error.message : String(error) }));
      process.exitCode = 1;
    }
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
