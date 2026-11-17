import { afterEach, describe, expect, it, vi } from 'vitest';
import axios, { type AxiosInstance } from 'axios';
import { MercadonaScraper } from './mercadona.js';
import { calculatePurchaseLine, summarizeBasket } from '@bossing/shared';

afterEach(() => {
  vi.restoreAllMocks();
});

function officialProduct(overrides = {}) {
  return {
    id: '10381', display_name: 'Leche semidesnatada Hacendado', published: true,
    thumbnail: '', categories: [], unavailable_from: null,
    price_instructions: {
      unit_price: '4.98', reference_price: '0.830', reference_format: 'L',
      unit_size: 6, size_format: 'l', is_pack: true, pack_size: 1,
      total_units: 6, approx_size: false, selling_method: 0,
    },
    ...overrides,
  };
}

function mockSource() {
  const get = vi.fn();
  const put = vi.fn();
  vi.spyOn(axios, 'create').mockReturnValue({
    get, put, interceptors: { request: { use: vi.fn() } },
  } as unknown as AxiosInstance);
  return { scraper: new MercadonaScraper(), get, put };
}

describe('Mercadona authoritative source', () => {
  it('does not try another source on an empty catalog search', async () => {
    const scraper = new MercadonaScraper();
    vi.spyOn(scraper, 'loadFullCatalog').mockResolvedValue([]);
    const post = vi.spyOn(axios, 'post');
    expect(await scraper.searchProducts('leche')).toEqual([]);
    expect(post).not.toHaveBeenCalled();
  });

  it('propagates source failure instead of returning no matches', async () => {
    const scraper = new MercadonaScraper();
    vi.spyOn(scraper, 'loadFullCatalog').mockRejectedValue(new Error('source unavailable'));
    await expect(scraper.searchProducts('leche')).rejects.toThrow('source unavailable');
  });

  it('retains the official total size, provenance and reference-price unit', async () => {
    const { scraper, get } = mockSource();
    const product = officialProduct();
    get.mockResolvedValue({ data: {
      ...product,
      price_instructions: { ...product.price_instructions, unit_size: 9, pack_size: 1.5 },
    } });
    const quote = await scraper.getProductPrice('merc-10381');
    expect(quote.packageSize).toEqual({ amount: 9, unit: 'l' });
    expect(quote.source).toEqual({
      provider: 'mercadona-rest', warehouse: 'bcn1',
      url: 'https://tienda.mercadona.es/api/products/10381/',
    });
    expect(quote.price).toBe(4.98);
    expect(quote.unit).toBe('l');
    expect(quote.available).toBe(true);
  });

  it('does not present variable-weight goods as fixed packages', async () => {
    const { scraper, get } = mockSource();
    const product = officialProduct();
    get.mockResolvedValue({ data: {
      ...product, price_instructions: { ...product.price_instructions, approx_size: true },
    } });
    expect((await scraper.getProductPrice('10381')).packageSize).toBeUndefined();
  });

  it('preserves decimal variant IDs returned by the official catalog', async () => {
    const { scraper, get } = mockSource();
    get.mockResolvedValue({ data: officialProduct({ id: '81649.1', display_name: 'Salmon a rodajas' }) });
    expect((await scraper.getProductPrice('merc-81649.1')).productId).toBe('merc-81649.1');
    expect(get).toHaveBeenCalledWith('/products/81649.1/', { params: { lang: 'es', wh: 'bcn1' } });
  });

  it('preserves unavailability instead of hardcoding available', async () => {
    const { scraper, get } = mockSource();
    get.mockResolvedValue({ data: officialProduct({ published: false }) });
    expect((await scraper.getProductPrice('10381')).available).toBe(false);
  });

  it('rejects invalid prices and product identity mismatches', async () => {
    const { scraper, get } = mockSource();
    get.mockResolvedValue({ data: officialProduct({ price_instructions: { unit_price: 'NaN' } }) });
    await expect(scraper.getProductPrice('10381')).rejects.toThrow('Invalid Mercadona price');
    get.mockResolvedValue({ data: officialProduct({ id: '5044' }) });
    await expect(scraper.getProductPrice('10381')).rejects.toThrow('different product');
  });

  it('shares catalog loads and deduplicates IDs across categories', async () => {
    const { scraper, get } = mockSource();
    get.mockImplementation(async (url: string) => ({ data: url === '/categories/'
      ? { results: [{ id: 1, name: 'Root', categories: [{ id: 72 }, { id: 73 }] }] }
      : { categories: [{ name: 'Milk', products: [officialProduct()] }] },
    }));
    const [first, second] = await Promise.all([scraper.loadFullCatalog(), scraper.loadFullCatalog()]);
    expect(first).toHaveLength(1);
    expect(first).toBe(second);
    await scraper.loadFullCatalog();
    expect(get).toHaveBeenCalledTimes(3);
  });

  it('does not cache partial catalogs when a category fails', async () => {
    const { scraper, get } = mockSource();
    get.mockImplementation(async (url: string) => {
      if (url === '/categories/') return { data: { results: [{ id: 1, categories: [{ id: 72 }] }] } };
      throw new Error('source unavailable');
    });
    await expect(scraper.loadFullCatalog()).rejects.toThrow('source unavailable');
    await expect(scraper.loadFullCatalog()).rejects.toThrow('source unavailable');
    expect(get).toHaveBeenCalledTimes(3);
  });

  it('does not silently retain a warehouse after postal-code failure', async () => {
    const { scraper, put } = mockSource();
    put.mockRejectedValue(new Error('postal code unavailable'));
    await expect(scraper.setPostalCode('08001')).rejects.toThrow('postal code unavailable');
  });

  it('explicitly rejects unsupported EAN lookup instead of using a second source', async () => {
    const { scraper, get } = mockSource();
    await expect(scraper.searchByEAN('8402001002090')).rejects.toThrow('not supported');
    expect(get).not.toHaveBeenCalled();
  });

  it('resolves leaf products by category ID without fuzzy name search', async () => {
    const { scraper, get } = mockSource();
    get.mockImplementation(async (url: string) => ({ data: url === '/categories/'
      ? { results: [{ id: 1, name: 'Root', categories: [{ id: 72, name: 'Milk' }] }] }
      : { categories: [{ id: 701, name: 'Semiskimmed', products: [officialProduct()] },
        { id: 702, name: 'Other', products: [] }] },
    }));
    await scraper.getSubcategories(72);
    expect(await scraper.getSubcategories(701)).toEqual([]);
    expect(await scraper.getCategoryProducts(701)).toHaveLength(1);
    expect(get).toHaveBeenLastCalledWith('/categories/72/', { params: { lang: 'es', wh: 'bcn1' } });
  });
});

describe('Reference basket purchases', () => {
  it('buys one egg carton for twelve eggs, not twelve cartons', async () => {
    const { scraper, get } = mockSource();
    const product = officialProduct();
    get.mockResolvedValue({ data: {
      ...product,
      price_instructions: { ...product.price_instructions, unit_price: '2.85',
        unit_size: 12, size_format: 'ud', reference_format: 'dc', is_pack: false },
    } });
    const quote = await scraper.getProductPrice('10381');
    expect(quote.unit).toBe('dc');
    expect(calculatePurchaseLine({ quantity: 12, unit: 'u' }, quote)).toEqual({
      found: true, packageCount: 1, purchasedQuantity: 12, lineTotalCents: 285, lineTotal: 2.85,
    });
  });

  it('rounds up to purchasable packs and exposes excess quantity', async () => {
    const { scraper, get } = mockSource();
    get.mockResolvedValue({ data: officialProduct() });
    const quote = await scraper.getProductPrice('10381');
    expect(calculatePurchaseLine({ quantity: 7, unit: 'l' }, quote)).toEqual({
      found: true, packageCount: 2, purchasedQuantity: 12, lineTotalCents: 996, lineTotal: 9.96,
    });
    expect(calculatePurchaseLine({ quantity: 6000, unit: 'ml' }, quote)).toMatchObject({ packageCount: 1 });
    expect(calculatePurchaseLine({ quantity: 6, unit: 'kg' }, quote)).toEqual({ found: false, reason: 'format' });
    expect(calculatePurchaseLine({ quantity: 6, unit: 'l', productId: 'merc-other' }, quote))
      .toEqual({ found: false, reason: 'identity' });
  });

  it('does not publish comparable totals for incomplete or unverified baskets', () => {
    const found = { found: true as const, packageCount: 1, purchasedQuantity: 1, lineTotalCents: 83, lineTotal: 0.83 };
    expect(summarizeBasket([found, { found: false, reason: 'missing' }], true))
      .toMatchObject({ complete: false, comparable: false, totalCost: null, subtotal: 0.83 });
    expect(summarizeBasket([found], false)).toMatchObject({ complete: true, comparable: false, totalCost: null });
    expect(summarizeBasket([found, found, found], true)).toMatchObject({ comparable: true, totalCost: 2.49 });
    expect(summarizeBasket([], true).comparable).toBe(false);
  });
});