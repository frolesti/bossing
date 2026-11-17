import puppeteer from 'puppeteer';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { BaseScraper } from '../base.js';
import type { ScrapedPrice, Product } from '@bossing/shared';

const config = { name: 'Condis', baseUrl: 'https://compraonline.condis.es', rateLimit: 1, enabled: true };

function productUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.origin !== config.baseUrl || url.username || url.password || url.search || url.hash ||
    !/^\/[^/]+\/p\/\d+\/es_ES$/.test(url.pathname)) throw new Error('Unconfirmed Condis product URL');
  return url;
}

export function normalizeCondisProduct(html: string, sourceUrl: string, scrapedAt = new Date()): ScrapedPrice {
  const url = productUrl(sourceUrl);
  const identifier = url.pathname.match(/\/p\/(\d+)\/es_ES$/)![1];
  const $ = cheerio.load(html);
  if ($('link[rel="canonical"]').length !== 1 || $('link[rel="canonical"]').attr('href') !== url.href) {
    throw new Error('Unconfirmed Condis canonical identity');
  }
  const titles = $('h1.pdp-title-margin');
  if (!titles.length || titles.length > 2) throw new Error('Missing or ambiguous Condis detail');
  const details = titles.map((_index, title) => {
    const scope = $(title).parent().parent();
    const name = $(title).text().trim();
    const net = scope.find('span').filter((_index, element) => /^Cantidad neta:/.test($(element).text().trim()));
    const prices = scope.children('div.text-charcoalBlack');
    const buttons = scope.find('button').filter((_index, element) => $(element).text().trim() === 'A\u00f1adir al carrito');
    const size = net.text().trim().match(/^Cantidad neta:\s*(\d+(?:[.,]\d+)?)\s*(litros?|mililitros?|kilos?|kilogramos?|gramos?|unidades?)$/i);
    const priceText = prices.text().trim().match(/^(\d+(?:[.,]\d{2})?)\s*\u20ac$/);
    if (!name || /aprox|granel|peso\s+variable/i.test(name) || net.length !== 1 || !size || prices.length !== 1 || !priceText ||
      buttons.length !== 1 || buttons.is('[disabled]') || buttons.attr('aria-busy') !== 'false' || buttons.attr('aria-disabled') === 'true') {
      throw new Error('Unconfirmed Condis fixed euro offer or availability');
    }
    const sourceUnit = size[2].toLowerCase();
    const eggCount = name.match(/^HUEVOS\b.*\b(\d+)\s+UNIDADES$/i);
    const unit = eggCount || sourceUnit.startsWith('unidad') ? 'ud' : /litro/.test(sourceUnit) ? 'l' : 'kg';
    const netAmount = Number(size[1].replace(',', '.')) / (/^(gramo|mililitro)/.test(sourceUnit) ? 1000 : 1);
    const amount = eggCount ? Number(eggCount[1]) : netAmount;
    const price = Number(priceText[1].replace(',', '.'));
    if (!Number.isFinite(netAmount) || netAmount <= 0 || !Number.isFinite(amount) || amount <= 0 || price <= 0 || (unit === 'ud' && !Number.isInteger(amount))) {
      throw new Error('Invalid Condis package or price');
    }
    return { name, price, amount, unit };
  }).get();
  if (details.some(detail => JSON.stringify(detail) !== JSON.stringify(details[0]))) throw new Error('Conflicting Condis responsive details');
  const { name, price, amount, unit } = details[0];
  return { productId: `condis-${identifier}`, name, supermarket: 'Condis', supermarketId: 'condis', category: 'Alimentacio',
    price, pricePerUnit: price / amount, unit, packageSize: { amount, unit }, available: true, scrapedAt,
    source: { provider: 'condis-storefront', warehouse: 'public-catalog', url: url.href } };
}

export function normalizeCondisSearch(value: unknown, sourceUrl: string, acceptsName: (name: string) => boolean = () => true) {
  const url = new URL(sourceUrl);
  const catalog = (value as { catalog?: { content?: unknown[]; numFound?: number } } | null)?.catalog;
  if (url.origin !== 'https://api.empathy.co' || url.pathname !== '/search/v1/query/condis/search' ||
    url.searchParams.get('lang') !== 'es' || url.searchParams.get('store') !== '718' || !url.searchParams.get('query') ||
    !catalog || !Array.isArray(catalog.content) || !Number.isInteger(catalog.numFound) || catalog.numFound! < 0) {
    throw new Error('Unconfirmed Condis discovery response');
  }
  const references = catalog.content.flatMap(value => {
    const item = value as { id?: string; description?: string; url?: string } | null;
    if (!item || typeof item.id !== 'string' || typeof item.description !== 'string' || typeof item.url !== 'string') return [];
    try {
      const source = productUrl(new URL(item.url, config.baseUrl).href);
      if (source.pathname.match(/\/p\/(\d+)\/es_ES$/)![1] !== item.id || !acceptsName(item.description)) return [];
      return [{ productId: `condis-${item.id}`, sourceUrl: source.href }];
    } catch { return []; }
  });
  return { references: [...new Map(references.map(reference => [reference.productId, reference])).values()],
    total: catalog.numFound!, count: catalog.content.length };
}

export class CondisScraper extends BaseScraper {
  private nextRequestAt = 0;
  constructor() { super(config); }

  async getProductPrice(productId: string, sourceUrl: string): Promise<ScrapedPrice> {
    const url = productUrl(sourceUrl);
    if (productId !== `condis-${url.pathname.match(/\/p\/(\d+)\/es_ES$/)![1]}`) throw new Error('Condis requested identity differs');
    const now = Date.now();
    const scheduledAt = Math.max(now, this.nextRequestAt);
    this.nextRequestAt = scheduledAt + 1000;
    if (scheduledAt > now) await new Promise(resolve => setTimeout(resolve, scheduledAt - now));
    const browser = await puppeteer.launch({ headless: 'new' });
    try {
      const page = await browser.newPage();
      const response = await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      if (!response || response.status() >= 400) throw Object.assign(new Error(`Condis HTTP ${response?.status() || 'unavailable'}`), {
        response: { status: response?.status(), headers: { 'retry-after': response?.headers()['retry-after'] } },
      });
      await page.waitForSelector('h1.pdp-title-margin', { timeout: 20_000 });
      if (page.url() !== url.href) throw new Error('Condis detail redirected');
      return normalizeCondisProduct(await page.content(), url.href);
    } finally { await browser.close(); }
  }

  async searchProducts(query: string, acceptsName: (name: string) => boolean = () => true): Promise<ScrapedPrice[]> {
    if (!query.trim()) throw new Error('Empty Condis search');
    const references = new Map<string, { productId: string; sourceUrl: string }>();
    let start = 0;
    let total = 0;
    do {
      if (start) await new Promise(resolve => setTimeout(resolve, 1000));
      const url = new URL('https://api.empathy.co/search/v1/query/condis/search');
      url.search = new URLSearchParams({ lang: 'es', start: String(start), rows: '24', query, store: '718' }).toString();
      const response = await axios.get(url.href, { timeout: 30_000, maxRedirects: 0 });
      const page = normalizeCondisSearch(response.data, url.href, acceptsName);
      if (!start) total = page.total;
      if (start < total && !page.count) throw new Error('Incomplete Condis discovery pagination');
      page.references.forEach(reference => references.set(reference.productId, reference));
      start += page.count;
    } while (start < total);
    const quotes: ScrapedPrice[] = [];
    let failedDetail: Error | undefined;
    for (const reference of references.values()) {
      try { quotes.push(await this.getProductPrice(reference.productId, reference.sourceUrl)); }
      catch (error) {
        const status = (error as { response?: { status?: number } }).response?.status;
        if (status === 400 || status === 404 || status === 410) {
          failedDetail = error instanceof Error ? error : new Error('Condis indexed detail is unavailable');
          continue;
        }
        if ((error as { response?: unknown }).response || !(error instanceof Error) || /timeout|net::/i.test(error.message)) {
          throw Object.assign(error instanceof Error ? error : new Error('Condis source failed'), { partialResults: quotes });
        }
        console.warn('[Condis] Rejected detail:', error.message);
      }
    }
    if (failedDetail) throw Object.assign(failedDetail, { partialResults: quotes });
    if (references.size && !quotes.length) throw new Error('No verifiable Condis detail packages');
    return quotes;
  }
  async scrapeProducts(_category?: string): Promise<ScrapedPrice[]> { throw new Error('Condis full-catalog capture is not supported'); }
  async scrapeProductDetails(): Promise<Product | null> { return null; }
}

export const condisScraper = new CondisScraper();
