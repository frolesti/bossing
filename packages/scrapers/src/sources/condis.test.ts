import { describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { CondisScraper, normalizeCondisProduct, normalizeCondisSearch } from './condis.js';

const url = 'https://compraonline.condis.es/leche-ato-natura-semidesnatada-1-l/p/704004/es_ES';
const detail = `<div><div><h1 class="pdp-title-margin">LECHE ATO NATURA SEMIDESNATADA 1 L</h1>
  <span>Cantidad neta: 1.0 litros</span></div><div class="text-charcoalBlack">1,15 \u20ac</div>
  <button aria-busy="false">A\u00f1adir al carrito</button><div>Antes <span>1,24 \u20ac</span></div></div>`;
const html = `<link rel="canonical" href="${url}">${detail}<h2>Recommendation</h2><p>9,99 \u20ac</p>`;

describe('Condis official detail HTML', () => {
  it('uses search only to discover official SKU-bound URLs, never indexed prices', () => {
    const discovery = 'https://api.empathy.co/search/v1/query/condis/search?lang=es&store=718&query=leche';
    const item = { id: '704004', description: 'LECHE ATO NATURA SEMIDESNATADA 1 L', url, price: { current: 999 } };
    const result = normalizeCondisSearch({ catalog: { numFound: 4, content: [item, item,
      { ...item, url: 'https://example.com/product' }, { ...item, id: '99' }] } }, discovery);
    expect(result).toEqual({ total: 4, count: 4, references: [{ productId: 'condis-704004', sourceUrl: url }] });
    expect(normalizeCondisSearch({ catalog: { numFound: 1, content: [item] } }, discovery, () => false).references).toEqual([]);
    expect(() => normalizeCondisSearch({ catalog: { numFound: 0, content: [] } }, discovery.replace('store=718', 'store=99'))).toThrow();
  });
  it('paginates discovery and obtains every accepted price from its exact detail reader', async () => {
    const item = { id: '704004', description: 'LECHE', url };
    const get = vi.spyOn(axios, 'get').mockResolvedValueOnce({ data: { catalog: { numFound: 2, content: [item] } } })
      .mockResolvedValueOnce({ data: { catalog: { numFound: 2, content: [{ ...item, id: '704005', url: url.replace('704004', '704005') }] } } });
    const reader = new CondisScraper();
    const detail = vi.spyOn(reader, 'getProductPrice').mockImplementation(async (productId, sourceUrl) => ({
      ...normalizeCondisProduct(html, url), productId, source: { provider: 'condis-storefront', warehouse: 'public-catalog', url: sourceUrl },
    }));
    try {
      expect(await reader.searchProducts('leche')).toHaveLength(2);
      expect(new URL(get.mock.calls[1][0]).searchParams.get('start')).toBe('1');
      expect(detail).toHaveBeenCalledTimes(2);
    } finally { get.mockRestore(); detail.mockRestore(); }
  });
  it('uses the exact canonical SKU and current price, not previous or related prices', () => {
    expect(normalizeCondisProduct(html, url)).toMatchObject({ productId: 'condis-704004', price: 1.15,
      packageSize: { amount: 1, unit: 'l' }, available: true,
      source: { provider: 'condis-storefront', warehouse: 'public-catalog', url } });
  });
  it('continues past stale indexed details and exposes all verified quotes as partial results', async () => {
    const items = ['704004', '704005', '704006'].map(id => ({ id, description: 'LECHE', url: url.replace('704004', id) }));
    const get = vi.spyOn(axios, 'get').mockResolvedValue({ data: { catalog: { numFound: 3, content: items } } });
    const reader = new CondisScraper();
    const detail = vi.spyOn(reader, 'getProductPrice').mockResolvedValueOnce(normalizeCondisProduct(html, url))
      .mockRejectedValueOnce(Object.assign(new Error('HTTP 400'), { response: { status: 400 } }))
      .mockResolvedValueOnce({ ...normalizeCondisProduct(html, url), productId: 'condis-704006' });
    try {
      await expect(reader.searchProducts('leche')).rejects.toMatchObject({ partialResults: [
        expect.objectContaining({ productId: 'condis-704004' }), expect.objectContaining({ productId: 'condis-704006' }),
      ] });
      expect(detail).toHaveBeenCalledTimes(3);
    } finally { get.mockRestore(); detail.mockRestore(); }
  });
  it('accepts agreeing responsive copies and rejects conflicting copies', () => {
    expect(normalizeCondisProduct(html + detail, url).price).toBe(1.15);
    expect(() => normalizeCondisProduct(html + detail.replace('1,15', '1,16'), url)).toThrow();
  });
  it('uses the explicit egg count instead of the accompanying net weight', () => {
    const eggs = html.replace('LECHE ATO NATURA SEMIDESNATADA 1 L', 'HUEVOS CONDIS GALLINA CRIADA EN SUELO M 12 UNIDADES')
      .replace('1.0 litros', '636 gramos');
    expect(normalizeCondisProduct(eggs, url).packageSize).toEqual({ amount: 12, unit: 'ud' });
    expect(() => normalizeCondisProduct(eggs.replace('636 gramos', '0 gramos'), url)).toThrow();
  });
  it.each([['500 gramos', 0.5, 'kg'], ['12 unidades', 12, 'ud'], ['250 mililitros', 0.25, 'l']])(
    'normalizes explicit net quantity %s', (packaging, amount, unit) => {
      expect(normalizeCondisProduct(html.replace('1.0 litros', String(packaging)), url).packageSize).toEqual({ amount, unit });
    });
  it('rejects wrong identity, missing stock evidence, approximate packaging and invalid currency', () => {
    for (const invalid of [html.replace('href="' + url, 'href="' + url.replace('704004', '704006')),
      html.replace('aria-busy="false"', 'disabled aria-busy="false"'), html.replace('aria-busy="false"', 'aria-busy="true"'),
      html.replace('1.0 litros', '1 litro aprox.'), html.replace('1,15 \u20ac', '1,15 USD'), html.replace('1,15', '0,00')]) {
      expect(() => normalizeCondisProduct(invalid, url)).toThrow();
    }
    expect(() => normalizeCondisProduct(html, url + '?store=other')).toThrow();
  });
});