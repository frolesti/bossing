import { afterEach, describe, expect, it, vi } from 'vitest';
import puppeteer, { type Browser } from 'puppeteer';
import { DIAScraper, normalizeDIAProduct } from './dia.js';

afterEach(() => { vi.restoreAllMocks(); });

const sourceUrl = 'https://www.dia.es/huevos-leche-y-mantequilla/leche/p/504';
const product = { '@type': 'Product', name: 'Leche semidesnatada Dia L\u00e1ctea 1 L',
  offers: { '@type': 'Offer', url: sourceUrl, price: 0.83, priceCurrency: 'EUR', availability: 'https://schema.org/InStock' } };

describe('DIA official product HTML', () => {
  it.each([403, 429])('reports HTTP %s instead of returning an empty catalog', async status => {
    const close = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(puppeteer, 'launch').mockResolvedValue({ newPage: async () => ({
      goto: async () => ({ status: () => status, headers: () => ({ 'retry-after': '3600' }) }),
    }), close } as unknown as Browser);
    await expect(new DIAScraper().getProductPrice('dia-504', sourceUrl)).rejects.toMatchObject({
      response: { status, headers: { 'retry-after': '3600' } },
    });
    expect(close).toHaveBeenCalledTimes(1);
  });
  it('normalizes the observed public milk document without claiming a confirmed postal area', () => {
    expect(normalizeDIAProduct(product, sourceUrl)).toMatchObject({ productId: 'dia-504', price: 0.83,
      packageSize: { amount: 1, unit: 'l' }, source: { provider: 'dia-storefront', warehouse: 'public-catalog', url: sourceUrl } });
  });
  it.each([['Leche pack 6 x 1 L', 6, 'l'], ['Yogur 8 x 125 g', 1, 'kg'], ['Huevos M 12 uds.', 12, 'ud'],
    ['Aceite 500 ml', 0.5, 'l'], ['Huevos 1 docena', 12, 'ud']])('normalizes explicit packaging %s', (name, amount, unit) => {
    expect(normalizeDIAProduct({ ...product, name }, sourceUrl).packageSize).toEqual({ amount, unit });
  });
  it.each(['Producto 0 kg', 'Huevos 0.5 uds', 'Jam\u00f3n 7 kg aprox.', 'Producto a granel', 'Producto sin formato'])(
    'rejects unconfirmed packaging %s', name => { expect(() => normalizeDIAProduct({ ...product, name }, sourceUrl)).toThrow(); });
  it('binds the offer and optional SKU to the requested official product', () => {
    expect(() => normalizeDIAProduct(product, sourceUrl.replace('/504', '/505'))).toThrow();
    expect(() => normalizeDIAProduct(product, sourceUrl.replace('www.dia.es', 'example.com'))).toThrow();
    expect(() => normalizeDIAProduct({ ...product, sku: '505' }, sourceUrl)).toThrow();
  });
  it('requires an unconditional positive euro offer and explicit availability', () => {
    for (const offers of [{ ...product.offers, price: 0 }, { ...product.offers, priceCurrency: 'USD' },
      { ...product.offers, availability: undefined }, { ...product.offers, '@type': 'AggregateOffer' }]) {
      expect(() => normalizeDIAProduct({ ...product, offers }, sourceUrl)).toThrow();
    }
    expect(normalizeDIAProduct({ ...product, offers: { ...product.offers, availability: 'https://schema.org/OutOfStock' } }, sourceUrl).available).toBe(false);
  });
});