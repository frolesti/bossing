import { describe, expect, it } from 'vitest';
import { normalizeEroskiProduct } from './eroski.js';

const sourceUrl = 'https://supermercado.eroski.es/en/productdetail/18672311-leche-semidesnatada-del-pais-vasco-eroski-brik-1-litro/';
const product = { productId: '18672311', name: 'Leche semidesnatada del Pa\u00cds Vasco EROSKI, brik 1 litro',
  price: '1,05', currency: 'EUR', canonicalUrl: sourceUrl, orderable: true };

describe('Eroski official HTML microdata', () => {
  it('uses the observed euro offer and explicit SKU-bound purchase control', () => {
    expect(normalizeEroskiProduct(product, sourceUrl)).toMatchObject({ productId: 'eroski-18672311', price: 1.05,
      packageSize: { amount: 1, unit: 'l' }, source: { provider: 'eroski-storefront', warehouse: 'public-catalog', url: sourceUrl } });
  });
  it.each([['Yogur 8 x 125 g', 1, 'kg'], ['Huevos M 12 unidades', 12, 'ud'], ['Leche 6 x 1 litro', 6, 'l'],
    ['Pan de molde con corteza EROSKI basic, paquete 820 g', 0.82, 'kg']])(
    'normalizes explicit packaging %s', (name, amount, unit) => {
      expect(normalizeEroskiProduct({ ...product, name }, sourceUrl).packageSize).toEqual({ amount, unit });
    });
  it('rejects identity, currency, availability and approximate-weight guesses', () => {
    for (const invalid of [{ ...product, productId: '99' }, { ...product, canonicalUrl: sourceUrl.replace('18672311-', '99-') },
      { ...product, currency: 'USD' }, { ...product, orderable: false }, { ...product, price: '0' },
      { ...product, name: 'Producto 1 kg aprox.' }]) expect(() => normalizeEroskiProduct(invalid, sourceUrl)).toThrow();
    expect(() => normalizeEroskiProduct(product, sourceUrl.replace('supermercado.eroski.es', 'example.com'))).toThrow();
  });
});