import puppeteer from 'puppeteer';
import { BaseScraper } from '../base.js';
import type { Product, ScrapedPrice } from '@bossing/shared';

const config = { name: 'Aldi', baseUrl: 'https://www.aldi.es', rateLimit: 1, enabled: true };

function productUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.origin !== config.baseUrl || url.username || url.password || url.search || url.hash ||
    !/^\/producto\/[^/]+-\d+\.html$/.test(url.pathname)) throw new Error('Unconfirmed Aldi product URL');
  return url;
}

export function normalizeAldiProduct(value: unknown, sourceUrl: string, packaging: string, scrapedAt = new Date()): ScrapedPrice {
  const product = value as { '@type'?: string; sku?: string; name?: string; offers?: { '@type'?: string; url?: string;
    price?: number | string; priceCurrency?: string; availability?: string; validFrom?: string; validThrough?: string; priceValidUntil?: string } } | null;
  const source = productUrl(sourceUrl);
  const identifier = source.pathname.match(/-(\d+)\.html$/)![1];
  if (!product || product['@type'] !== 'Product' || product.sku !== identifier || typeof product.name !== 'string' || !product.name.trim()) {
    throw new Error('Unconfirmed Aldi product identity');
  }
  const offer = product.offers;
  if (!offer || offer['@type'] !== 'Offer' || offer.url !== source.href.replace(/-(\d+)\.html$/, '-$1-$1') ||
    offer.priceCurrency !== 'EUR' || !['number', 'string'].includes(typeof offer.price) || !/^\d+(?:\.\d{1,2})?$/.test(String(offer.price)) ||
    !Number.isFinite(Number(offer.price)) || Number(offer.price) <= 0 || offer.validFrom || offer.validThrough || offer.priceValidUntil) {
    throw new Error('Unconfirmed Aldi regular euro offer');
  }
  if (!/^https:\/\/schema\.org\/(InStock|OutOfStock)$/.test(offer.availability || '')) throw new Error('Unconfirmed Aldi availability');
  const label = packaging.toLowerCase().trim();
  const size = label.match(/^(?:(\d+)\s*x\s*)?(\d+(?:[.,]\d+)?)\s*(kg|g|ml|cl|l|uds?|unidad(?:es)?)\s+unidad$/) ||
    label.match(/^pack de (\d+)\s*x\s*(\d+(?:[.,]\d+)?)\s*(g|ml)$/);
  if (!size || /aprox|granel|peso\s+variable/i.test(product.name + ' ' + packaging)) throw new Error('Unconfirmed Aldi fixed packaging');
  const sourceUnit = size[3];
  const unit = /^(kg|g)$/.test(sourceUnit) ? 'kg' : /^(ml|cl|l)$/.test(sourceUnit) ? 'l' : 'ud';
  const divisor = sourceUnit === 'g' || sourceUnit === 'ml' ? 1000 : sourceUnit === 'cl' ? 100 : 1;
  const amount = Number(size[1] || 1) * Number(size[2].replace(',', '.')) / divisor;
  if (!Number.isFinite(amount) || amount <= 0 || (unit === 'ud' && !Number.isInteger(amount))) throw new Error('Invalid Aldi package amount');
  const price = Number(offer.price);
  return { productId: `aldi-${identifier}`, name: product.name.trim(), supermarket: 'Aldi', supermarketId: 'aldi', category: 'Alimentacio',
    price, pricePerUnit: price / amount, unit, packageSize: { amount, unit }, available: offer.availability?.endsWith('/InStock') === true,
    scrapedAt, source: { provider: 'aldi-storefront', warehouse: 'public-catalog', url: source.href } };
}

export class AldiScraper extends BaseScraper {
  private nextRequestAt = 0;
  constructor() { super(config); }

  async getProductPrice(productId: string, sourceUrl: string): Promise<ScrapedPrice> {
    const url = productUrl(sourceUrl);
    if (productId !== `aldi-${url.pathname.match(/-(\d+)\.html$/)![1]}`) throw new Error('Aldi requested identity differs');
    const now = Date.now();
    const scheduledAt = Math.max(now, this.nextRequestAt);
    this.nextRequestAt = scheduledAt + 1000;
    if (scheduledAt > now) await new Promise(resolve => setTimeout(resolve, scheduledAt - now));
    const browser = await puppeteer.launch({ headless: 'new' });
    try {
      const page = await browser.newPage();
      const response = await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      if (!response || response.status() >= 400) throw Object.assign(new Error(`Aldi HTTP ${response?.status() || 'unavailable'}`), {
        response: { status: response?.status(), headers: { 'retry-after': response?.headers()['retry-after'] } },
      });
      await page.waitForSelector('[data-testid="product-card-detail-tag-sales-unit"]', { timeout: 20_000 });
      const data = await page.evaluate(() => {
        const products = [...document.querySelectorAll('script[type="application/ld+json"]')]
          .map(element => JSON.parse(element.textContent || 'null')).filter(value => value?.['@type'] === 'Product');
        const packaging = document.querySelectorAll('[data-testid="product-card-detail-tag-sales-unit"]');
        if (products.length !== 1 || packaging.length !== 1) throw new Error('Missing or ambiguous Aldi product data');
        return { product: products[0], packaging: packaging[0].textContent?.trim() || '',
          canonicalUrl: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href };
      });
      if (page.url() !== url.href || data.canonicalUrl !== url.href) throw new Error('Aldi canonical identity differs');
      return normalizeAldiProduct(data.product, url.href, data.packaging);
    } finally { await browser.close(); }
  }

  async searchProducts(_query: string): Promise<ScrapedPrice[]> { throw new Error('Aldi search capture is not validated; use exact product URLs'); }
  async scrapeProducts(_category?: string): Promise<ScrapedPrice[]> { throw new Error('Aldi full-catalog capture is not supported'); }
  async scrapeProductDetails(): Promise<Product | null> { return null; }
}

export const aldiScraper = new AldiScraper();