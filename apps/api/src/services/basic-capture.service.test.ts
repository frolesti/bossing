import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AMETLLER_BASICS, CAPRABO_BASICS, CONSUM_BASICS, MERCADONA_BASICS } from './basic-foods.js';
import type { ScrapedPrice } from '@bossing/shared';

const mocks = vi.hoisted(() => ({
  jobs: new Map<string, Record<string, unknown>>(), getPrice: vi.fn(), getConsumPrice: vi.fn(), getCapraboPrice: vi.fn(), getAmetllerPrice: vi.fn(), setPostalCode: vi.fn(), record: vi.fn(),
}));

vi.mock('@bossing/scrapers', () => ({ MercadonaScraper: class {
  setPostalCode = mocks.setPostalCode;
  getProductPrice = mocks.getPrice;
}, ConsumScraper: class { getProductPrice = mocks.getConsumPrice; },
  CapraboScraper: class { getProductPrice = mocks.getCapraboPrice; },
  AmetllerScraper: class { getProductPrice = mocks.getAmetllerPrice; } }));

const fakeDatabase = { scrapingJob: {
  findFirst: async ({ where }: { where: { id: { startsWith: string; endsWith: string } } }) => structuredClone(
    [...mocks.jobs.values()].filter(job => String(job.id).startsWith(where.id.startsWith) && String(job.id).endsWith(where.id.endsWith)).at(-1) || null),
  upsert: async ({ create }: { create: Record<string, unknown> }) => {
    const id = String(create.id);
    if (mocks.jobs.has(id)) return structuredClone(mocks.jobs.get(id));
    const job = { status: 'pending', startedAt: null, productsFound: 0, ...create };
    mocks.jobs.set(id, job);
    return structuredClone(job);
  },
  findUniqueOrThrow: async ({ where }: { where: { id: string } }) => structuredClone(mocks.jobs.get(where.id)),
  updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
    const job = mocks.jobs.get(String(where.id));
    if (!job || !Object.entries(where).every(([key, value]) => value instanceof Date
      ? job[key] instanceof Date && (job[key] as Date).getTime() === value.getTime() : job[key] === value)) return { count: 0 };
    Object.assign(job, data);
    return { count: 1 };
  },
} };

vi.mock('./price-history.service.js', async importOriginal => ({
  ...await importOriginal<typeof import('./price-history.service.js')>(),
  getHistoryDatabase: async () => fakeDatabase, recordPriceObservations: mocks.record,
}));

import { getBasicCaptureStatus, runBasicCapture } from './basic-capture.service.js';

function quoteFor(productId: string): ScrapedPrice {
  const reference = MERCADONA_BASICS.find(candidate => candidate.productId === productId)!;
  return { productId, name: reference.name, supermarket: 'Mercadona', supermarketId: 'mercadona',
    category: 'test', price: 1, pricePerUnit: 1, unit: reference.unit, available: true, scrapedAt: new Date(),
    packageSize: { amount: reference.amount, unit: reference.unit },
    source: { provider: 'mercadona-rest', warehouse: 'bcn1', url: `https://tienda.mercadona.es/api/products/${productId.slice(5)}/` } };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-01-02T08:00:00Z'));
  vi.stubEnv('BASIC_CAPTURE_POSTAL_CODE', '08001');
  mocks.jobs.clear();
  mocks.getPrice.mockReset().mockImplementation(async (id: string) => quoteFor(id));
  mocks.getConsumPrice.mockReset().mockImplementation(async (productId: string) => {
    const reference = CONSUM_BASICS.find(candidate => candidate.productId === productId)!;
    return { ...quoteFor(MERCADONA_BASICS[0].productId), productId, name: reference.name,
      supermarket: 'Consum', supermarketId: 'consum', unit: reference.unit,
      packageSize: { amount: reference.amount, unit: reference.unit },
      source: { provider: 'consum-rest', warehouse: 'public-catalog', url: `https://tienda.consum.es/api/rest/V1.0/catalog/product/${productId.slice(7)}` } };
  });
  mocks.setPostalCode.mockReset().mockResolvedValue('bcn1');
  mocks.getCapraboPrice.mockReset().mockImplementation(async (productId: string, url: string) => {
    const reference = CAPRABO_BASICS.find(candidate => candidate.productId === productId)!;
    return { ...quoteFor(MERCADONA_BASICS[0].productId), productId, name: reference.name,
      supermarket: 'Caprabo', supermarketId: 'caprabo', unit: reference.unit,
      packageSize: { amount: reference.amount, unit: reference.unit },
      source: { provider: 'caprabo-storefront', warehouse: 'public-catalog', url } };
  });
  mocks.record.mockReset().mockResolvedValue(1);
  mocks.getAmetllerPrice.mockReset().mockImplementation(async (productId: string) => {
    const reference = AMETLLER_BASICS.find(candidate => candidate.productId === productId)!;
    return { ...quoteFor(MERCADONA_BASICS[0].productId), productId, name: reference.name,
      supermarket: 'Ametller Origen', supermarketId: 'ametller', unit: reference.unit,
      packageSize: { amount: reference.amount, unit: reference.unit },
      source: { provider: 'ametller-scapi', warehouse: 'public-catalog',
        url: `https://www.ametllerorigen.com/mobify/proxy/api/product/shopper-products/v1/organizations/f_ecom_blzv_prd/products/${productId.slice(9)}?siteId=ametller&currency=EUR&locale=ca` } };
  });
});

afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe('Bounded daily capture', () => {
  it('honors Ametller rate limits independently and resumes the fourteen pinned references after backoff', async () => {
    mocks.getAmetllerPrice.mockRejectedValueOnce({ response: { status: 429, headers: { 'retry-after': '7200' } } });
    expect(await runBasicCapture('ametller')).toMatchObject({ status: 'partial', recorded: 0 });
    expect(await runBasicCapture('ametller')).toMatchObject({ skipped: true });
    expect(mocks.getAmetllerPrice).toHaveBeenCalledTimes(1);
    expect(await runBasicCapture('consum')).toMatchObject({ status: 'complete', recorded: 15 });
    vi.setSystemTime(new Date('2026-01-02T10:00:01Z'));
    expect(await runBasicCapture('ametller')).toMatchObject({ status: 'complete', recorded: 14 });
    expect(mocks.getAmetllerPrice).toHaveBeenCalledTimes(15);
  });
  it('captures only the fourteen verified Ametller references and reports the missing bread honestly', async () => {
    expect(await runBasicCapture('ametller')).toMatchObject({ status: 'complete', recorded: 14, skipped: false });
    expect(await runBasicCapture('ametller')).toMatchObject({ status: 'complete', recorded: 14, skipped: true });
    expect(mocks.getAmetllerPrice).toHaveBeenCalledTimes(14);
    for (const reference of AMETLLER_BASICS) expect(mocks.getAmetllerPrice).toHaveBeenCalledWith(reference.productId, reference.sourceUrl);
    const status = await getBasicCaptureStatus();
    expect(status.chains.find(chain => chain.chain === 'ametller')).toMatchObject({ references: 14, missingFoods: ['bread'], current: true });
  });
  it('reports freshness, context and packaging separately for every active chain', async () => {
    await runBasicCapture();
    const before = await getBasicCaptureStatus();
    expect(before.current).toBe(false);
    expect(before.chains.find(chain => chain.chain === 'consum')).toMatchObject({ current: false, context: 'public-catalog', latest: null });
    await runBasicCapture('consum');
    await runBasicCapture('caprabo');
    await runBasicCapture('ametller');
    const after = await getBasicCaptureStatus();
    expect(after.current).toBe(true);
    expect(after.chains.find(chain => chain.chain === 'consum')).toMatchObject({
      current: true, references: 15, products: CONSUM_BASICS, latest: { recorded: 15, status: 'complete' },
    });
    expect(after.chains.find(chain => chain.chain === 'carrefour')).toMatchObject({ status: 'pending-validation', references: 0 });
  });
  it('captures Consum independently with exact references and no invented postal-code context', async () => {
    expect(await runBasicCapture('consum')).toMatchObject({ status: 'complete', recorded: 15, skipped: false });
    expect(await runBasicCapture('consum')).toMatchObject({ status: 'complete', recorded: 15, skipped: true });
    expect(mocks.setPostalCode).not.toHaveBeenCalled();
    expect(mocks.getConsumPrice).toHaveBeenCalledTimes(15);
    expect([...mocks.jobs.keys()]).toEqual(['basics:v1:2026-01-02:consum:public-catalog']);
    expect(await runBasicCapture()).toMatchObject({ status: 'complete', recorded: 15, skipped: false });
    expect(mocks.jobs.size).toBe(2);
    expect(mocks.record).toHaveBeenCalledTimes(30);
  });

  it('pins Caprabo detail URLs and records only one price per product and day', async () => {
    expect(await runBasicCapture('caprabo')).toMatchObject({ status: 'complete', recorded: 15, skipped: false });
    expect(await runBasicCapture('caprabo')).toMatchObject({ status: 'complete', recorded: 15, skipped: true });
    for (const reference of CAPRABO_BASICS) expect(mocks.getCapraboPrice).toHaveBeenCalledWith(reference.productId, reference.sourceUrl);
    expect(mocks.getCapraboPrice).toHaveBeenCalledTimes(15);
    expect(mocks.setPostalCode).not.toHaveBeenCalled();
    expect(mocks.record).toHaveBeenCalledTimes(15);
  });

  it('stops Caprabo requests on a forbidden response without preventing Consum capture', async () => {
    mocks.getCapraboPrice.mockRejectedValueOnce({ response: { status: 403, headers: {} } });
    expect(await runBasicCapture('caprabo')).toMatchObject({ status: 'partial', recorded: 0 });
    expect(mocks.getCapraboPrice).toHaveBeenCalledTimes(1);
    expect(await runBasicCapture('caprabo')).toMatchObject({ skipped: true });
    expect(await runBasicCapture('consum')).toMatchObject({ status: 'complete', recorded: 15 });
  });

  it('does not let a Mercadona failure prevent the independent Consum capture', async () => {
    mocks.setPostalCode.mockRejectedValue(new Error('Mercadona unavailable'));
    await expect(runBasicCapture()).rejects.toThrow('Mercadona unavailable');
    expect(await runBasicCapture('consum')).toMatchObject({ status: 'complete', recorded: 15 });
    expect(await runBasicCapture()).toMatchObject({ status: 'failed', skipped: true });
    expect(mocks.getConsumPrice).toHaveBeenCalledTimes(15);
  });

  it('isolates Consum rate limits from Mercadona and resumes only missing Consum references', async () => {
    mocks.getConsumPrice.mockRejectedValueOnce({ response: { status: 429, headers: { 'retry-after': '7200' } } });
    expect(await runBasicCapture('consum')).toMatchObject({ status: 'partial', recorded: 0 });
    expect(await runBasicCapture('consum')).toMatchObject({ skipped: true });
    expect(await runBasicCapture()).toMatchObject({ status: 'complete', recorded: 15 });
    expect(mocks.getConsumPrice).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date('2026-01-02T10:00:01Z'));
    expect(await runBasicCapture('consum')).toMatchObject({ status: 'complete', recorded: 15 });
  });
  it('records fifteen references once and skips a completed day', async () => {
    expect(await runBasicCapture()).toMatchObject({ status: 'complete', recorded: 15, skipped: false });
    expect(await runBasicCapture()).toMatchObject({ status: 'complete', recorded: 15, skipped: true });
    expect(mocks.getPrice).toHaveBeenCalledTimes(15);
    expect(mocks.record).toHaveBeenCalledTimes(15);
  });

  it('resumes only a failed reference after backoff and preserves successful items', async () => {
    mocks.getPrice.mockRejectedValueOnce(new Error('Source unavailable'));
    expect(await runBasicCapture()).toMatchObject({ status: 'partial', recorded: 14 });
    expect(await runBasicCapture()).toMatchObject({ skipped: true });
    vi.setSystemTime(new Date('2026-01-02T09:00:01Z'));
    expect(await runBasicCapture()).toMatchObject({ status: 'complete', recorded: 15 });
    expect(mocks.getPrice).toHaveBeenCalledTimes(16);
    expect(mocks.record).toHaveBeenCalledTimes(15);
  });

  it('does not convert unavailability or changed packaging into a price point', async () => {
    mocks.getPrice.mockImplementation(async (id: string) => {
      const quote = quoteFor(id);
      if (id === MERCADONA_BASICS[0].productId) quote.available = false;
      if (id === MERCADONA_BASICS[1].productId) quote.packageSize = { amount: 99, unit: 'kg' };
      return quote;
    });
    expect(await runBasicCapture()).toMatchObject({ status: 'partial', recorded: 13 });
    expect(mocks.record).toHaveBeenCalledTimes(13);
    const result = JSON.parse(String([...mocks.jobs.values()][0].result));
    expect(result.items.milk.state).toBe('unavailable');
    expect(result.items.rice.state).toBe('error');
  });

  it('honours rate limits and stops issuing requests during Retry-After', async () => {
    mocks.getPrice.mockRejectedValueOnce({ response: { status: 429, headers: { 'retry-after': '7200' } } });
    expect(await runBasicCapture()).toMatchObject({ status: 'partial', recorded: 0 });
    expect(mocks.getPrice).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date('2026-01-02T09:00:01Z'));
    expect(await runBasicCapture()).toMatchObject({ skipped: true });
    expect(mocks.getPrice).toHaveBeenCalledTimes(1);
  });

  it('allows only one concurrent worker to claim the same day', async () => {
    const results = await Promise.all([runBasicCapture(), runBasicCapture()]);
    expect(results.filter(result => result.skipped), JSON.stringify(results)).toHaveLength(1);
    expect(mocks.getPrice).toHaveBeenCalledTimes(15);
    expect(mocks.record).toHaveBeenCalledTimes(15);
  });

  it('honours Retry-After when the source rejects the postal-code context', async () => {
    mocks.setPostalCode.mockRejectedValue({ response: { status: 429, headers: { 'retry-after': '7200' } } });
    await expect(runBasicCapture()).rejects.toBeDefined();
    vi.setSystemTime(new Date('2026-01-02T09:00:01Z'));
    expect(await runBasicCapture()).toMatchObject({ status: 'failed', skipped: true });
    expect(mocks.setPostalCode).toHaveBeenCalledTimes(1);
  });

  it('keeps a source backoff even when the next commercial day starts', async () => {
    mocks.setPostalCode.mockRejectedValue({ response: { status: 429, headers: { 'retry-after': '86400' } } });
    await expect(runBasicCapture()).rejects.toBeDefined();
    vi.setSystemTime(new Date('2026-01-03T06:00:00Z'));
    expect(await runBasicCapture()).toMatchObject({ status: 'failed', skipped: true });
    expect(mocks.setPostalCode).toHaveBeenCalledTimes(1);
    expect(mocks.jobs.size).toBe(1);
  });

  it('bounds source-context failures to three attempts and starts a new job on the next day', async () => {
    mocks.setPostalCode.mockRejectedValue(new Error('Source context unavailable'));
    for (const hour of [8, 10, 12]) {
      vi.setSystemTime(new Date(`2026-01-02T${String(hour).padStart(2, '0')}:00:00Z`));
      await expect(runBasicCapture()).rejects.toThrow('Source context unavailable');
    }
    vi.setSystemTime(new Date('2026-01-02T14:00:00Z'));
    expect(await runBasicCapture()).toMatchObject({ status: 'failed', skipped: true });
    expect(mocks.setPostalCode).toHaveBeenCalledTimes(3);
    vi.setSystemTime(new Date('2026-01-03T08:00:00Z'));
    mocks.setPostalCode.mockResolvedValue('bcn1');
    expect(await runBasicCapture()).toMatchObject({ status: 'complete', recorded: 15 });
    expect(mocks.jobs.size).toBe(2);
  });
});