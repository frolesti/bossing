import { afterEach, describe, expect, it, vi } from 'vitest';
import puppeteer, { type Browser } from 'puppeteer';
import { CapraboScraper, normalizeCapraboProduct } from './caprabo.js';

afterEach(() => { vi.restoreAllMocks(); });

const url = 'https://www.capraboacasa.com/ca/productdetail/18581678-llet-semidesnatada-de-catalunya-eroski-brik-1-litre/';
const product = {
  '@type': 'Product', identifier: '18581678', description: 'Llet semidesnatada de Catalunya EROSKI, brik 1 litre', url,
  offers: { url, price: '0.99', priceCurrency: 'EUR', availability: 'http://schema.org/InStock' },
};

describe('Caprabo official storefront structured data', () => {
  it('propagates forbidden responses and releases the browser without an alternate source', async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const launch = vi.spyOn(puppeteer, 'launch').mockResolvedValue({
      newPage: async () => ({ goto: async () => ({ status: () => 403, headers: () => ({ 'retry-after': '3600' }) }) }), close,
    } as unknown as Browser);
    await expect(new CapraboScraper().getProductPrice('caprabo-18581678', url)).rejects.toMatchObject({
      response: { status: 403, headers: { 'retry-after': '3600' } },
    });
    expect(launch).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('rejects a page without structured product data and still closes the browser', async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(puppeteer, 'launch').mockResolvedValue({
      newPage: async () => ({ goto: async () => ({ status: () => 200 }), url: () => url, $$eval: async () => [] }), close,
    } as unknown as Browser);
    await expect(new CapraboScraper().getProductPrice('caprabo-18581678', url)).rejects.toThrow('Missing or ambiguous');
    expect(close).toHaveBeenCalledTimes(1);
  });
  it('uses the verified euro price, explicit package and public catalog context', () => {
    expect(normalizeCapraboProduct(product, url)).toMatchObject({ productId: 'caprabo-18581678', price: 0.99,
      pricePerUnit: 0.99, available: true, packageSize: { amount: 1, unit: 'l' },
      source: { provider: 'caprabo-storefront', warehouse: 'public-catalog', url } });
  });
  it.each([
    ['Pasta, paquet 500 g', 0.5, 'kg'], ['Iogurt, pack 4x125 g', 0.5, 'kg'],
    ['Ous M, 12 unitats', 12, 'ud'], ['Oli, ampolla 750 ml', 0.75, 'l'],
    ['Ou fresc M, cartó 1 dotzena', 12, 'ud'],
  ])('normalizes the explicit package: %s', (description, amount, unit) => {
    expect(normalizeCapraboProduct({ ...product, description }, url).packageSize).toEqual({ amount, unit });
  });
  it('does not turn missing stock information or unavailable products into available prices', () => {
    expect(normalizeCapraboProduct({ ...product, offers: { ...product.offers, availability: 'https://schema.org/OutOfStock' } }, url).available).toBe(false);
    expect(() => normalizeCapraboProduct({ ...product, offers: { ...product.offers, availability: '' } }, url)).toThrow('availability');
  });
  it('rejects invalid prices, currencies, identities and guessed packages', () => {
    for (const invalid of [{ ...product, identifier: '99' }, { ...product, description: 'Llet sense format' },
      { ...product, offers: { ...product.offers, price: '0' } },
      { ...product, offers: { ...product.offers, priceCurrency: 'USD' } },
      { ...product, offers: { ...product.offers, url: 'https://example.com' } }]) {
      expect(() => normalizeCapraboProduct(invalid, url)).toThrow();
    }
  });
});