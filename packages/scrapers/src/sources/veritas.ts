import axios from 'axios';
import * as cheerio from 'cheerio';
import { BaseScraper } from '../base.js';
import type { Product, ScrapedPrice } from '@bossing/shared';

const config = { name: 'Veritas', baseUrl: 'https://www.veritas.es', rateLimit: 1, enabled: true };
const sitemapUrl = `${config.baseUrl}/media/sitemap/sitemap_es.xml`;

function productUrl(value: string) {
  const url = new URL(value);
  if (url.origin !== config.baseUrl || url.username || url.password || url.search || url.hash ||
    !/^\/compra\/[^/]+-\d+$/.test(url.pathname)) throw new Error('Unconfirmed Veritas detail URL');
  return url;
}

export function normalizeVeritasProduct(value: unknown, sourceUrl: string, scrapedAt = new Date()): ScrapedPrice {
  const url = productUrl(sourceUrl);
  const identifier = url.pathname.match(/-(\d+)$/)![1];
  const product = value as { '@type'?: string; sku?: string; name?: string; url?: string;
    offers?: { '@type'?: string; price?: number | string; priceCurrency?: string; availability?: string;
      url?: string; eligibleQuantity?: unknown; validFrom?: string; validThrough?: string; priceValidUntil?: string } } | null;
  if (!product || product['@type'] !== 'Product' || product.sku !== identifier || product.url !== url.href ||
    typeof product.name !== 'string' || !product.name.trim()) throw new Error('Unconfirmed Veritas product identity');
  const offer = product.offers;
  if (!offer || offer['@type'] !== 'Offer' || offer.priceCurrency !== 'EUR' ||
    !['string', 'number'].includes(typeof offer.price) || !/^\d+(?:\.\d{1,2})?$/.test(String(offer.price)) || Number(offer.price) <= 0 ||
    (offer.url && offer.url !== url.href) || offer.eligibleQuantity || offer.validFrom || offer.validThrough || offer.priceValidUntil ||
    !/^https:\/\/schema\.org\/(InStock|OutOfStock)$/.test(offer.availability || '')) throw new Error('Unconfirmed Veritas euro offer');
  const size = product.name.trim().match(/(?:^|\s)(?:(\d+)\s*x\s*)?(\d+(?:[.,]\d+)?)\s*(kg|g|ml|cl|l|uds?|unidades?|un|u)\.?$/i);
  if (!size || /aprox|granel|peso\s+variable|escurrid/i.test(product.name)) throw new Error('Unconfirmed Veritas fixed package');
  const sourceUnit = size[3].toLowerCase();
  const unit = /^(kg|g)$/.test(sourceUnit) ? 'kg' : /^(ml|cl|l)$/.test(sourceUnit) ? 'l' : 'ud';
  const divisor = /^(g|ml)$/.test(sourceUnit) ? 1000 : sourceUnit === 'cl' ? 100 : 1;
  const amount = Number(size[1] || 1) * Number(size[2].replace(',', '.')) / divisor;
  if (!Number.isFinite(amount) || amount <= 0 || (unit === 'ud' && !Number.isInteger(amount))) throw new Error('Invalid Veritas package amount');
  const price = Number(offer.price);
  return { productId: `veritas-${identifier}`, name: product.name.trim(), supermarket: 'Veritas', supermarketId: 'veritas',
    category: 'Alimentacio', price, pricePerUnit: price / amount, unit, packageSize: { amount, unit },
    available: offer.availability === 'https://schema.org/InStock', scrapedAt,
    source: { provider: 'veritas-storefront', warehouse: 'public-catalog', url: url.href } };
}

export function discoverVeritasProducts(xml: string, query: string, acceptsName: (name: string) => boolean = () => true) {
  const $ = cheerio.load(xml, { xmlMode: true });
  if (!$('urlset').length) throw new Error('Unconfirmed Veritas product sitemap');
  const words = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const terms = words(query);
  if (!terms.length) throw new Error('Empty Veritas discovery query');
  const references = $('url > loc').toArray().flatMap(element => {
    try {
      const url = productUrl($(element).text());
      const identifier = url.pathname.match(/-(\d+)$/)![1];
      const discoveryName = decodeURIComponent(url.pathname.slice('/compra/'.length)).replace(/-\d+$/, '').replace(/-/g, ' ');
      const tokens = words(discoveryName);
      if (!terms.every(term => tokens.includes(term)) || !acceptsName(discoveryName)) return [];
      return [{ productId: `veritas-${identifier}`, sourceUrl: url.href }];
    } catch { return []; }
  });
  return [...new Map(references.map(reference => [reference.productId, reference])).values()];
}

export class VeritasScraper extends BaseScraper {
  private nextRequestAt = 0;
  private catalogue?: { xml: string; at: number };

  constructor() { super(config); }

  private async read(url: string) {
    const now = Date.now();
    const scheduledAt = Math.max(now, this.nextRequestAt);
    this.nextRequestAt = scheduledAt + 1000;
    if (scheduledAt > now) await new Promise(resolve => setTimeout(resolve, scheduledAt - now));
    return axios.get<string>(url, { timeout: 30_000, maxRedirects: 0 });
  }

  async getProductPrice(productId: string, sourceUrl: string): Promise<ScrapedPrice> {
    const url = productUrl(sourceUrl);
    if (productId !== `veritas-${url.pathname.match(/-(\d+)$/)![1]}`) throw new Error('Veritas requested identity differs');
    const response = await this.read(url.href);
    const $ = cheerio.load(response.data);
    if ($('link[rel="canonical"]').length !== 1 || $('link[rel="canonical"]').attr('href') !== url.href) {
      throw new Error('Veritas canonical identity differs');
    }
    const products = $('script[type="application/ld+json"]').toArray().flatMap(element => {
      const value = JSON.parse($(element).text());
      return value?.['@type'] === 'Product' ? [value] : [];
    });
    if (products.length !== 1) throw new Error('Missing or ambiguous Veritas product data');
    return normalizeVeritasProduct(products[0], url.href);
  }

  async searchProducts(query: string, acceptsName: (name: string) => boolean = () => true): Promise<ScrapedPrice[]> {
    if (!this.catalogue || Date.now() - this.catalogue.at > 15 * 60_000) {
      const response = await this.read(sitemapUrl);
      this.catalogue = { xml: response.data, at: Date.now() };
    }
    const references = discoverVeritasProducts(this.catalogue.xml, query, acceptsName);
    const quotes: ScrapedPrice[] = [];
    for (const reference of references) {
      try { quotes.push(await this.getProductPrice(reference.productId, reference.sourceUrl)); }
      catch (error) {
        if (axios.isAxiosError(error)) throw Object.assign(error, { partialResults: quotes });
        console.warn('[Veritas] Rejected detail:', error instanceof Error ? error.message : error);
      }
    }
    if (references.length && !quotes.length) throw new Error('No verifiable Veritas detail packages');
    return quotes;
  }

  async scrapeProducts(category?: string): Promise<ScrapedPrice[]> {
    if (category) return this.searchProducts(category);
    throw new Error('Use Veritas product searches; full-catalog price capture is not validated');
  }
  async scrapeProductDetails(): Promise<Product | null> { return null; }
}

export const veritasScraper = new VeritasScraper();