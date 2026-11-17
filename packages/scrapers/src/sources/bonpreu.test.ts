import { afterEach, describe, expect, it, vi } from 'vitest';
import puppeteer, { type Browser } from 'puppeteer';
import { BonpreuScraper, normalizeBonpreuProduct } from './bonpreu.js';

afterEach(() => { vi.restoreAllMocks(); });

const sourceUrl = 'https://www.compraonline.bonpreuesclat.cat/products/tallarines-4-formatges/88841';
const product = { '@type': 'Product', sku: '88841', name: ' Tallarines 4 formatges', size: '0.28kg',
  offers: { '@type': 'Offer', price: '2.79', priceCurrency: 'EUR', availability: 'https://schema.org/InStock' } };

describe('Bonpreu official product documents', () => {
  it('reads the observed public product document without applying the second-unit promotion', () => {
    expect(normalizeBonpreuProduct(product, sourceUrl)).toMatchObject({ productId: 'bonpreu-88841',
      name: 'Tallarines 4 formatges', price: 2.79, available: true, packageSize: { amount: 0.28, unit: 'kg' },
      source: { provider: 'bonpreu-storefront', warehouse: 'public-catalog', url: sourceUrl } });
  });
  it.each([['6 x 1L', 6, 'l'], ['4 x 125g', 0.5, 'kg'], ['12u', 12, 'ud'], ['12 per paquet', 12, 'ud'], ['1 dotzena', 12, 'ud']])(
    'normalizes explicit packaging %s', (size, amount, unit) => {
      expect(normalizeBonpreuProduct({ ...product, size }, sourceUrl).packageSize).toEqual({ amount, unit });
    });
  it.each(['0kg', '0.83u', '1kg aprox.', 'a granel', ''])('rejects uncertain or invalid packaging %s', size => {
    expect(() => normalizeBonpreuProduct({ ...product, size }, sourceUrl)).toThrow();
  });
  it('binds the product identifier to the official source URL', () => {
    expect(() => normalizeBonpreuProduct(product, sourceUrl.replace('/88841', '/88842'))).toThrow('identity');
    expect(() => normalizeBonpreuProduct(product, sourceUrl.replace('www.compraonline.bonpreuesclat.cat', 'example.com'))).toThrow('identity');
  });
  it('rejects approximate or variable weights even when the size field looks precise', () => {
    expect(() => normalizeBonpreuProduct({ ...product, description: 'Pes aproximat de 280 g' }, sourceUrl)).toThrow('packaging');
    expect(() => normalizeBonpreuProduct({ ...product, name: 'Producte a granel' }, sourceUrl)).toThrow('packaging');
  });
  it('rejects unsupported offers and missing availability instead of guessing', () => {
    for (const offers of [{ ...product.offers, priceCurrency: 'USD' }, { ...product.offers, price: '0' },
      { ...product.offers, availability: undefined }, { ...product.offers, '@type': 'AggregateOffer' }]) {
      expect(() => normalizeBonpreuProduct({ ...product, offers }, sourceUrl)).toThrow();
    }
    expect(normalizeBonpreuProduct({ ...product, offers: { ...product.offers, availability: 'https://schema.org/OutOfStock' } }, sourceUrl).available).toBe(false);
  });
});

describe('Bonpreu source failures', () => {
  it.each([403, 429])('propagates an HTTP %s document failure', async status => {
    const close = vi.fn().mockResolvedValue(undefined);
    const response = { status: () => status, headers: () => ({ 'retry-after': '3600' }) };
    vi.spyOn(puppeteer, 'launch').mockResolvedValue({ newPage: async () => ({
      goto: async () => response,
    }), close } as unknown as Browser);
    const read = new BonpreuScraper().getProductPrice('bonpreu-88841', sourceUrl);
    await expect(read).rejects.toMatchObject({ response: { status, headers: { 'retry-after': '3600' } } });
    expect(close).toHaveBeenCalledTimes(1);
  });
  it.each([{ documents: [product] }, { documents: [] }, { documents: [product, product] }])('accepts only one structured Product in a successful HTML response', async ({ documents }) => {
    const close = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(puppeteer, 'launch').mockResolvedValue({ newPage: async () => ({
      goto: async () => ({ status: () => 200 }), url: () => sourceUrl, $$eval: async () => documents,
    }), close } as unknown as Browser);
    const read = new BonpreuScraper().getProductPrice('bonpreu-88841', sourceUrl);
    if (documents.length === 1) await expect(read).resolves.toMatchObject({ productId: 'bonpreu-88841', price: 2.79 });
    else await expect(read).rejects.toThrow('Missing or ambiguous');
    expect(close).toHaveBeenCalledTimes(1);
  });
  it('does not report a failed source as an empty catalog', async () => {
    vi.spyOn(puppeteer, 'launch').mockRejectedValueOnce(new Error('Source unavailable'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(new BonpreuScraper().searchProducts('llet')).rejects.toThrow('Source unavailable');
  });
});