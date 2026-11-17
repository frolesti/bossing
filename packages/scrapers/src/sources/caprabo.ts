import { BaseScraper, type ScraperConfig } from '../base.js';
import type { Product, ScrapedPrice } from '@bossing/shared';
import puppeteer from 'puppeteer';

const config: ScraperConfig = {
  name: 'Caprabo', baseUrl: 'https://www.capraboacasa.com', rateLimit: 1, enabled: true,
};

interface StorefrontProduct {
  '@type': string;
  identifier: string;
  description: string;
  image?: string;
  url: string;
  offers: { price: string; priceCurrency: string; availability: string; url: string };
}

function productUrl(value: string, identifier: string): URL {
  const url = new URL(value, config.baseUrl);
  if (url.protocol !== 'https:' || url.hostname !== 'www.capraboacasa.com' || url.username || url.password ||
    !/^\d+$/.test(identifier) || !url.pathname.startsWith(`/ca/productdetail/${identifier}-`)) {
    throw new Error('Unconfirmed Caprabo product URL');
  }
  return url;
}

export function normalizeCapraboProduct(value: unknown, sourceUrl: string, scrapedAt = new Date()): ScrapedPrice {
  const product = value as Partial<StorefrontProduct> | null;
  if (!product || product['@type'] !== 'Product' || typeof product.identifier !== 'string' ||
    typeof product.description !== 'string' || !product.description.trim() || typeof product.url !== 'string' || !product.offers) {
    throw new Error('Invalid Caprabo structured product');
  }
  const canonical = productUrl(product.url, product.identifier);
  const source = productUrl(sourceUrl, product.identifier);
  const offer = product.offers;
  if (canonical.href !== source.href || typeof offer.url !== 'string' || productUrl(offer.url, product.identifier).href !== source.href) {
    throw new Error('Caprabo product and offer identity differ');
  }
  if (offer.priceCurrency !== 'EUR' || typeof offer.price !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(offer.price) || Number(offer.price) <= 0) {
    throw new Error('Invalid Caprabo euro price');
  }
  if (!/^https?:\/\/schema\.org\/(InStock|OutOfStock)$/.test(offer.availability)) {
    throw new Error('Unconfirmed Caprabo availability');
  }
  const packaging = product.description.toLowerCase().trim().match(/(?:\b(\d+)\s*[x×]\s*)?(\d+(?:[.,]\d+)?)\s*(kg|quilograms?|g|grams?|ml|cl|litres?|l|unitats?|u|dotzena|dotzenes)\.?$/);
  if (!packaging || /aprox|pes variable|a granel/.test(product.description.toLowerCase())) throw new Error('Unconfirmed Caprabo packaging');
  const sourceUnit = packaging[3];
  const unit = /^(kg|quilogram|g|gram)/.test(sourceUnit) ? 'kg' : /^(ml|cl|litre|l)$|^litres$/.test(sourceUnit) ? 'l' : 'ud';
  const scale = sourceUnit.startsWith('dotzen') ? 12 : /^(g|gram)/.test(sourceUnit) ? 0.001 : sourceUnit === 'ml' ? 0.001 : sourceUnit === 'cl' ? 0.01 : 1;
  const amount = Number(packaging[1] || 1) * Number(packaging[2].replace(',', '.')) * scale;
  if (!Number.isFinite(amount) || amount <= 0 || (unit === 'ud' && !Number.isInteger(amount))) throw new Error('Invalid Caprabo package amount');
  const price = Number(offer.price);
  return { productId: `caprabo-${product.identifier}`, name: product.description.trim(), supermarket: 'Caprabo', supermarketId: 'caprabo',
    price, pricePerUnit: price / amount, unit, category: 'Alimentació', imageUrl: product.image,
    available: offer.availability.endsWith('/InStock'), scrapedAt, packageSize: { amount, unit },
    source: { provider: 'caprabo-storefront', warehouse: 'public-catalog', url: source.href } };
}

export class CapraboScraper extends BaseScraper {
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
      const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 30_000 });
      if (!response || response.status() >= 400) throw Object.assign(new Error(`Caprabo HTTP ${response?.status() || 'unavailable'}`), {
        response: { status: response?.status(), headers: { 'retry-after': response?.headers()['retry-after'] } },
      });
      if (new URL(page.url()).hostname !== 'www.capraboacasa.com') throw new Error('Caprabo redirected away from its storefront');
      return await extract(page);
    } finally { await browser.close(); }
  }

  async getProductPrice(productId: string, sourceUrl: string): Promise<ScrapedPrice> {
    if (!/^caprabo-\d+$/.test(productId)) throw new Error('Invalid Caprabo product identifier');
    const url = productUrl(sourceUrl, productId.slice(8)).href;
    const documents = await this.readPage(url, page => page.$$eval('script[type="application/ld+json"]', elements =>
      elements.map(element => JSON.parse(element.textContent || 'null'))));
    const products = documents.filter(value => value?.['@type'] === 'Product');
    if (products.length !== 1) throw new Error('Missing or ambiguous Caprabo product data');
    const quote = normalizeCapraboProduct(products[0], url);
    if (quote.productId !== productId) throw new Error('Caprabo returned a different product');
    return quote;
  }

  async searchProducts(query: string): Promise<ScrapedPrice[]> {
    const url = `${this.config.baseUrl}/ca/search/results/?${new URLSearchParams({ q: query })}`;
    const links = await this.readPage(url, page => page.$$eval('.product-title-link', elements =>
      [...new Set(elements.map(element => element.getAttribute('href')).filter((value): value is string => !!value))].slice(0, 12)));
    if (!links.length) throw new Error('No verifiable Caprabo search results');
    const quotes: ScrapedPrice[] = [];
    for (const link of links) {
      const id = new URL(link, this.config.baseUrl).pathname.match(/^\/ca\/productdetail\/(\d+)-/);
      if (!id) throw new Error('Invalid Caprabo search identity');
      quotes.push(await this.getProductPrice(`caprabo-${id[1]}`, link));
    }
    return quotes;
  }

  async scrapeProducts(): Promise<ScrapedPrice[]> { throw new Error('Caprabo full-catalog capture is not supported'); }
  async scrapeProductDetails(): Promise<Product | null> { return null; }
}

export const capraboScraper = new CapraboScraper();
export default CapraboScraper;
