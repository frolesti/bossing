import puppeteer, { type HTTPResponse } from 'puppeteer';
import { BaseScraper, type ScraperConfig } from '../base.js';
import type { ScrapedPrice } from '@bossing/shared';

const config: ScraperConfig = {
  name: 'Bonpreu',
  baseUrl: 'https://www.compraonline.bonpreuesclat.cat',
  rateLimit: 1,
  enabled: true,
};

function productUrl(value: string, identifier: string): URL {
  const url = new URL(value, config.baseUrl);
  if (!/^\d+$/.test(identifier) || url.protocol !== 'https:' || url.hostname !== 'www.compraonline.bonpreuesclat.cat' ||
    url.port || url.username || url.password || url.search || url.hash ||
    !new RegExp(`^/products/[^/]+/${identifier}$`).test(url.pathname)) throw new Error('Unconfirmed Bonpreu product identity');
  return url;
}

export function normalizeBonpreuProduct(value: unknown, sourceUrl: string, scrapedAt = new Date()): ScrapedPrice {
  const product = value as { '@type'?: string; sku?: string; name?: string; description?: string; size?: string; image?: string[];
    offers?: { '@type'?: string; price?: string; priceCurrency?: string; availability?: string } } | null;
  if (!product || product['@type'] !== 'Product' || typeof product.sku !== 'string' || !/^\d+$/.test(product.sku) ||
    typeof product.name !== 'string' || !product.name.trim()) throw new Error('Unconfirmed Bonpreu product identity');
  const source = productUrl(sourceUrl, product.sku);
  const offer = product.offers;
  if (!offer || offer['@type'] !== 'Offer' || offer.priceCurrency !== 'EUR' || typeof offer.price !== 'string' ||
    !/^\d+(?:\.\d{1,2})?$/.test(offer.price) || !Number.isFinite(Number(offer.price)) || Number(offer.price) <= 0) {
    throw new Error('Invalid Bonpreu euro price');
  }
  if (typeof offer.availability !== 'string' || !/^https:\/\/schema\.org\/(InStock|OutOfStock)$/.test(offer.availability)) {
    throw new Error('Unconfirmed Bonpreu availability');
  }
  const packaging = typeof product.size === 'string'
    ? product.size.trim().toLowerCase().match(/^(?:(\d+)\s*[x×]\s*)?(\d+(?:[.,]\d+)?)\s*(kg|g|ml|cl|l|u|ud|unitats?|per paquet|dotzena|dotzenes)$/) : null;
  if (!packaging || /aprox|pes\s+variable|a\s+granel/i.test(`${product.name} ${product.description || ''}`)) {
    throw new Error('Unconfirmed Bonpreu packaging');
  }
  const sourceUnit = packaging[3];
  const unit = /^(kg|g)$/.test(sourceUnit) ? 'kg' : /^(ml|cl|l)$/.test(sourceUnit) ? 'l' : 'ud';
  const scale = sourceUnit === 'g' || sourceUnit === 'ml' ? 0.001 : sourceUnit === 'cl' ? 0.01 : sourceUnit.startsWith('dotzen') ? 12 : 1;
  const amount = Number(packaging[1] || 1) * Number(packaging[2].replace(',', '.')) * scale;
  if (!Number.isFinite(amount) || amount <= 0 || (unit === 'ud' && !Number.isInteger(amount))) throw new Error('Invalid Bonpreu package amount');
  const price = Number(offer.price);
  return { productId: `bonpreu-${product.sku}`, name: product.name.trim(), supermarket: 'Bonpreu', supermarketId: 'bonpreu',
    price, pricePerUnit: price / amount, unit, category: 'Alimentació', imageUrl: Array.isArray(product.image) ? product.image[0] : undefined,
    available: offer.availability.endsWith('/InStock'), scrapedAt, packageSize: { amount, unit },
    source: { provider: 'bonpreu-storefront', warehouse: 'public-catalog', url: source.href } };
}

export class BonpreuScraper extends BaseScraper {
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
      this.checkResponse(await page.goto(url, { waitUntil: 'networkidle2', timeout: 30_000 }));
      if (new URL(page.url()).origin !== config.baseUrl) throw new Error('Bonpreu redirected away from its storefront');
      return await extract(page);
    } finally { await browser.close(); }
  }

  async getProductPrice(productId: string, sourceUrl: string): Promise<ScrapedPrice> {
    if (!/^bonpreu-\d+$/.test(productId)) throw new Error('Invalid Bonpreu product identifier');
    const url = productUrl(sourceUrl, productId.slice(8)).href;
    const documents = await this.readPage(url, page => page.$$eval('script[type="application/ld+json"]', elements =>
      elements.map(element => JSON.parse(element.textContent || 'null'))));
    const products = documents.filter(value => value?.['@type'] === 'Product');
    if (products.length !== 1) throw new Error('Missing or ambiguous Bonpreu product data');
    return normalizeBonpreuProduct(products[0], url);
  }

  async searchProducts(query: string): Promise<ScrapedPrice[]> {
    const url = `${config.baseUrl}/search?${new URLSearchParams({ q: query })}`;
    const links = await this.readPage(url, page => page.$$eval('main a[href*="/products/"]', elements =>
      [...new Set(elements.map(element => element.getAttribute('href')).filter((value): value is string => !!value))].slice(0, 12)));
    if (!links.length) throw new Error('No verifiable Bonpreu search results');
    const quotes: ScrapedPrice[] = [];
    for (const link of links) {
      const identifier = new URL(link, config.baseUrl).pathname.match(/^\/products\/[^/]+\/(\d+)$/)?.[1];
      if (!identifier) throw new Error('Invalid Bonpreu search identity');
      quotes.push(await this.getProductPrice(`bonpreu-${identifier}`, link));
    }
    return quotes;
  }

  private checkResponse(response: HTTPResponse | null): void {
    if (!response || response.status() >= 400) throw Object.assign(new Error(`Bonpreu HTTP ${response?.status() || 'unavailable'}`), {
      response: { status: response?.status(), headers: { 'retry-after': response?.headers()['retry-after'] } },
    });
  }

  async getCategories() { return []; }
  async getCategoryProducts() { return []; }
  async scrapeProducts(): Promise<ScrapedPrice[]> { throw new Error('Bonpreu full-catalog capture is not supported'); }
  async scrapeProductDetails() { return null; }
}

export const bonpreuScraper = new BonpreuScraper();
