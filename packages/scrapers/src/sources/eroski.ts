import puppeteer from 'puppeteer';
import { BaseScraper, type ScraperConfig } from '../base.js';
import type { Product, ScrapedPrice } from '@bossing/shared';

const config: ScraperConfig = {
  name: 'Eroski', baseUrl: 'https://supermercado.eroski.es', rateLimit: 1, enabled: true,
};

interface StorefrontProduct {
  productId: string;
  name: string;
  price: string;
  currency: string;
  canonicalUrl: string;
  orderable: boolean;
}

function productUrl(value: string, identifier: string): URL {
  const url = new URL(value);
  if (!/^\d+$/.test(identifier) || url.protocol !== 'https:' || url.origin !== config.baseUrl ||
    url.username || url.password || url.search || url.hash ||
    !new RegExp(`^/(es|ca|en)/productdetail/${identifier}-[^/]+/$`).test(url.pathname)) {
    throw new Error('Unconfirmed Eroski product identity');
  }
  return url;
}

export function normalizeEroskiProduct(value: unknown, sourceUrl: string, scrapedAt = new Date()): ScrapedPrice {
  const product = value as Partial<StorefrontProduct> | null;
  if (!product || typeof product.productId !== 'string' || typeof product.name !== 'string' || !product.name.trim() ||
    typeof product.canonicalUrl !== 'string') throw new Error('Unconfirmed Eroski product identity');
  const source = productUrl(sourceUrl, product.productId);
  if (productUrl(product.canonicalUrl, product.productId).href !== source.href) throw new Error('Eroski canonical identity differs');
  if (product.currency !== 'EUR' || typeof product.price !== 'string' || !/^\d+(?:[.,]\d{1,2})?$/.test(product.price.trim()) ||
    !Number.isFinite(Number(product.price.trim().replace(',', '.'))) || Number(product.price.trim().replace(',', '.')) <= 0) {
    throw new Error('Invalid Eroski euro offer');
  }
  if (product.orderable !== true) throw new Error('Unconfirmed Eroski availability');
  const packaging = product.name.toLowerCase().trim().match(/(?:\b(\d+)\s*x\s*)?(\d+(?:[.,]\d+)?)\s*(kg|g|ml|cl|litros?|l|uds?|unidad(?:es)?)\.?$/);
  if (!packaging || /aprox|peso\s+variable|a\s+granel/i.test(product.name)) throw new Error('Unconfirmed Eroski packaging');
  const sourceUnit = packaging[3];
  const unit = /^(kg|g)$/.test(sourceUnit) ? 'kg' : /^(ml|cl|litro|l)/.test(sourceUnit) ? 'l' : 'ud';
  const divisor = sourceUnit === 'g' || sourceUnit === 'ml' ? 1000 : sourceUnit === 'cl' ? 100 : 1;
  const amount = Number(packaging[1] || 1) * Number(packaging[2].replace(',', '.')) / divisor;
  if (!Number.isFinite(amount) || amount <= 0 || (unit === 'ud' && !Number.isInteger(amount))) throw new Error('Invalid Eroski package amount');
  const price = Number(product.price.trim().replace(',', '.'));
  return { productId: `eroski-${product.productId}`, name: product.name.trim(), supermarket: 'Eroski', supermarketId: 'eroski',
    price, pricePerUnit: price / amount, unit, category: 'Alimentació', available: true, scrapedAt, packageSize: { amount, unit },
    source: { provider: 'eroski-storefront', warehouse: 'public-catalog', url: source.href } };
}

export class EroskiScraper extends BaseScraper {
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
      if (!response || response.status() >= 400) throw Object.assign(new Error(`Eroski HTTP ${response?.status() || 'unavailable'}`), {
        response: { status: response?.status(), headers: { 'retry-after': response?.headers()['retry-after'] } },
      });
      if (new URL(page.url()).origin !== config.baseUrl) throw new Error('Eroski redirected away from its storefront');
      return await extract(page);
    } finally { await browser.close(); }
  }

  async getProductPrice(productId: string, sourceUrl: string): Promise<ScrapedPrice> {
    if (!/^eroski-\d+$/.test(productId)) throw new Error('Invalid Eroski product identifier');
    const url = productUrl(sourceUrl, productId.slice(7)).href;
    const product = await this.readPage(url, page => page.evaluate(() => {
      const names = document.querySelectorAll('h1[itemprop="description"]');
      const prices = document.querySelectorAll('[itemprop="offerDetails"] [itemprop="price"]');
      const currency = document.querySelector('[itemprop="offerDetails"] [itemprop="priceCurrency"]')?.getAttribute('content');
      const canonicalUrl = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;
      if (names.length !== 1 || prices.length !== 1 || !canonicalUrl) throw new Error('Missing or ambiguous Eroski product data');
      const identifier = new URL(canonicalUrl).pathname.match(/\/productdetail\/(\d+)-/)?.[1];
      const orderable = [...document.querySelectorAll<HTMLAnchorElement>('a.toAddProduct')].some(element => {
        const form = element.closest('form');
        const identity = form?.querySelector<HTMLInputElement>('input[name="t:ac"]')?.value;
        const box = element.getBoundingClientRect();
        return identity?.startsWith(`${identifier}-`) && box.width > 0 && box.height > 0 &&
          element.getAttribute('aria-disabled') !== 'true' && !element.classList.contains('disabled');
      });
      return { productId: identifier, name: names[0].textContent?.trim(), price: prices[0].textContent?.trim(), currency, canonicalUrl, orderable };
    }));
    return normalizeEroskiProduct(product, url);
  }

  async searchProducts(query: string): Promise<ScrapedPrice[]> {
    const url = `${config.baseUrl}/es/search/results/?${new URLSearchParams({ q: query })}`;
    const links = await this.readPage(url, page => page.$$eval('a.product-title-link[href]', elements =>
      [...new Set(elements.map(element => element.getAttribute('href')).filter((value): value is string => !!value))].slice(0, 12)));
    if (!links.length) throw new Error('No verifiable Eroski search results');
    const quotes: ScrapedPrice[] = [];
    for (const link of links) {
      const identifier = new URL(link, config.baseUrl).pathname.match(/\/productdetail\/(\d+)-/)?.[1];
      if (!identifier) throw new Error('Unconfirmed Eroski search identity');
      quotes.push(await this.getProductPrice(`eroski-${identifier}`, link));
    }
    return quotes;
  }

  async scrapeProducts(_category?: string): Promise<ScrapedPrice[]> { throw new Error('Eroski full-catalog capture is not supported'); }
  async scrapeProductDetails(): Promise<Product | null> { return null; }
}

export const eroskiScraper = new EroskiScraper();