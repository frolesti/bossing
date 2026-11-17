import { afterEach, describe, expect, it, vi } from 'vitest';
import puppeteer, { type Browser } from 'puppeteer';
import { AlcampoScraper, normalizeAlcampoProduct } from './alcampo.js';

afterEach(() => { vi.restoreAllMocks(); });

const sourceUrl = 'https://www.compraonline.alcampo.es/products/auchan-leche-semidesnatada-de-vaca-1-l-producto-alcampo/53549';
const product = { '@type': 'Product', sku: '53549', name: 'AUCHAN Leche semidesnatada de vaca 1 l. Producto Alcampo', size: '1000ml',
  offers: { '@type': 'Offer', price: '0.88', priceCurrency: 'EUR', availability: 'https://schema.org/InStock' } };

describe('Alcampo official product HTML', () => {
  it('reads the observed official milk offer without assuming a confirmed local store', () => {
    expect(normalizeAlcampoProduct(product, sourceUrl)).toMatchObject({ productId: 'alcampo-53549', price: 0.88,
      packageSize: { amount: 1, unit: 'l' }, source: { provider: 'alcampo-storefront', warehouse: 'public-catalog', url: sourceUrl } });
  });
  it.each([['6 x 1l', 6, 'l'], ['8 x 125g', 1, 'kg'], ['12 unidades', 12, 'ud'], ['12 por envase', 12, 'ud']])(
    'normalizes explicit packaging %s', (size, amount, unit) => {
      expect(normalizeAlcampoProduct({ ...product, size }, sourceUrl).packageSize).toEqual({ amount, unit });
    });
  it.each(['0kg', '0.5 unidades', '1kg aprox.', 'a granel'])('rejects uncertain packaging %s', size => {
    expect(() => normalizeAlcampoProduct({ ...product, size }, sourceUrl)).toThrow();
  });
  it('rejects wrong sources, identities, currencies and missing availability', () => {
    expect(() => normalizeAlcampoProduct(product, sourceUrl.replace('/53549', '/53550'))).toThrow();
    expect(() => normalizeAlcampoProduct(product, sourceUrl.replace('www.compraonline.alcampo.es', 'example.com'))).toThrow();
    expect(() => normalizeAlcampoProduct({ ...product, offers: { ...product.offers, priceCurrency: 'USD' } }, sourceUrl)).toThrow();
    expect(() => normalizeAlcampoProduct({ ...product, offers: { ...product.offers, availability: undefined } }, sourceUrl)).toThrow();
  });
  it.each([403, 429])('reports HTTP %s and closes its browser', async status => {
    const close = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(puppeteer, 'launch').mockResolvedValue({ newPage: async () => ({
      goto: async () => ({ status: () => status, headers: () => ({ 'retry-after': '3600' }) }),
    }), close } as unknown as Browser);
    await expect(new AlcampoScraper().getProductPrice('alcampo-53549', sourceUrl)).rejects.toMatchObject({
      response: { status, headers: { 'retry-after': '3600' } },
    });
    expect(close).toHaveBeenCalledTimes(1);
  });
});