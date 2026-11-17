import axios from 'axios';
import * as cheerio from 'cheerio';
import { BaseScraper } from '../base.js';
import type { Product, ScrapedPrice } from '@bossing/shared';

const config = { name: 'bonArea', baseUrl: 'https://www.bonarea-online.com', rateLimit: 1, enabled: true };

function productUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.origin !== config.baseUrl || url.username || url.password || url.search || url.hash ||
    !/^\/online\/producto\/[^/]+\/\d+_\d+$/.test(url.pathname)) throw new Error('Unconfirmed bonArea product URL');
  return url;
}

export function discoverBonareaProducts(html: string, query: string, acceptsName: (name: string) => boolean = () => true): { productId: string; sourceUrl: string }[] {
  const normalize = (value: string): string[] => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().match(/[a-z0-9]+/g) || [];
  const terms = normalize(query).filter(term => !['de', 'del', 'la', 'el'].includes(term));
  if (!terms.length) return [];
  const $ = cheerio.load(html);
  const references = new Map<string, { productId: string; sourceUrl: string }>();
  $('a.article-link[data-friendly][data-identifier]').each((_, element) => {
    const link = $(element);
    const text = link.find('.text > p').text();
    if (!acceptsName(text)) return;
    const name = normalize(text);
    if (!terms.every(term => name.includes(term))) return;
    const url = productUrl(link.attr('data-friendly')!);
    const identifier = url.pathname.split('/').pop()!;
    if (link.attr('data-identifier') !== identifier.replace('_', '*')) throw new Error('bonArea search identity differs');
    references.set(identifier, { productId: `bonarea-${identifier}`, sourceUrl: url.href });
  });
  return [...references.values()];
}

export function normalizeBonareaProduct(html: string, sourceUrl: string, scrapedAt = new Date()): ScrapedPrice {
  const source = productUrl(sourceUrl);
  const identifier = source.pathname.split('/').pop()!;
  const storefrontId = identifier.replace('_', '*');
  const $ = cheerio.load(html);
  const detail = $('.detail.detail-page');
  if (detail.length !== 1 || detail.find('h1.title').length !== 1 || detail.find('#articleId0').val() !== storefrontId) {
    throw new Error('Unconfirmed bonArea product identity');
  }
  const name = detail.find('h1.title').text().trim();
  const packaging = detail.find('.content-title > .subtitle');
  const size = packaging.text().trim().toLowerCase().match(/^(\d+(?:[.,]\d+)?)\s*(kg|g|ml|cl|l|u\.?|uds?\.?|unidades?)$/);
  if (!name || packaging.length !== 1 || !size || /aprox|granel|peso\s+variable/i.test(name + ' ' + packaging.text())) {
    throw new Error('Unconfirmed bonArea fixed packaging');
  }
  const prices = detail.find('.content-price > span.h2.bold');
  const euroPrice = prices.text().trim().match(/^(\d+(?:[.,]\d{1,2})?)\s*\u20ac\/u$/);
  if (prices.length !== 1 || !euroPrice) throw new Error('Unconfirmed bonArea euro price');
  const price = Number(euroPrice[1].replace(',', '.'));
  const buy = detail.find('a#lnkArticleBeforeBuy0');
  if (buy.length !== 1 || buy.text().trim() !== 'Comprar' || /display\s*:\s*none/i.test(buy.attr('style') || '') ||
    !(buy.attr('onclick') || '').includes(`'${storefrontId}','1'`)) throw new Error('Unconfirmed bonArea availability');
  const sourceUnit = size[2];
  const unit = /^(kg|g)$/.test(sourceUnit) ? 'kg' : /^(ml|cl|l)$/.test(sourceUnit) ? 'l' : 'ud';
  const amount = Number(size[1].replace(',', '.')) / (sourceUnit === 'g' || sourceUnit === 'ml' ? 1000 : sourceUnit === 'cl' ? 100 : 1);
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(amount) || amount <= 0 || (unit === 'ud' && !Number.isInteger(amount))) {
    throw new Error('Invalid bonArea price or package amount');
  }
  return { productId: `bonarea-${identifier}`, name, supermarket: 'bon\u00c0rea', supermarketId: 'bonarea', category: 'Alimentacio',
    price, pricePerUnit: price / amount, unit, packageSize: { amount, unit }, available: true, scrapedAt,
    source: { provider: 'bonarea-storefront', warehouse: 'public-catalog', url: source.href } };
}

export class BonareaScraper extends BaseScraper {
  private nextRequestAt = 0;
  constructor() { super(config); }

  async getProductPrice(productId: string, sourceUrl: string): Promise<ScrapedPrice> {
    const url = productUrl(sourceUrl);
    if (productId !== `bonarea-${url.pathname.split('/').pop()}`) throw new Error('bonArea requested identity differs');
    const now = Date.now();
    const scheduledAt = Math.max(now, this.nextRequestAt);
    this.nextRequestAt = scheduledAt + 1000;
    if (scheduledAt > now) await new Promise(resolve => setTimeout(resolve, scheduledAt - now));
    const response = await axios.get<string>(url.href, { timeout: 30_000, maxRedirects: 0 });
    return normalizeBonareaProduct(response.data, url.href);
  }

  async searchProducts(query: string, acceptsName?: (name: string) => boolean): Promise<ScrapedPrice[]> {
    const url = new URL('/es/shop/find', config.baseUrl);
    url.searchParams.set('searchWords', query);
    const response = await axios.get<string>(url.href, { timeout: 30_000, maxRedirects: 0 });
    const references = discoverBonareaProducts(response.data, query, acceptsName);
    const results: ScrapedPrice[] = [];
    for (const reference of references) {
      try {
        results.push(await this.getProductPrice(reference.productId, reference.sourceUrl));
      } catch (error) {
        if (axios.isAxiosError(error)) throw Object.assign(error, { partialResults: results });
        console.warn('[bonArea] Detail rejected:', reference.productId, error instanceof Error ? error.message : error);
      }
    }
    if (references.length && !results.length) throw new Error('No bonArea search details could be validated');
    return results;
  }
  async scrapeProducts(_category?: string): Promise<ScrapedPrice[]> { throw new Error('bonArea full-catalog capture is not supported'); }
  async scrapeProductDetails(): Promise<Product | null> { return null; }
}

export const bonareaScraper = new BonareaScraper();