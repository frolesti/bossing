import puppeteer from 'puppeteer';
import { BaseScraper, type ScraperConfig } from '../base.js';
import type { Product, ScrapedPrice } from '@bossing/shared';

const config: ScraperConfig = {
  name: 'Alcampo', baseUrl: 'https://www.compraonline.alcampo.es', rateLimit: 1, enabled: true,
};

function productUrl(value: string, identifier: string): URL {
  const url = new URL(value, config.baseUrl);
  if (!/^\d+$/.test(identifier) || url.protocol !== 'https:' || url.origin !== config.baseUrl ||
    url.username || url.password || url.search || url.hash ||
    !new RegExp(`^/products/[^/]+/${identifier}$`).test(url.pathname)) throw new Error('Unconfirmed Alcampo product identity');
  return url;
}

export function normalizeAlcampoProduct(value: unknown, sourceUrl: string, scrapedAt = new Date()): ScrapedPrice {
  const product = value as { '@type'?: string; sku?: string; name?: string; description?: string; size?: string; image?: string[];
    offers?: { '@type'?: string; price?: string; priceCurrency?: string; availability?: string } } | null;
  if (!product || product['@type'] !== 'Product' || typeof product.sku !== 'string' || typeof product.name !== 'string' ||
    !product.name.trim()) throw new Error('Unconfirmed Alcampo product identity');
  const source = productUrl(sourceUrl, product.sku);
  const offer = product.offers;
  if (!offer || offer['@type'] !== 'Offer' || offer.priceCurrency !== 'EUR' || typeof offer.price !== 'string' ||
    !/^\d+(?:\.\d{1,2})?$/.test(offer.price) || !Number.isFinite(Number(offer.price)) || Number(offer.price) <= 0) {
    throw new Error('Invalid Alcampo euro price');
  }
  if (typeof offer.availability !== 'string' || !/^https:\/\/schema\.org\/(InStock|OutOfStock)$/.test(offer.availability)) {
    throw new Error('Unconfirmed Alcampo availability');
  }
  const packaging = typeof product.size === 'string'
    ? product.size.trim().toLowerCase().match(/^(?:(\d+)\s*x\s*)?(\d+(?:[.,]\d+)?)\s*(kg|g|ml|cl|l|uds?|unidad(?:es)?|por envase)$/) : null;
  if (!packaging || /aprox|peso\s+variable|a\s+granel/i.test(`${product.name} ${product.description || ''}`)) {
    throw new Error('Unconfirmed Alcampo packaging');
  }
  const sourceUnit = packaging[3];
  const unit = /^(kg|g)$/.test(sourceUnit) ? 'kg' : /^(ml|cl|l)$/.test(sourceUnit) ? 'l' : 'ud';
  const scale = sourceUnit === 'g' || sourceUnit === 'ml' ? 0.001 : sourceUnit === 'cl' ? 0.01 : 1;
  const amount = Number(packaging[1] || 1) * Number(packaging[2].replace(',', '.')) * scale;
  if (!Number.isFinite(amount) || amount <= 0 || (unit === 'ud' && !Number.isInteger(amount))) throw new Error('Invalid Alcampo package amount');
  const price = Number(offer.price);
  return { productId: `alcampo-${product.sku}`, name: product.name.trim(), supermarket: 'Alcampo', supermarketId: 'alcampo',
    price, pricePerUnit: price / amount, unit, category: 'Alimentació', imageUrl: Array.isArray(product.image) ? product.image[0] : undefined,
    available: offer.availability.endsWith('/InStock'), scrapedAt, packageSize: { amount, unit },
    source: { provider: 'alcampo-storefront', warehouse: 'public-catalog', url: source.href } };
}

export class AlcampoScraper extends BaseScraper {
  private nextRequestAt = 0;

  constructor() { super(config); }

  private async readPage<T>(url: string, extract: (page: import('puppeteer').Page) => Promise<T>): Promise<T> {
    const now = Date.now();
    const scheduledAt = Math.max(now, this.nextRequestAt);
    this.nextRequestAt = scheduledAt + 1000 / this.config.rateLimit;
    if (scheduledAt > now) await new Promise(resolve => setTimeout(resolve, scheduledAt - now));
    const browser = await puppeteer.launch({ headless: 'new' });
    try {
      const page = await browser.newPage();
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      if (!response || response.status() >= 400) throw Object.assign(new Error(`Alcampo HTTP ${response?.status() || 'unavailable'}`), {
        response: { status: response?.status(), headers: { 'retry-after': response?.headers()['retry-after'] } },
      });
      if (new URL(page.url()).origin !== config.baseUrl) throw new Error('Alcampo redirected away from its storefront');
      return await extract(page);
    } finally { await browser.close(); }
  }

  async getProductPrice(productId: string, sourceUrl: string): Promise<ScrapedPrice> {
    if (!/^alcampo-\d+$/.test(productId)) throw new Error('Invalid Alcampo product identifier');
    const url = productUrl(sourceUrl, productId.slice(8)).href;
    const documents = await this.readPage(url, page => page.$$eval('script[type="application/ld+json"]', elements =>
      elements.map(element => JSON.parse(element.textContent || 'null'))));
    const products = documents.filter(value => value?.['@type'] === 'Product');
    if (products.length !== 1) throw new Error('Missing or ambiguous Alcampo product data');
    return normalizeAlcampoProduct(products[0], url);
  }

  async searchProducts(query: string): Promise<ScrapedPrice[]> {
    const url = `${config.baseUrl}/search?${new URLSearchParams({ q: query })}`;
    const links = await this.readPage(url, page => page.$$eval('main a[href*="/products/"]', elements =>
      [...new Set(elements.map(element => element.getAttribute('href')).filter((value): value is string => !!value))].slice(0, 12)));
    if (!links.length) throw new Error('No verifiable Alcampo search results');
    const quotes: ScrapedPrice[] = [];
    for (const link of links) {
      const identifier = new URL(link, config.baseUrl).pathname.match(/^\/products\/[^/]+\/(\d+)$/)?.[1];
      if (!identifier) throw new Error('Unconfirmed Alcampo search identity');
      quotes.push(await this.getProductPrice(`alcampo-${identifier}`, link));
    }
    return quotes;
  }

  async scrapeProducts(): Promise<ScrapedPrice[]> { throw new Error('Alcampo full-catalog capture is not supported'); }
  async scrapeProductDetails(): Promise<Product | null> { return null; }
}

export const alcampoScraper = new AlcampoScraper();