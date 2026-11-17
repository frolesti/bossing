import { describe, expect, it } from 'vitest';
import { normalizeAldiProduct } from './aldi.js';

const url = 'https://www.aldi.es/producto/leche-semidesnatada-80500.html';
const product = { '@type': 'Product', sku: '80500', name: 'Leche semidesnatada', offers: { '@type': 'Offer',
  url: 'https://www.aldi.es/producto/leche-semidesnatada-80500-80500', price: 0.83, priceCurrency: 'EUR', availability: 'https://schema.org/InStock' } };

describe('Aldi official product HTML', () => {
  it('binds the published price to the exact SKU and visible package label', () => {
    expect(normalizeAldiProduct(product, url, '1 l unidad')).toMatchObject({ productId: 'aldi-80500', price: 0.83,
      packageSize: { amount: 1, unit: 'l' }, source: { provider: 'aldi-storefront', warehouse: 'public-catalog', url } });
  });
  it.each([['500 g unidad', 0.5, 'kg'], ['6 x 125 g unidad', 0.75, 'kg'], ['12 uds unidad', 12, 'ud'],
    ['820 g unidad', 0.82, 'kg'], ['pack de 8 x 125 g', 1, 'kg']])(
    'normalizes explicit packaging %s', (packaging, amount, unit) => {
      expect(normalizeAldiProduct(product, url, packaging).packageSize).toEqual({ amount, unit });
    });
  it('rejects unbound identities, conditional dates, currency and absent availability', () => {
    for (const invalid of [{ ...product, sku: '99' }, { ...product, offers: { ...product.offers, url: 'https://example.com' } },
      { ...product, offers: { ...product.offers, priceCurrency: 'USD' } }, { ...product, offers: { ...product.offers, availability: '' } },
      { ...product, offers: { ...product.offers, validThrough: '2026-01-01' } }, { ...product, offers: { ...product.offers, price: 0 } }]) {
      expect(() => normalizeAldiProduct(invalid, url, '1 l unidad')).toThrow();
    }
    for (const packaging of ['', '1 kg aprox. unidad', '0 l unidad', '0.5 uds unidad', '400 g peso esc. unidad',
      'pack de 125 g', 'pack de 8 x 125 g aprox.', 'pack de 8 x 125 g peso esc.']) {
      expect(() => normalizeAldiProduct(product, url, packaging)).toThrow();
    }
    expect(() => normalizeAldiProduct(product, url + '?session=unknown', '1 l unidad')).toThrow();
  });
});