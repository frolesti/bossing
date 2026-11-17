import { describe, expect, it } from 'vitest';
import { discoverVeritasProducts, normalizeVeritasProduct } from './veritas.js';

const url = 'https://www.veritas.es/compra/leche-desnatada-ecologica-veritas-1l-24059';
const product = { '@type': 'Product', sku: '24059', name: 'Leche desnatada ecol\u00f3gica Veritas 1l', url,
  offers: { '@type': 'Offer', price: 1.55, priceCurrency: 'EUR', availability: 'https://schema.org/InStock' } };

describe('Veritas official product HTML', () => {
  it('pins the exact observed product, euro offer, availability and package', () => {
    expect(normalizeVeritasProduct(product, url)).toMatchObject({ productId: 'veritas-24059', price: 1.55,
      packageSize: { amount: 1, unit: 'l' }, source: { provider: 'veritas-storefront', warehouse: 'public-catalog', url } });
    expect(normalizeVeritasProduct({ ...product, offers: { ...product.offers, availability: 'https://schema.org/OutOfStock' } }, url).available).toBe(false);
  });
  it.each([['Pa 820g', 0.82, 'kg'], ['Iogurt 6x125g', 0.75, 'kg'], ['Ous 6un', 6, 'ud']])(
    'normalizes explicit packaging %s', (name, amount, unit) => {
      expect(normalizeVeritasProduct({ ...product, name }, url).packageSize).toEqual({ amount, unit });
    });
  it('rejects conflicting identity, unknown packages, stock, currency and conditional offers', () => {
    for (const value of [{ ...product, sku: '99' }, { ...product, url: 'https://example.com' },
      { ...product, name: 'Producte sense env\u00e0s' }, { ...product, name: 'Producte aprox 1kg' },
      ...[{ priceCurrency: 'USD' }, { price: 0 }, { availability: undefined }, { eligibleQuantity: { minValue: 6 } }]
        .map(offer => ({ ...product, offers: { ...product.offers, ...offer } }))]) {
      expect(() => normalizeVeritasProduct(value, url)).toThrow();
    }
    expect(() => normalizeVeritasProduct(product, url + '?store=unknown')).toThrow();
  });
  it('discovers exact URLs from the official sitemap without using its names as observed product data', () => {
    const xml = `<urlset><url><loc>${url}</loc></url><url><loc>${url}</loc></url>
      <url><loc>https://www.veritas.es/compra/leche</loc></url><url><loc>${url.replace('www.veritas.es', 'example.com')}</loc></url></urlset>`;
    expect(discoverVeritasProducts(xml, 'leche desnatada')).toEqual([{ productId: 'veritas-24059', sourceUrl: url }]);
    expect(discoverVeritasProducts(xml, 'pan')).toEqual([]);
    expect(discoverVeritasProducts(xml, 'leche', () => false)).toEqual([]);
  });
});