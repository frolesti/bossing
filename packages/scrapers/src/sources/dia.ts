import puppeteer from 'puppeteer';
import { BaseScraper, type ScraperConfig } from '../base.js';
import type { Product, ScrapedPrice } from '@bossing/shared';

const config: ScraperConfig = {
  name: 'DIA',
  baseUrl: 'https://www.dia.es',
  rateLimit: 1,
  enabled: true,
};

export function normalizeDIAProduct(value: unknown, sourceUrl: string, scrapedAt = new Date()): ScrapedPrice {
  const product = value as { '@type'?: string; name?: string; sku?: string; image?: string;
    offers?: { '@type'?: string; url?: string; price?: number | string; priceCurrency?: string; availability?: string } } | null;
  const source = new URL(sourceUrl);
  const identifier = source.pathname.match(/\/p\/(\d+(?:P\d+)?)$/)?.[1];
  if (!product || product['@type'] !== 'Product' || typeof product.name !== 'string' || !product.name.trim() ||
    source.protocol !== 'https:' || source.hostname !== 'www.dia.es' || source.port || source.username || source.password ||
    source.search || source.hash || !identifier || (product.sku !== undefined && product.sku !== identifier)) {
    throw new Error('Unconfirmed DIA product identity');
  }
  const offer = product.offers;
  if (!offer || offer['@type'] !== 'Offer' || offer.url !== source.href || offer.priceCurrency !== 'EUR' ||
    (typeof offer.price !== 'number' && typeof offer.price !== 'string') || !/^\d+(?:\.\d{1,2})?$/.test(String(offer.price)) ||
    !Number.isFinite(Number(offer.price)) || Number(offer.price) <= 0) throw new Error('Invalid DIA official offer');
  if (typeof offer.availability !== 'string' || !/^https:\/\/schema\.org\/(InStock|OutOfStock)$/.test(offer.availability)) {
    throw new Error('Unconfirmed DIA availability');
  }
  const packaging = product.name.toLowerCase().trim().match(/(?:\b(\d+)\s*x\s*)?(\d+(?:[.,]\d+)?)\s*(kg|g|ml|cl|l|uds?|unidades?|docenas?)\.?$/);
  if (!packaging || /aprox|peso\s+variable|a\s+granel/i.test(product.name)) throw new Error('Unconfirmed DIA packaging');
  const sourceUnit = packaging[3];
  const unit = /^(kg|g)$/.test(sourceUnit) ? 'kg' : /^(ml|cl|l)$/.test(sourceUnit) ? 'l' : 'ud';
  const scale = sourceUnit === 'g' || sourceUnit === 'ml' ? 0.001 : sourceUnit === 'cl' ? 0.01 : sourceUnit.startsWith('docena') ? 12 : 1;
  const amount = Number(packaging[1] || 1) * Number(packaging[2].replace(',', '.')) * scale;
  if (!Number.isFinite(amount) || amount <= 0 || (unit === 'ud' && !Number.isInteger(amount))) throw new Error('Invalid DIA package amount');
  const price = Number(offer.price);
  return { productId: `dia-${identifier}`, name: product.name.trim(), supermarket: 'DIA', supermarketId: 'dia',
    price, pricePerUnit: price / amount, unit, category: 'Alimentació', imageUrl: typeof product.image === 'string' ? product.image : undefined,
    available: offer.availability.endsWith('/InStock'), scrapedAt, packageSize: { amount, unit },
    source: { provider: 'dia-storefront', warehouse: 'public-catalog', url: source.href } };
}

export class DIAScraper extends BaseScraper {
  private nextRequestAt = 0;

  constructor() {
    super(config);
  }

  private async readPage<T>(url: string, extract: (page: import('puppeteer').Page) => Promise<T>): Promise<T> {
    const now = Date.now();
    const scheduledAt = Math.max(now, this.nextRequestAt);
    this.nextRequestAt = scheduledAt + 1000 / this.config.rateLimit;
    if (scheduledAt > now) await new Promise(resolve => setTimeout(resolve, scheduledAt - now));
    const browser = await puppeteer.launch({ headless: 'new' });
    try {
      const page = await browser.newPage();
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      if (!response || response.status() >= 400) throw Object.assign(new Error(`DIA HTTP ${response?.status() || 'unavailable'}`), {
        response: { status: response?.status(), headers: { 'retry-after': response?.headers()['retry-after'] } },
      });
      if (new URL(page.url()).origin !== config.baseUrl) throw new Error('DIA redirected away from its storefront');
      return await extract(page);
    } finally { await browser.close(); }
  }

  async getProductPrice(productId: string, sourceUrl: string): Promise<ScrapedPrice> {
    const url = new URL(sourceUrl);
    if (!/^dia-\d+(?:P\d+)?$/.test(productId) || url.protocol !== 'https:' || url.origin !== config.baseUrl ||
      url.username || url.password || url.search || url.hash || !url.pathname.endsWith(`/p/${productId.slice(4)}`)) {
      throw new Error('Unconfirmed DIA product identity');
    }
    const documents = await this.readPage(url.href, page => page.$$eval('script[type="application/ld+json"]', elements =>
      elements.map(element => JSON.parse(element.textContent || 'null'))));
    const products = documents.filter(value => value?.['@type'] === 'Product');
    if (products.length !== 1) throw new Error('Missing or ambiguous DIA product data');
    return normalizeDIAProduct(products[0], url.href);
  }

  async searchProducts(query: string): Promise<ScrapedPrice[]> {
    const url = `${config.baseUrl}/search?${new URLSearchParams({ q: query })}`;
    const links = await this.readPage(url, page => page.$$eval('a[href*="/p/"]', elements =>
      [...new Set(elements.map(element => element.getAttribute('href')).filter((value): value is string => !!value))].slice(0, 12)));
    if (!links.length) throw new Error('No verifiable DIA search results');
    const quotes: ScrapedPrice[] = [];
    for (const link of links) {
      const productUrl = new URL(link, config.baseUrl);
      const identifier = productUrl.pathname.match(/\/p\/(\d+(?:P\d+)?)$/)?.[1];
      if (!identifier) throw new Error('Unconfirmed DIA search identity');
      quotes.push(await this.getProductPrice(`dia-${identifier}`, productUrl.href));
    }
    return quotes;
  }

  async getCategories() { return []; }
  async getCategoryProducts() { return []; }
  async scrapeProducts(): Promise<ScrapedPrice[]> { throw new Error('DIA full-catalog capture is not supported'); }
  async scrapeProductDetails(): Promise<Product | null> { return null; }
}

export const diaScraper = new DIAScraper();
export default DIAScraper;
