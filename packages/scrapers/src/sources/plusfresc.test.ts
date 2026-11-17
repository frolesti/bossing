import { describe, expect, it } from 'vitest';
import { normalizePlusfrescProduct } from './plusfresc.js';

const url = 'https://wscompra.plusfresc.cat/api/search/languages/ca/llet/products/12';
const product = { item_id: '003683', value_cents: 114, new_value_cents: 74, unit_measure: 'L', available: true,
  has_format: true, formats: [{ options: [{ option_id: 'Unitat', percentage_mili: 1000 }] }],
  texts: [{ type: 4, lang: 'ca', text: 'Aigua mineral amb gas FONTER, 1 l' }] };

describe('Plusfresc official catalogue API', () => {
  it('uses the single-package regular price rather than a conditional multi-buy average', () => {
    expect(normalizePlusfrescProduct({ ...product, qty_required: 2, promo_id: 'CategoMxN_34579' }, url)).toMatchObject({
      productId: 'plusfresc-003683', price: 1.14, pricePerUnit: 1.14, packageSize: { amount: 1, unit: 'l' },
      source: { provider: 'plusfresc-rest', warehouse: 'centre:12;postal:25001', url },
    });
  });
  it('accepts a current explicit unconditional reduction and excludes expired offers', () => {
    const value = { ...product, end_date: '11/11/2026', texts: [...product.texts,
      { type: 6, lang: 'ca', text: 'Oferta a preu redu\u00eft!' }] };
    expect(normalizePlusfrescProduct(value, url, new Date('2026-11-11T12:00:00Z')).price).toBe(0.74);
    expect(normalizePlusfrescProduct(value, url, new Date('2026-11-12T12:00:00Z')).price).toBe(1.14);
    expect(normalizePlusfrescProduct({ ...value, qty_required: 2 }, url, new Date('2026-11-11T12:00:00Z')).price).toBe(1.14);
  });
  it('normalizes explicit packages without estimating weight from a unit price', () => {
    const value = { ...product, unit_measure: 'Kg', texts: [{ type: 4, lang: 'ca', text: 'Pa de motlle, 820 g' }] };
    expect(normalizePlusfrescProduct(value, url).packageSize).toEqual({ amount: 0.82, unit: 'kg' });
    expect(normalizePlusfrescProduct({ ...product, available: false }, url).available).toBe(false);
  });
  it('rejects unknown identities, quantities, units, purchase formats and source contexts', () => {
    for (const value of [{ ...product, item_id: '' }, { ...product, available: undefined }, { ...product, formats: [] },
      { ...product, value_cents: 0 }, { ...product, unit_measure: 'Kg' },
      { ...product, texts: [{ type: 4, lang: 'ca', text: 'Producte sense pes' }] }]) {
      expect(() => normalizePlusfrescProduct(value, url)).toThrow();
    }
    for (const invalid of [url.replace('/12', '/99'), url.replace('wscompra.plusfresc.cat', 'example.com'), url + '?store=99']) {
      expect(() => normalizePlusfrescProduct(product, invalid)).toThrow();
    }
  });
});