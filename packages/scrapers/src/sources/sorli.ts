import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import { BaseScraper } from '../base.js';
import type { Product, ScrapedPrice } from '@bossing/shared';

const config = { name: 'Sorli', baseUrl: 'https://www.sorliclic.com', rateLimit: 1, enabled: true };

function productUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.origin !== config.baseUrl || url.username || url.password || url.search || url.hash ||
    !/^\/ca\/p\/[^/]+\/\d+$/.test(url.pathname)) throw new Error('Unconfirmed Sorli product URL');
  return url;
}

export function normalizeSorliProduct(html: string, sourceUrl: string, scrapedAt = new Date()): ScrapedPrice {
  const url = productUrl(sourceUrl);
  const identifier = url.pathname.match(/\/(\d+)$/)![1];
  const $ = cheerio.load(html);
  const details = $('.informacion-producto-detalle');
  const fields = details.children('div').first().children('div');
  const identity = fields.filter((_index, element) => $(element).text().trim() === `Codi del producte: ${identifier}`);
  const brand = fields.eq(0).text().trim();
  const description = fields.eq(1).text().trim();
  const prices = details.find('.detalle-precio > div.d-inline > p');
  const priceText = prices.text().trim().match(/^(\d+(?:[.,]\d{2})?)\s*\u20ac$/);
  const buttons = details.find('app-selector-unidades-producto button.btn-comprar');
  const postalCodes = new Set([...$('body').text().matchAll(/assortiment de\s+(\d{5})/g)].map(match => match[1]));
  if (details.length !== 1 || identity.length !== 1 || !brand || !description || prices.length !== 1 || !priceText ||
    buttons.length !== 1 || buttons.text().trim() !== 'COMPRAR' || buttons.is('[disabled]') || buttons.attr('aria-disabled') === 'true' ||
    postalCodes.size !== 1 || /aprox|granel|pes(?:o)?\s+variable/i.test(description)) throw new Error('Unconfirmed Sorli detail, euro offer, availability or postal context');
  const size = description.match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*(kg?|gr?|ml|cl|lt?|unt|unitats?|u(?:ds?)?)\.?\s*(?:pack\s*(\d+))?(?:\s+sense gluten)?$/i);
  if (!size) throw new Error('Unconfirmed Sorli fixed packaging');
  const sourceUnit = size[2].toLowerCase();
  const unit = /^(kg?|gr?)$/.test(sourceUnit) ? 'kg' : /^(ml|cl|lt?)$/.test(sourceUnit) ? 'l' : 'ud';
  const amount = Number(size[1].replace(',', '.')) * Number(size[3] || 1) / (/^(gr?|ml)$/.test(sourceUnit) ? 1000 : sourceUnit === 'cl' ? 100 : 1);
  const price = Number(priceText[1].replace(',', '.'));
  if (!Number.isFinite(amount) || amount <= 0 || price <= 0 || (unit === 'ud' && !Number.isInteger(amount))) throw new Error('Invalid Sorli package or price');
  return { productId: `sorli-${identifier}`, name: `${brand} ${description}`, supermarket: 'Sorli', supermarketId: 'sorli', category: 'Alimentacio',
    price, pricePerUnit: price / amount, unit, packageSize: { amount, unit }, available: true, scrapedAt,
    source: { provider: 'sorli-storefront', warehouse: `postal:${[...postalCodes][0]}`, url: url.href } };
}

export function normalizeSorliSearch(value: unknown, expectedPage: number) {
  const page = (value as { articulos?: { results?: unknown[]; currentPage?: number; totalResults?: number; hasNext?: boolean } } | null)?.articulos;
  if (!page || !Array.isArray(page.results) || page.currentPage !== expectedPage || !Number.isInteger(page.totalResults) ||
    page.totalResults! < 0 || typeof page.hasNext !== 'boolean' || (page.hasNext && !page.results.length)) {
    throw new Error('Unconfirmed Sorli discovery pagination');
  }
  const references = page.results.map(value => {
    const item = value as { idArticulo?: number; descripcion?: string; marca?: { descripcion?: string }; categoria?: { descripcion?: string } } | null;
    if (!item || !Number.isInteger(item.idArticulo) || item.idArticulo! <= 0 || typeof item.descripcion !== 'string' ||
      !item.descripcion.trim() || typeof item.marca?.descripcion !== 'string') throw new Error('Unconfirmed Sorli discovery identity');
    return { productId: `sorli-${item.idArticulo}`, name: `${item.marca.descripcion} ${item.descripcion}`,
      classification: typeof item.categoria?.descripcion === 'string' ? item.categoria.descripcion : '' };
  });
  return { references, total: page.totalResults!, hasNext: page.hasNext };
}

export class SorliScraper extends BaseScraper {
  private nextRequestAt = 0;
  constructor() { super(config); }

  async getProductPrice(productId: string, sourceUrl: string): Promise<ScrapedPrice> {
    const url = productUrl(sourceUrl);
    if (productId !== `sorli-${url.pathname.match(/\/(\d+)$/)![1]}`) throw new Error('Sorli requested identity differs');
    const now = Date.now();
    const scheduledAt = Math.max(now, this.nextRequestAt);
    this.nextRequestAt = scheduledAt + 1000;
    if (scheduledAt > now) await new Promise(resolve => setTimeout(resolve, scheduledAt - now));
    const browser = await puppeteer.launch({ headless: 'new' });
    try {
      const page = await browser.newPage();
      const response = await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      if (!response || response.status() >= 400) throw Object.assign(new Error(`Sorli HTTP ${response?.status() || 'unavailable'}`), {
        response: { status: response?.status(), headers: { 'retry-after': response?.headers()['retry-after'] } },
      });
      await page.waitForSelector('.informacion-producto-detalle app-selector-unidades-producto button.btn-comprar', { timeout: 20_000 });
      if (page.url() !== url.href) throw new Error('Sorli detail redirected');
      return normalizeSorliProduct(await page.content(), url.href);
    } finally { await browser.close(); }
  }

  async searchProducts(query: string, acceptsName: (name: string) => boolean = () => true): Promise<ScrapedPrice[]> {
    if (!query.trim()) throw new Error('Empty Sorli search');
    const browser = await puppeteer.launch({ headless: 'new' });
    const quotes: ScrapedPrice[] = [];
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 900 });
      const responsePages = new Map<number, import('puppeteer').HTTPResponse>();
      page.on('response', response => {
        if (new URL(response.url()).origin !== 'https://api.sorliclic.com' ||
          new URL(response.url()).pathname !== '/api/articulos/filtersort' || response.request().method() !== 'POST') return;
        try {
          const body = JSON.parse(response.request().postData() || '{}');
          if (body.idioma === 'ca' && body.filterArticulos?.descripcion === query && Number.isInteger(body.paginationFilter?.pageNumber)) {
            responsePages.set(body.paginationFilter.pageNumber, response);
          }
        } catch { return; }
      });
      const nextResponse = (pageNumber: number) => {
        const received = responsePages.get(pageNumber);
        if (received) return Promise.resolve(received);
        const pending = page.waitForResponse(response => {
          if (new URL(response.url()).origin !== 'https://api.sorliclic.com' ||
            new URL(response.url()).pathname !== '/api/articulos/filtersort' || response.request().method() !== 'POST') return false;
          try {
            const body = JSON.parse(response.request().postData() || '{}');
            return body.idioma === 'ca' && body.filterArticulos?.descripcion === query && body.paginationFilter?.pageNumber === pageNumber;
          } catch { return false; }
        }, { timeout: 30_000 });
        pending.catch(() => {});
        return pending;
      };
      let pending = nextResponse(1);
      const navigation = await page.goto(`${config.baseUrl}/ca/s/${encodeURIComponent(query)}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      if (!navigation || navigation.status() >= 400) throw new Error(`Sorli HTTP ${navigation?.status() || 'unavailable'}`);
      const reject = await page.$('#CybotCookiebotDialogBodyButtonDecline');
      if (reject) await reject.click();
      let offset = 0;
      let pageNumber = 1;
      let expectedTotal: number | undefined;
      do {
        const response = await pending;
        if (response.status() !== 200) throw Object.assign(new Error(`Sorli HTTP ${response.status()}`), {
          response: { status: response.status(), headers: { 'retry-after': response.headers()['retry-after'] } },
        });
        const result = normalizeSorliSearch(await response.json(), pageNumber);
        expectedTotal ??= result.total;
        await page.waitForFunction(count => document.querySelectorAll('.descripcion-producto').length >= count,
          { timeout: 20_000 }, offset + result.references.length);
        for (const [index, reference] of result.references.entries()) {
          if (!acceptsName(`${reference.name} ${reference.classification}`)) continue;
          const now = Date.now();
          const scheduledAt = Math.max(now, this.nextRequestAt);
          this.nextRequestAt = scheduledAt + 1000;
          if (scheduledAt > now) await new Promise(resolve => setTimeout(resolve, scheduledAt - now));
          const cards = await page.$$('.descripcion-producto');
          await cards[offset + index].click();
          await page.waitForSelector('.informacion-producto-detalle app-selector-unidades-producto button.btn-comprar', { timeout: 20_000 });
          const url = productUrl(page.url());
          if (`sorli-${url.pathname.match(/\/(\d+)$/)![1]}` !== reference.productId) throw new Error('Sorli card/detail identity differs');
          try { quotes.push(normalizeSorliProduct(await page.content(), url.href)); }
          catch (error) { console.warn('[Sorli] Rejected detail:', error instanceof Error ? error.message : error); }
          await page.click('button.btn-close.close');
          await page.waitForFunction(() => !document.querySelector('.informacion-producto-detalle'), { timeout: 15_000 });
        }
        offset += result.references.length;
        if (!result.hasNext) {
          if (offset < expectedTotal) throw new Error('Incomplete Sorli discovery pagination');
          break;
        }
        pending = nextResponse(++pageNumber);
        await page.evaluate(() => {
          const container = document.querySelector<HTMLElement>('.layout-main-container');
          if (!container) throw new Error('Missing Sorli scroll container');
          container.scrollTop = container.scrollHeight;
        });
      } while (true);
      return [...new Map(quotes.map(quote => [quote.productId, quote])).values()];
    } catch (error) {
      throw Object.assign(error instanceof Error ? error : new Error('Sorli source failed'), { partialResults: quotes });
    } finally { await browser.close(); }
  }
  async scrapeProducts(_category?: string): Promise<ScrapedPrice[]> { throw new Error('Sorli full-catalog capture is not supported'); }
  async scrapeProductDetails(): Promise<Product | null> { return null; }
}

export const sorliScraper = new SorliScraper();