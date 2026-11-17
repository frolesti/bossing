import puppeteer from 'puppeteer';
import { BaseScraper } from '../base.js';
import type { Product, ScrapedPrice } from '@bossing/shared';

const config = { name: 'Carrefour', baseUrl: 'https://www.carrefour.es', rateLimit: 1, enabled: true };

function productUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.origin !== config.baseUrl || url.username || url.password || url.search || url.hash ||
    !/^\/supermercado\/[^/]+\/R-(?:VC4AECOMM-)?\d+\/p$/.test(url.pathname)) throw new Error('Unconfirmed Carrefour product URL');
  return url;
}

export function normalizeCarrefourProduct(value: unknown, sourceUrl: string, minimumPurchaseQuantity: number, scrapedAt = new Date()): ScrapedPrice {
  const product = value as { '@type'?: string; sku?: string; name?: string; offers?: { '@type'?: string; url?: string;
    price?: number | string; priceCurrency?: string; availability?: string } } | null;
  const source = productUrl(sourceUrl);
  if (!product || product['@type'] !== 'Product' || typeof product.sku !== 'string' || !/^\d+$/.test(product.sku) ||
    typeof product.name !== 'string' || !product.name.trim()) throw new Error('Unconfirmed Carrefour product identity');
  const offer = product.offers;
  if (!offer || offer['@type'] !== 'Offer' || offer.url !== source.href || offer.priceCurrency !== 'EUR' ||
    !['number', 'string'].includes(typeof offer.price) || !/^\d+(?:\.\d{1,2})?$/.test(String(offer.price)) ||
    !Number.isFinite(Number(offer.price)) || Number(offer.price) <= 0) throw new Error('Invalid Carrefour euro offer');
  if (!/^https:\/\/schema\.org\/(InStock|OutOfStock)$/.test(offer.availability || '')) throw new Error('Unconfirmed Carrefour availability');
  if (!Number.isSafeInteger(minimumPurchaseQuantity) || minimumPurchaseQuantity < 1 || minimumPurchaseQuantity > 100) {
    throw new Error('Unconfirmed Carrefour minimum purchase');
  }
  const size = product.name.toLowerCase().trim().match(/(?:\b(\d+)\s*x\s*)?(\d+(?:[.,]\d+)?)\s*(kg|g|ml|cl|l|uds?|unidad(?:es)?)\.?$/);
  if (!size || /aprox|granel|peso\s+variable/i.test(product.name)) throw new Error('Unconfirmed Carrefour fixed packaging');
  const sourceUnit = size[3];
  const unit = /^(kg|g)$/.test(sourceUnit) ? 'kg' : /^(ml|cl|l)$/.test(sourceUnit) ? 'l' : 'ud';
  const amount = minimumPurchaseQuantity * Number(size[1] || 1) * Number(size[2].replace(',', '.')) *
    (sourceUnit === 'g' || sourceUnit === 'ml' ? 0.001 : sourceUnit === 'cl' ? 0.01 : 1);
  if (!Number.isFinite(amount) || amount <= 0 || (unit === 'ud' && !Number.isInteger(amount))) throw new Error('Invalid Carrefour package amount');
  const price = Math.round(Number(offer.price) * minimumPurchaseQuantity * 100) / 100;
  return { productId: `carrefour-${source.pathname.match(/\/R-((?:VC4AECOMM-)?\d+)\/p$/)![1]}`,
    name: minimumPurchaseQuantity === 1 ? product.name.trim() : `Pack obligatori de ${minimumPurchaseQuantity} x ${product.name.trim()}`,
    supermarket: 'Carrefour', supermarketId: 'carrefour', category: 'Alimentacio', price, pricePerUnit: price / amount,
    unit, packageSize: { amount, unit }, available: offer.availability?.endsWith('/InStock') === true, scrapedAt,
    source: { provider: 'carrefour-storefront', warehouse: 'public-catalog', url: source.href } };
}

export class CarrefourScraper extends BaseScraper {
  private nextRequestAt = 0;
  constructor() { super(config); }

  async getProductPrice(productId: string, sourceUrl: string): Promise<ScrapedPrice> {
    const url = productUrl(sourceUrl);
    if (productId !== `carrefour-${url.pathname.match(/\/R-((?:VC4AECOMM-)?\d+)\/p$/)![1]}`) throw new Error('Carrefour requested identity differs');
    const now = Date.now();
    const scheduledAt = Math.max(now, this.nextRequestAt);
    this.nextRequestAt = scheduledAt + 1000;
    if (scheduledAt > now) await new Promise(resolve => setTimeout(resolve, scheduledAt - now));
    const browser = await puppeteer.launch({ headless: 'new' });
    try {
      const page = await browser.newPage();
      const response = await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      if (!response || response.status() >= 400) throw Object.assign(new Error(`Carrefour HTTP ${response?.status() || 'unavailable'}`), {
        response: { status: response?.status(), headers: { 'retry-after': response?.headers()['retry-after'] } },
      });
      const data = await page.evaluate(() => {
        const products = [...document.querySelectorAll('script[type="application/ld+json"]')]
          .map(element => JSON.parse(element.textContent || 'null')).filter(value => value?.['@type'] === 'Product');
        if (products.length !== 1) throw new Error('Missing or ambiguous Carrefour product data');
        const badge = document.querySelector('.buybox__pack-badge');
        const text = document.querySelector('.buybox__pack-info-description')?.textContent?.trim();
        const quantities = text?.match(/de\s+(\d+)\s+en\s+(\d+)\s+unidades/i);
        if ((badge || text) && (!quantities || quantities[1] !== quantities[2])) throw new Error('Unconfirmed Carrefour mandatory pack');
        return { product: products[0], minimumPurchaseQuantity: quantities ? Number(quantities[1]) : 1,
          canonicalUrl: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href };
      });
      if (page.url() !== url.href || data.canonicalUrl !== url.href) throw new Error('Carrefour canonical identity differs');
      return normalizeCarrefourProduct(data.product, url.href, data.minimumPurchaseQuantity);
    } finally { await browser.close(); }
  }

  async searchProducts(_query: string): Promise<ScrapedPrice[]> { throw new Error('Carrefour search capture is not validated; use exact product URLs'); }
  async scrapeProducts(_category?: string): Promise<ScrapedPrice[]> { throw new Error('Carrefour full-catalog capture is not supported'); }
  async scrapeProductDetails(): Promise<Product | null> { return null; }
}

export const carrefourScraper = new CarrefourScraper();