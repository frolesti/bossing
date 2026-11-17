import puppeteer from 'puppeteer';
import { BaseScraper, type ScraperConfig } from '../base.js';
import type { ScrapedPrice, Product } from '@bossing/shared';

const config: ScraperConfig = {
  name: 'Plusfresc',
  baseUrl: 'https://compra.plusfresc.cat',
  rateLimit: 1,
  enabled: true,
};

const API_BASE = 'https://wscompra.plusfresc.cat/api';

interface PlusfrescText {
  lang: string;
  order: number;
  text: string;
  type: number; // 4 = product name, 6 = promo text
}

interface PlusfrescProduct {
  id: string;
  item_id: string;
  brand_name: string;
  image_url: string;
  value_cents: number;       // original price in cents
  new_value_cents: number;   // current/offer price in cents
  unit_measure: string;      // 'Kg', 'L', 'Ud'
  value_x_unit: number;      // price per unit in cents
  available: boolean;
  category_id: string;
  texts: PlusfrescText[];
  has_format: boolean;
  formats?: { options: { option_id: string; percentage_mili: number }[] }[];
  promo_id?: string;
  qty_required?: number;
  end_date?: string;
}

export function normalizePlusfrescProduct(value: unknown, sourceUrl: string, scrapedAt = new Date()): ScrapedPrice {
  const url = new URL(sourceUrl);
  if (url.origin !== 'https://wscompra.plusfresc.cat' || url.username || url.password || url.search || url.hash ||
    !/^\/api\/search\/languages\/ca\/[^/]+\/products\/12$/.test(url.pathname)) throw new Error('Unconfirmed Plusfresc source context');
  const product = value as Partial<PlusfrescProduct> | null;
  if (!product || !/^\d+$/.test(product.item_id || '') || !Array.isArray(product.texts) || typeof product.available !== 'boolean') {
    throw new Error('Unconfirmed Plusfresc identity or availability');
  }
  const names = product.texts.filter(text => text.type === 4 && text.lang === 'ca' && typeof text.text === 'string');
  if (names.length !== 1 || /aprox|granel|pes\s+variable/i.test(names[0].text)) throw new Error('Unconfirmed Plusfresc fixed product');
  const name = names[0].text.trim();
  const size = name.match(/(?:^|[,\s])(?:(\d+)\s*x\s*)?(\d+(?:[.,]\d+)?)\s*(kg|g|ml|cl|l|u|ut|unitats?)\.?$/i);
  if (!size) throw new Error('Unconfirmed Plusfresc package');
  const sourceUnit = size[3].toLowerCase();
  const unit = /^(kg|g)$/.test(sourceUnit) ? 'kg' : /^(ml|cl|l)$/.test(sourceUnit) ? 'l' : 'ud';
  if (product.unit_measure?.toLowerCase() !== (unit === 'ud' ? 'ud' : unit)) throw new Error('Conflicting Plusfresc package unit');
  if (product.has_format !== false && !(product.has_format === true && product.formats?.some(format =>
    format.options?.some(option => option.option_id === 'Unitat' && option.percentage_mili === 1000)))) {
    throw new Error('Unconfirmed Plusfresc single-package purchase');
  }
  const divisor = /^(g|ml)$/.test(sourceUnit) ? 1000 : sourceUnit === 'cl' ? 100 : 1;
  const amount = Number(size[1] || 1) * Number(size[2].replace(',', '.')) / divisor;
  if (!Number.isFinite(amount) || amount <= 0 || (unit === 'ud' && !Number.isInteger(amount)) ||
    !Number.isInteger(product.value_cents) || product.value_cents! <= 0) throw new Error('Invalid Plusfresc package or regular price');
  const reduced = product.texts.some(text => text.type === 6 && text.lang === 'ca' && /^Oferta a preu redu[i\u00ef]t!$/.test(text.text));
  const date = product.end_date?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(scrapedAt);
  const activeOffer = date && `${date[3]}-${date[2]}-${date[1]}` >= today;
  const cents = reduced && activeOffer && !product.promo_id && (product.qty_required === undefined || product.qty_required === 1) &&
    Number.isInteger(product.new_value_cents) && product.new_value_cents! > 0 && product.new_value_cents! <= product.value_cents!
    ? product.new_value_cents! : product.value_cents!;
  const price = cents / 100;
  return { productId: `plusfresc-${product.item_id}`, name, supermarket: 'Plusfresc', supermarketId: 'plusfresc',
    category: product.category_id || 'Alimentacio', price, pricePerUnit: price / amount, unit,
    packageSize: { amount, unit }, available: product.available, scrapedAt,
    source: { provider: 'plusfresc-rest', warehouse: 'centre:12;postal:25001', url: url.href } };
}

export class PlusfrescScraper extends BaseScraper {
  private nextRequestAt = 0;
  constructor() {
    super(config);
  }

  async searchProducts(query: string): Promise<ScrapedPrice[]> {
    if (!query.trim() || query.length > 40) throw new Error('Invalid Plusfresc search');
    const url = `${API_BASE}/search/languages/ca/${encodeURIComponent(query)}/products/12`;
    const now = Date.now();
    const scheduledAt = Math.max(now, this.nextRequestAt);
    this.nextRequestAt = scheduledAt + 1000;
    if (scheduledAt > now) await new Promise(resolve => setTimeout(resolve, scheduledAt - now));
    const browser = await puppeteer.launch({ headless: 'new' });
    try {
      const page = await browser.newPage();
      const pending = page.waitForResponse(response => response.url() === url && response.request().method() === 'GET', { timeout: 30_000 });
      pending.catch(() => {});
      const navigation = await page.goto(`${config.baseUrl}/search?${new URLSearchParams({ q: query })}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      if (!navigation || navigation.status() >= 400) throw new Error(`Plusfresc HTTP ${navigation?.status() || 'unavailable'}`);
      const response = await pending;
      await page.waitForFunction(() => /^25001$/m.test(document.body.innerText), { timeout: 10_000 });
      if (response.status() !== 200) throw Object.assign(new Error(`Plusfresc HTTP ${response.status()}`), {
        response: { status: response.status(), headers: { 'retry-after': response.headers()['retry-after'] } },
      });
      const values: unknown = await response.json();
      if (!Array.isArray(values)) throw new Error('Unconfirmed Plusfresc search response');
      const products: ScrapedPrice[] = [];
      for (const value of values) {
        try { products.push(normalizePlusfrescProduct(value, url)); }
        catch (error) { console.warn('[Plusfresc] Rejected product:', error instanceof Error ? error.message : error); }
      }
      if (values.length && !products.length) throw new Error('No verifiable Plusfresc search packages');
      return [...new Map(products.map(product => [product.productId, product])).values()];
    } finally { await browser.close(); }
  }

  async scrapeProducts(category?: string): Promise<ScrapedPrice[]> {
    if (category) return this.searchProducts(category);
    throw new Error('Plusfresc full-catalog capture is not validated; use product search');
  }

  async scrapeProductDetails(): Promise<Product | null> {
    return null;
  }
}

export const plusfrescScraper = new PlusfrescScraper();
