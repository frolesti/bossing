import { describe, expect, it } from 'vitest';
import { normalizeCarrefourProduct } from './carrefour.js';

const url = 'https://www.carrefour.es/supermercado/leche-semidesnatada-carrefour-brik-1-l/R-521007071/p';
const product = { '@type': 'Product', sku: '2313940000', name: 'Leche semidesnatada Carrefour brik 1 l.',
  offers: { '@type': 'Offer', url, price: '0.83', priceCurrency: 'EUR', availability: 'https://schema.org/InStock' } };

describe('Carrefour official product HTML', () => {
  it('records the actual mandatory six-brick purchase, not an unpurchasable single brick', () => {
    expect(normalizeCarrefourProduct(product, url, 6)).toMatchObject({ productId: 'carrefour-521007071', price: 4.98,
      packageSize: { amount: 6, unit: 'l' }, source: { provider: 'carrefour-storefront', warehouse: 'public-catalog', url } });
    expect(normalizeCarrefourProduct(product, url, 6).pricePerUnit).toBeCloseTo(0.83, 8);
  });
  it('keeps ordinary single packages separate', () => {
    expect(normalizeCarrefourProduct(product, url, 1)).toMatchObject({ price: 0.83, packageSize: { amount: 1, unit: 'l' } });
  });
  it.each([0, -1, 1.5, NaN, 101])('rejects invalid minimum purchase %s', quantity => {
    expect(() => normalizeCarrefourProduct(product, url, quantity)).toThrow();
  });
  it('rejects offers from a different product, currency or unknown stock state', () => {
    for (const invalid of [{ ...product, offers: { ...product.offers, url: url.replace('521007071', '99') } },
      { ...product, offers: { ...product.offers, priceCurrency: 'USD' } }, { ...product, offers: { ...product.offers, availability: '' } },
      { ...product, name: 'Producto peso variable 1 kg' }]) expect(() => normalizeCarrefourProduct(invalid, url, 1)).toThrow();
    expect(() => normalizeCarrefourProduct(product, url + '?zone=unknown', 1)).toThrow();
  });
});