import { afterEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { ConsumScraper } from './consum.js';

afterEach(() => { vi.restoreAllMocks(); });

function product(description = 'Leche Semidesnatada Brik 1 L', price = 0.83, unitPrice = 0.83, basis = '1 L') {
  return {
    id: 5932, productData: { name: 'Leche Semidesnatada Brik', description, availability: '1', temporaryOutOfStock: false },
    priceData: { unitPriceUnitType: basis, prices: [{ id: 'PRICE', value: { centAmount: price, centUnitAmount: unitPrice } }] },
    categories: [],
  };
}

describe('Consum authoritative REST source', () => {
  it('does not hide source failures as an empty search', async () => {
    vi.spyOn(axios, 'get').mockRejectedValueOnce(new Error('Source unavailable'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(new ConsumScraper().searchProducts('leche')).rejects.toThrow('Source unavailable');
  });

  it('keeps the euro scale observed in the live API and records source context', async () => {
    const get = vi.spyOn(axios, 'get').mockResolvedValueOnce({ data: product() });
    const quote = await new ConsumScraper().getProductPrice('consum-5932');
    expect(quote.price).toBe(0.83);
    expect(quote.packageSize).toEqual({ amount: 1, unit: 'l' });
    expect(quote.source).toEqual({ provider: 'consum-rest', warehouse: 'public-catalog', url: 'https://tienda.consum.es/api/rest/V1.0/catalog/product/5932' });
    expect(get).toHaveBeenCalledWith(expect.stringContaining('/catalog/product/5932'), expect.objectContaining({ timeout: 15000 }));
  });

  it('uses the ordinary price, not offers with unverified purchase conditions', async () => {
    const data = product();
    data.priceData.prices.push({ id: 'OFFER_PRICE', value: { centAmount: 0.5, centUnitAmount: 0.5 } });
    vi.spyOn(axios, 'get').mockResolvedValueOnce({ data });
    expect((await new ConsumScraper().getProductPrice('consum-5932')).price).toBe(0.83);
  });

  it.each([
    ['Yogur Natural 4 x 125 Gr', 0.75, 1.5, '1 Kg', 0.5, 'kg'],
    ['Huevos M 12 Uds', 2.4, 0.2, '1 Ud', 12, 'ud'],
    ['Huevos M Medianos Docena 1 Dc', 2.85, 2.85, '1 Dc', 12, 'ud'],
    ['Arroz 1 Kg', 1.3, 1.3, '1 Kg', 1, 'kg'],
  ])('normalizes explicit packaging: %s', async (description, price, unitPrice, basis, amount, unit) => {
    vi.spyOn(axios, 'get').mockResolvedValueOnce({ data: product(description, price, unitPrice, basis) });
    expect((await new ConsumScraper().getProductPrice('consum-5932')).packageSize).toEqual({ amount, unit });
  });

  it.each(['Yogur Natural', 'Yogur Natural 500 Gr', 'Yogur Natural peso variable 1 L', 'Huevos 0,83 Dc'])('does not guess inconsistent packaging: %s', async description => {
    vi.spyOn(axios, 'get').mockResolvedValueOnce({ data: product(description) });
    expect((await new ConsumScraper().getProductPrice('consum-5932')).packageSize).toBeUndefined();
  });

  it('preserves explicit out-of-stock status', async () => {
    const data = product(); data.productData.temporaryOutOfStock = true;
    vi.spyOn(axios, 'get').mockResolvedValueOnce({ data });
    expect((await new ConsumScraper().getProductPrice('consum-5932')).available).toBe(false);
  });

  it('rejects unknown availability, invalid prices and changed identities', async () => {
    const data = product(); data.productData.availability = 'unknown';
    vi.spyOn(axios, 'get').mockResolvedValueOnce({ data });
    await expect(new ConsumScraper().getProductPrice('consum-5932')).rejects.toThrow('availability');
    vi.mocked(axios.get).mockResolvedValueOnce({ data: product(undefined, 0) });
    await expect(new ConsumScraper().getProductPrice('consum-5932')).rejects.toThrow('price');
    vi.mocked(axios.get).mockResolvedValueOnce({ data: { ...product(), id: 99 } });
    await expect(new ConsumScraper().getProductPrice('consum-5932')).rejects.toThrow('different product');
    await expect(new ConsumScraper().getProductPrice('not-an-id')).rejects.toThrow('identifier');
  });
});