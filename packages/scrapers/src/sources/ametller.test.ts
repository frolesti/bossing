import { afterEach, describe, expect, it, vi } from 'vitest';
import puppeteer, { type Browser } from 'puppeteer';
import { AmetllerScraper, normalizeAmetllerProduct, normalizeAmetllerSearch } from './ametller.js';

afterEach(() => { vi.restoreAllMocks(); });

const url = 'https://www.ametllerorigen.com/mobify/proxy/api/product/shopper-products/v1/organizations/f_ecom_blzv_prd/products/2390?siteId=ametller&currency=EUR&locale=ca';
const storefront = 'https://www.ametllerorigen.com/ca/llet-semidesnatada-a2-llet-llet-ametller-origen-1l/2390.html';
const product = { id: '2390', name: 'Leche semidesnatada A2 Llet LLet Ametller Origen 1l', currency: 'EUR', price: 1.15,
  pricePerUnit: 1.15, unitMeasure: 'L', unitQuantity: 1, inventory: { orderable: true }, type: { item: true } };

describe('Ametller authoritative Salesforce API', () => {
  const searchUrl = 'https://www.ametllerorigen.com/mobify/proxy/api/search/shopper-search/v1/organizations/f_ecom_blzv_prd/product-search?siteId=ametller&currency=EUR&locale=ca&q=llet&offset=0&limit=1';
  const hit = { productId: '2390', productName: product.name, currency: 'EUR', price: 1.15, pricePerUnit: 1.15,
    orderable: true, productType: { item: true }, c_instaleapHit: { unit: 'L', quantity: 1 } };
  it('keeps valid search hits when an unrelated hit has invalid price metadata', () => {
    expect(normalizeAmetllerSearch({ total: 2, hits: [hit, { ...hit, productId: '99', price: 0 }] }, searchUrl).products).toHaveLength(1);
    expect(() => normalizeAmetllerSearch({ total: 1, hits: [{ ...hit, price: 0 }] }, searchUrl)).toThrow();
  });
  it('reads every observed search page through the same official API and keeps original quote contexts', async () => {
    const evaluate = vi.fn().mockResolvedValue({ status: 200, data: { total: 2, hits: [{ ...hit, productId: '19155' }] } });
    const close = vi.fn();
    vi.spyOn(puppeteer, 'launch').mockResolvedValue({ newPage: async () => ({
      goto: async () => ({ status: () => 200 }), $: async () => null, type: async () => {},
      keyboard: { press: async () => {} }, evaluate,
      waitForResponse: async () => ({ status: () => 200, url: () => searchUrl,
        json: async () => ({ total: 2, hits: [hit] }), request: () => ({ headers: () => ({}) }) }),
    }), close } as unknown as Browser);
    const results = await new AmetllerScraper().searchProducts('llet');
    expect(results.map(item => item.productId)).toEqual(['ametller-2390', 'ametller-19155']);
    expect(evaluate).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ url: searchUrl.replace('offset=0', 'offset=1') }));
    expect(results[1].source?.url).toContain('offset=1');
    expect(close).toHaveBeenCalledOnce();
  });
  it('preserves the actually queried search URL rather than inventing a product-detail read', () => {
    const search = 'https://www.ametllerorigen.com/mobify/proxy/api/search/shopper-search/v1/organizations/f_ecom_blzv_prd/product-search?siteId=ametller&currency=EUR&locale=ca&q=llet';
    expect(normalizeAmetllerProduct(product, search).source?.url).toBe(search);
  });
  it('does not report a broken source as an empty catalog', async () => {
    vi.spyOn(puppeteer, 'launch').mockRejectedValueOnce(new Error('Source unavailable'));
    await expect(new AmetllerScraper().searchProducts('llet')).rejects.toThrow('Source unavailable');
  });

  it('uses the observed single-unit euro price, not a conditional bundle offer', () => {
    expect(normalizeAmetllerProduct({ ...product, productPromotions: [{ calloutMsg: '2x2 EUR' }] }, url)).toMatchObject({
      productId: 'ametller-2390', price: 1.15, pricePerUnit: 1.15, packageSize: { amount: 1, unit: 'l' },
      source: { provider: 'ametller-scapi', warehouse: 'public-catalog' },
    });
  });

  it('converts an explicit dozen to pieces without rounding fractional source quantities', () => {
    const quote = normalizeAmetllerProduct({ ...product, name: 'Ous M - 12u.', unitMeasure: 'DZ' }, url);
    expect(quote.packageSize).toEqual({ amount: 12, unit: 'ud' });
    expect(quote.pricePerUnit).toBeCloseTo(1.15 / 12);
    expect(normalizeAmetllerProduct({ ...product, name: 'Ous M - 10u.', unitMeasure: 'DZ', unitQuantity: 0.83 }, url).packageSize).toBeUndefined();
  });

  it.each([
    ['Pasta 500g', 'KG', 0.5, 2.3], ['Iogurt 4x125g', 'KG', 0.5, 2.3],
    ['Iogurt natural 125g - 4u.', 'KG', 0.5, 2.3], ['Arròs 1kg D.O Delta', 'KG', 1, 1.15],
    ['Oli 750ml', 'L', 0.75, 1.53], ['Ous M 12u', 'UD', 12, 0.1],
  ])('validates explicit packaging against structured quantity and unit price: %s', (name, unitMeasure, unitQuantity, pricePerUnit) => {
    const quote = normalizeAmetllerProduct({ ...product, name, unitMeasure, unitQuantity, pricePerUnit }, url);
    expect(quote.packageSize).toEqual({ amount: unitQuantity, unit: unitMeasure === 'KG' ? 'kg' : unitMeasure === 'L' ? 'l' : 'ud' });
  });

  it.each(['Llet sense format', 'Llet 500ml', 'Llet aprox 1l', 'Llet 1l + 200ml'])('does not invent a package: %s', name => {
    expect(normalizeAmetllerProduct({ ...product, name }, url).packageSize).toBeUndefined();
  });

  it('preserves unavailability and rejects unknown availability, price or identity', () => {
    expect(normalizeAmetllerProduct({ ...product, inventory: { orderable: false } }, url).available).toBe(false);
    for (const invalid of [{ ...product, inventory: undefined }, { ...product, price: 0 }, { ...product, currency: 'USD' },
      { ...product, id: '99' }, { ...product, unitMeasure: 'unknown' }]) expect(() => normalizeAmetllerProduct(invalid, url)).toThrow();
    expect(() => normalizeAmetllerProduct(product, url.replace('www.ametllerorigen.com', 'example.com'))).toThrow();
    expect(() => normalizeAmetllerProduct(product, url.replace('locale=ca', 'locale=es'))).toThrow();
  });

  it('propagates source HTTP failures, honors retry metadata and closes the browser', async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(puppeteer, 'launch').mockResolvedValue({ newPage: async () => ({
      goto: async () => ({ status: () => 200 }),
      waitForResponse: async () => ({ status: () => 429, headers: () => ({ 'retry-after': '7200' }) }),
    }), close } as unknown as Browser);
    await expect(new AmetllerScraper().getProductPrice('ametller-2390', storefront)).rejects.toMatchObject({ response: { status: 429, headers: { 'retry-after': '7200' } } });
    expect(close).toHaveBeenCalledTimes(1);
  });
});