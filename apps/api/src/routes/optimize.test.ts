import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { ScrapedPrice } from '@bossing/shared';

const sources = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock('@bossing/scrapers', () => ({
  ...Object.fromEntries(['mercadona', 'consum', 'carrefour', 'dia', 'lidl', 'bonpreu', 'ametller', 'caprabo', 'lasirena',
    'plusfresc', 'veritas', 'condis', 'bonarea', 'sorli', 'eroski'].map(name => [`${name}Scraper`, { searchProducts: sources.search }])),
  MercadonaScraper: class {},
}));
vi.mock('../services/cache.service.js', () => ({ fileCache: { isValid: () => false, set: vi.fn() } }));
vi.mock('../services/translation.service.js', () => ({ batchTranslateToSpanish: async () => new Map(),
  getSpanishVariantSync: () => null, getCatalanVariantSync: () => null }));

import { optimizeRouter } from './optimize.js';
import { productsRouter } from './products.js';

const quote = (productId: string, name: string, price: number, amount = 1, unit = 'l'): ScrapedPrice => ({
  productId, name, price, pricePerUnit: price / amount, packageSize: { amount, unit }, unit,
  available: true, supermarket: 'Ametller Origen', supermarketId: 'ametller', category: 'Food', scrapedAt: new Date(),
  source: { provider: 'ametller-scapi', warehouse: 'public-catalog', url: 'https://www.ametllerorigen.com/' },
});

describe('Live optimizer generic versus exact product requests', () => {
  let server: Server;
  let url: string;
  beforeAll(async () => {
    await import('@bossing/shared');
    const app = express(); app.use(express.json()); app.use('/optimize', optimizeRouter); app.use('/products', productsRouter);
    server = createServer(app);
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/optimize`;
  }, 60_000);
  afterAll(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  beforeEach(() => { sources.search.mockReset(); });

  async function compare(item: Record<string, unknown>) {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [item], supermarketIds: ['ametller'], location: { lat: 41.562, lng: 2.012 } }) });
    expect(response.status).toBe(200);
    return (await response.json()).routes[0].stops[0].items[0];
  }

  it('uses the cheapest compatible brand, ignores a reference SKU only when generic mode is explicit, and exposes alternatives', async () => {
    sources.search.mockResolvedValue([quote('ametller-1', 'Llet desnatada Marca Curta', 1.4),
      quote('ametller-2', 'Llet desnatada Una Altra Marca', 1.1), quote('ametller-3', 'Llet semidesnatada', 0.5)]);
    const item = await compare({ name: 'Leche desnatada Hacendado 1 l', productId: 'merc-foreign', matchMode: 'generic', quantity: 2, unit: 'l' });
    expect(item).toMatchObject({ found: true, productId: 'ametller-2', quantity: 2, lineTotal: 2.2, candidateCount: 3, compatibleCount: 2 });
    expect(item.alternatives.map((product: { productId: string }) => product.productId)).toEqual(['ametller-2', 'ametller-1']);
    expect(sources.search).toHaveBeenCalledWith('llet desnatada');
  });
  it.each(['veritas', 'plusfresc', 'condis', 'sorli'])('routes generic %s requests to live catalogue search, not fifteen archived references', async chain => {
    sources.search.mockResolvedValue([{ ...quote(`${chain}-1`, 'Leche desnatada Marca', 1.1), supermarketId: chain }]);
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ name: 'Llet desnatada', matchMode: 'generic', quantity: 1, unit: 'l' }],
        supermarketIds: [chain], location: { lat: 41.562, lng: 2.012 } }) });
    expect(response.status).toBe(200);
    const route = (await response.json()).routes[0];
    expect(route.stops[0].items[0]).toMatchObject({ found: true, productId: `${chain}-1`, lineTotal: 1.1 });
    expect(sources.search).toHaveBeenCalledTimes(1);
  });
  it('searches only the internal catalog even if every supermarket is unavailable', async () => {
    sources.search.mockRejectedValue(new Error('Every supermarket is offline'));
    const response = await fetch(url.replace('/optimize', '/products/search') + '?q=llet%20desnatada');
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.catalogVersion).toBe(2);
    expect(payload.data[0]).toMatchObject({ id: 'bossing:milk-skimmed', unit: 'l' });
    expect(payload.data[0]).not.toHaveProperty('prices');
    expect(payload.data[0]).not.toHaveProperty('packageSize');
    expect(sources.search).not.toHaveBeenCalled();
  });
  it('resolves internal references as generic demands and chooses the cheapest compatible offer', async () => {
    sources.search.mockResolvedValue([quote('ametller-1', 'Llet desnatada Marca A', 1.4),
      quote('ametller-2', 'Llet desnatada Marca B', 1.1), quote('ametller-3', 'Llet semidesnatada', 0.5)]);
    const item = await compare({ catalogProductId: 'bossing:milk-skimmed', name: 'Wrong client label',
      productId: 'not-a-source-sku', matchMode: 'exact', quantity: 2000, unit: 'ml' });
    expect(item).toMatchObject({ found: true, productId: 'ametller-2', quantity: 2, lineTotal: 2.2 });
    expect(sources.search).toHaveBeenCalledWith('llet desnatada');
  });
  it('rejects unknown internal identities without requesting supermarket prices', async () => {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ catalogProductId: 'bossing:unknown', name: 'Llet', quantity: 1 }],
        supermarketIds: ['ametller'], location: { lat: 41.562, lng: 2.012 } }) });
    expect(response.status).toBe(400);
    expect(sources.search).not.toHaveBeenCalled();
  });
  it('browses internal categories and returns real internal details without contacting sources', async () => {
    const base = url.replace('/optimize', '/products');
    const suggestions = await (await fetch(`${base}/suggestions`)).json();
    expect(suggestions.categories[0].id).toBe('bossing-category:import-12');
    expect(suggestions.capture.coverage.completedBranches).toBe(152);
    const groups = await (await fetch(`${base}/categories/bossing-category:dairy/generics`)).json();
    expect(groups.every((entry: { isGroup: boolean }) => entry.isGroup)).toBe(true);
    const products = await (await fetch(`${base}/categories/bossing-category:milk/generics`)).json();
    expect(products.some((entry: { id: string }) => entry.id === 'bossing:milk-skimmed')).toBe(true);
    expect((await (await fetch(`${base}/bossing:eggs`)).json()).name).toBe('Ous');
    expect((await fetch(`${base}/mercadona-1`)).status).toBe(404);
    expect((await fetch(`${base}/categories/123/generics`)).status).toBe(404);
    expect(sources.search).not.toHaveBeenCalled();
  });
  it('paginates internal search and validates invalid requests', async () => {
    const base = url.replace('/optimize', '/products/search');
    const first = await (await fetch(`${base}?q=llet&limit=2`)).json();
    const second = await (await fetch(`${base}?q=llet&limit=2&page=2`)).json();
    expect(first.data).toHaveLength(2);
    expect(second.data).toHaveLength(2);
    expect(first.data.map((entry: { id: string }) => entry.id)).not.toEqual(second.data.map((entry: { id: string }) => entry.id));
    expect((await fetch(`${base}?q=llet&page=-1`)).status).toBe(400);
    expect((await fetch(`${base}?q=llet&limit=1000`)).status).toBe(400);
    expect(sources.search).not.toHaveBeenCalled();
  });
  it('prices a dozen as twelve eggs and rejects physical dimension changes before reading sources', async () => {
    sources.search.mockResolvedValue([quote('ametller-eggs', 'Ous M', 2, 6, 'u')]);
    expect(await compare({ catalogProductId: 'bossing:eggs-m', name: 'Ous M', quantity: 1, unit: 'dc' }))
      .toMatchObject({ found: true, quantity: 2, lineTotal: 4, requestedQuantity: 12, requestedUnit: 'u' });
    expect(await compare({ catalogProductId: 'bossing:eggs-m', name: 'Ous M', quantity: 1, unit: 'u', quantityMode: 'packages' }))
      .toMatchObject({ found: true, quantity: 1, lineTotal: 2, requestedQuantity: 1 });
    sources.search.mockClear();
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ catalogProductId: 'bossing:milk', name: 'Llet', quantity: 1, unit: 'kg' }],
        supermarketIds: ['ametller'], location: { lat: 41.562, lng: 2.012 } }) });
    expect(response.status).toBe(400);
    expect(sources.search).not.toHaveBeenCalled();
  });
  it('does not silently replace an explicitly pinned SKU and can find an exact same-chain product', async () => {
    sources.search.mockResolvedValue([quote('ametller-1', 'Llet desnatada ATO', 1.2)]);
    expect(await compare({ name: 'Llet desnatada', productId: 'merc-foreign', matchMode: 'exact', quantity: 1, unit: 'l' }))
      .toMatchObject({ found: false, reason: 'identity' });
    expect(await compare({ name: 'Llet desnatada ATO 1 l', productId: 'ametller-1', matchMode: 'exact', quantity: 1, unit: 'l' }))
      .toMatchObject({ found: true, productId: 'ametller-1' });
  });
  it('buys a verified weighted bread package as one package without inventing a one-unit net weight', async () => {
    sources.search.mockResolvedValue([quote('ametller-4', 'Pa tradicional 450g', 2.69, 0.45, 'kg')]);
    expect(await compare({ name: 'Pa', quantity: 1, unit: 'u', quantityMode: 'packages' }))
      .toMatchObject({ found: true, quantity: 1, lineTotal: 2.69, packageSize: { amount: 0.45, unit: 'kg' }, requestedUnit: 'envasos', purchasedQuantity: 1 });
    expect(await compare({ name: 'Pa', quantity: 1, unit: 'u' })).toMatchObject({ found: false, reason: 'format', candidateCount: 1 });
  });
  it('distinguishes an incompatible variant from a source failure', async () => {
    sources.search.mockResolvedValue([quote('ametller-3', 'Llet semidesnatada', 0.5)]);
    expect(await compare({ name: 'Llet desnatada', quantity: 1, unit: 'l' })).toMatchObject({ found: false, reason: 'missing' });
    sources.search.mockRejectedValue(new Error('Official source offline'));
    expect(await compare({ name: 'Llet', quantity: 1, unit: 'l' })).toMatchObject({ found: false, reason: 'source_error' });
  });
  it('retains independently validated partial quotes without marking the source as complete', async () => {
    sources.search.mockRejectedValue(Object.assign(new Error('One official detail timed out'), {
      partialResults: [quote('ametller-1', 'Llet desnatada ATO', 1.18)],
    }));
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ name: 'Llet desnatada', quantity: 2, unit: 'l' }],
        supermarketIds: ['ametller'], location: { lat: 41.562, lng: 2.012 } }) });
    expect(response.status).toBe(200);
    const route = (await response.json()).routes[0];
    expect(route).toMatchObject({ status: 'source_error', comparable: false, foundCount: 1 });
    expect(route.stops[0].items[0]).toMatchObject({ found: true, productId: 'ametller-1', lineTotal: 2.36 });
  });
});