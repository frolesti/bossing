import puppeteer, { type Page, type HTTPResponse } from 'puppeteer';
import { BaseScraper, type ScraperConfig } from '../base.js';
import type { ScrapedPrice, Product } from '@bossing/shared';

const config: ScraperConfig = {
  name: 'Ametller Origen',
  baseUrl: 'https://www.ametllerorigen.com',
  rateLimit: 1,
  enabled: true,
};

const productPath = '/mobify/proxy/api/product/shopper-products/v1/organizations/f_ecom_blzv_prd/products/';
const searchPath = '/mobify/proxy/api/search/shopper-search/v1/organizations/f_ecom_blzv_prd/product-search';

interface AmetllerProduct {
  id: string;
  name: string;
  currency: string;
  price: number;
  pricePerUnit: number;
  unitMeasure: string;
  unitQuantity: number;
  inventory: { orderable: boolean };
  type: { item: boolean };
  imageGroups?: { images: { link: string }[] }[];
  primaryCategoryId?: string;
}

interface AmetllerSearchHit {
  productId: string;
  productName: string;
  currency: string;
  price: number;
  pricePerUnit: number;
  orderable: boolean;
  productType: { item: boolean };
  c_instaleapHit?: { unit: string; quantity: number };
}

export function normalizeAmetllerSearch(value: unknown, sourceUrl: string): { products: ScrapedPrice[]; total: number; count: number } {
  const data = value as { hits?: AmetllerSearchHit[]; total?: number } | null;
  if (!data || !Array.isArray(data.hits) || !Number.isSafeInteger(data.total) || data.total! < data.hits.length) {
    throw new Error('Invalid Ametller search response');
  }
  const products: ScrapedPrice[] = [];
  for (const hit of data.hits) {
    try {
      products.push(normalizeAmetllerProduct({ id: hit.productId, name: hit.productName, currency: hit.currency,
        price: hit.price, pricePerUnit: hit.pricePerUnit, unitMeasure: hit.c_instaleapHit?.unit,
        unitQuantity: hit.c_instaleapHit?.quantity, inventory: { orderable: hit.orderable }, type: hit.productType }, sourceUrl));
    } catch (error) {
      console.warn('[Ametller] Search hit rejected:', hit.productId, error instanceof Error ? error.message : error);
    }
  }
  if (data.hits.length && !products.length) throw new Error('No Ametller search hits could be validated');
  return { products, total: data.total!, count: data.hits.length };
}

export function normalizeAmetllerProduct(value: unknown, sourceUrl: string, scrapedAt = new Date()): ScrapedPrice {
  const product = value as Partial<AmetllerProduct> | null;
  if (!product || typeof product.id !== 'string' || !/^\d+$/.test(product.id) || !product.name?.trim() ||
    product.type?.item !== true || typeof product.inventory?.orderable !== 'boolean') throw new Error('Invalid Ametller product identity or availability');
  const source = new URL(sourceUrl);
  if (source.protocol !== 'https:' || source.hostname !== 'www.ametllerorigen.com' || source.username || source.password ||
    (source.pathname !== `${productPath}${product.id}` && source.pathname !== searchPath) || source.searchParams.get('siteId') !== 'ametller' ||
    source.searchParams.get('currency') !== 'EUR' || source.searchParams.get('locale') !== 'ca') throw new Error('Unconfirmed Ametller product source');
  if (product.currency !== 'EUR' || typeof product.price !== 'number' || !Number.isFinite(product.price) || product.price <= 0 ||
    Math.abs(Math.round(product.price * 100) / 100 - product.price) > 1e-8 ||
    typeof product.pricePerUnit !== 'number' || !Number.isFinite(product.pricePerUnit) || product.pricePerUnit <= 0 ||
    typeof product.unitQuantity !== 'number' || !Number.isFinite(product.unitQuantity) || product.unitQuantity <= 0) {
    throw new Error('Invalid Ametller price or quantity');
  }
  const units: Record<string, string> = { KG: 'kg', L: 'l', UD: 'ud', U: 'ud', UN: 'ud', ST: 'ud', DZ: 'ud' };
  const unit = units[product.unitMeasure || ''];
  if (!unit) throw new Error('Unknown Ametller unit-price basis');
  const quantity = product.unitQuantity * (product.unitMeasure === 'DZ' ? 12 : 1);
  const pricePerUnit = product.pricePerUnit / (product.unitMeasure === 'DZ' ? 12 : 1);
  const name = product.name.toLowerCase().trim();
  const trailingPack = name.match(/(\d+(?:[.,]\d+)?)\s*(kg|gr|g|ml|cl|l)\s*-\s*(\d+)\s*u[.,]?$/);
  const packages = [...name.matchAll(/(?:\b(\d+)\s*[x×]\s*)?(\d+(?:[.,]\d+)?)\s*(kg|gr|g|ml|cl|l|unitats|unidades|ud|u)\b[.,]?/g)];
  const packaging = trailingPack ? [trailingPack[0], trailingPack[3], trailingPack[1], trailingPack[2]] : packages.length === 1 ? packages[0] : null;
  let packageSize: ScrapedPrice['packageSize'];
  if (packaging && !/aprox|peso variable|pes variable|a granel/.test(product.name.toLowerCase())) {
    const sourceUnit = packaging[3];
    const packUnit = /^(kg|gr|g)$/.test(sourceUnit) ? 'kg' : /^(ml|cl|l)$/.test(sourceUnit) ? 'l' : 'ud';
    const scale = /^(gr|g|ml)$/.test(sourceUnit) ? 0.001 : sourceUnit === 'cl' ? 0.01 : 1;
    const amount = Number(packaging[1] || 1) * Number(packaging[2].replace(',', '.')) * scale;
    if (Number.isFinite(amount) && amount > 0 && (packUnit !== 'ud' || Number.isInteger(amount)) && packUnit === unit &&
      Math.abs(amount - quantity) < 1e-8 && Math.abs(product.price / amount - pricePerUnit) <= 0.011) {
      packageSize = { amount, unit };
    }
  }
  const recordedSource = new URL(source.pathname, config.baseUrl);
  for (const key of ['siteId', 'currency', 'locale', 'q', 'offset', 'limit']) {
    const value = source.searchParams.get(key);
    if (value) recordedSource.searchParams.set(key, value);
  }
  return { productId: `ametller-${product.id}`, name: product.name.trim(), supermarket: 'Ametller Origen', supermarketId: 'ametller',
    price: product.price, pricePerUnit, unit, category: product.primaryCategoryId || 'Alimentació',
    imageUrl: product.imageGroups?.[0]?.images?.[0]?.link, available: product.inventory.orderable, scrapedAt, packageSize,
    source: { provider: 'ametller-scapi', warehouse: 'public-catalog', url: recordedSource.href } };
}

export class AmetllerScraper extends BaseScraper {
  private nextRequestAt = 0;

  constructor() {
    super(config);
  }

  private async withPage<T>(operation: (page: Page) => Promise<T>): Promise<T> {
    const now = Date.now();
    const scheduledAt = Math.max(now, this.nextRequestAt);
    this.nextRequestAt = scheduledAt + 1000 / this.config.rateLimit;
    if (scheduledAt > now) await new Promise(resolve => setTimeout(resolve, scheduledAt - now));
    const browser = await puppeteer.launch({ headless: 'new' });
    try {
      return await operation(await browser.newPage());
    } finally { await browser.close(); }
  }

  private checkResponse(response: HTTPResponse | null): asserts response is HTTPResponse {
    if (!response || response.status() >= 400) throw Object.assign(new Error(`Ametller HTTP ${response?.status() || 'unavailable'}`), {
      response: { status: response?.status(), headers: { 'retry-after': response?.headers()['retry-after'] } },
    });
  }

  async getProductPrice(productId: string, storefrontUrl: string): Promise<ScrapedPrice> {
    if (!/^ametller-\d+$/.test(productId)) throw new Error('Invalid Ametller product identifier');
    const url = new URL(storefrontUrl);
    if (url.protocol !== 'https:' || url.hostname !== 'www.ametllerorigen.com' || url.username || url.password ||
      !new RegExp(`^/ca/[^/]+/${productId.slice(9)}\\.html$`).test(url.pathname)) throw new Error('Invalid Ametller storefront URL');
    return this.withPage(async page => {
      const observed = page.waitForResponse(response => {
        const source = new URL(response.url());
        return source.hostname === 'www.ametllerorigen.com' && source.pathname === `${productPath}${productId.slice(9)}` &&
          source.searchParams.get('siteId') === 'ametller' && source.searchParams.get('currency') === 'EUR' && source.searchParams.get('locale') === 'ca';
      }, { timeout: 30_000 });
      const navigation = page.goto(url.href, { waitUntil: 'networkidle2', timeout: 45_000 }).then(response => this.checkResponse(response));
      const [, response] = await Promise.all([navigation, observed]);
      this.checkResponse(response);
      const quote = normalizeAmetllerProduct(await response.json(), response.url());
      if (quote.productId !== productId) throw new Error('Ametller returned a different product');
      return quote;
    });
  }

  async searchProducts(query: string): Promise<ScrapedPrice[]> {
    return this.withPage(async page => {
      const observed = page.waitForResponse(response => {
        const source = new URL(response.url());
        return source.hostname === 'www.ametllerorigen.com' && source.pathname === searchPath && source.searchParams.get('q') === query &&
          source.searchParams.get('siteId') === 'ametller' && source.searchParams.get('currency') === 'EUR' && source.searchParams.get('locale') === 'ca';
      }, { timeout: 30_000 });
      const interaction = (async () => {
        this.checkResponse(await page.goto(`${this.config.baseUrl}/ca/online`, { waitUntil: 'networkidle2', timeout: 45_000 }));
        const reject = await page.$('#CybotCookiebotDialogBodyButtonDecline');
        if (reject) await reject.click();
        await page.type('input[placeholder="Cercar productes..."]', query);
        await page.keyboard.press('Enter');
      })();
      const [, response] = await Promise.all([interaction, observed]);
      this.checkResponse(response);
      const first = normalizeAmetllerSearch(await response.json(), response.url());
      const results = [...first.products];
      const source = new URL(response.url());
      let offset = Number(source.searchParams.get('offset') || 0) + first.count;
      while (offset < first.total) {
        if (!first.count) throw new Error('Ametller search pagination made no progress');
        source.searchParams.set('offset', String(offset));
        await new Promise(resolve => setTimeout(resolve, 1000 / this.config.rateLimit));
        const next = await page.evaluate(async ({ url, authorization }) => {
          const result = await fetch(url, { headers: authorization ? { authorization } : {} });
          return { status: result.status, retryAfter: result.headers.get('retry-after'),
            data: result.ok ? await result.json() : null };
        }, { url: source.href, authorization: response.request().headers().authorization });
        if (next.status >= 400) throw Object.assign(new Error(`Ametller HTTP ${next.status}`), {
          response: { status: next.status, headers: { 'retry-after': next.retryAfter } },
        });
        const batch = normalizeAmetllerSearch(next.data, source.href);
        if (!batch.count) throw new Error('Ametller search pagination made no progress');
        results.push(...batch.products);
        offset += batch.count;
      }
      return [...new Map(results.map(product => [product.productId, product])).values()];
    });
  }

  async scrapeProducts(): Promise<ScrapedPrice[]> {
    throw new Error('Ametller full-catalog capture is not supported');
  }

  async scrapeProductDetails(): Promise<Product | null> { return null; }
}

export const ametllerScraper = new AmetllerScraper();
