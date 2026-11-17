import { z } from 'zod';
import { AmetllerScraper, CapraboScraper, ConsumScraper, MercadonaScraper } from '@bossing/scrapers';
import type { ScrapedPrice } from '@bossing/shared';
import { ACTIVE_BASIC_CHAINS, BASIC_CHAINS, BASIC_FOODS, BASIC_REFERENCES, captureDay, type BasicReference } from './basic-foods.js';
import { getHistoryDatabase, observationFromQuote, recordPriceObservations } from './price-history.service.js';

const resultSchema = z.object({
  version: z.literal(1), date: z.string(), postalCode: z.string(), attempts: z.number().int().nonnegative(),
  warehouse: z.string().optional(), nextAttemptAt: z.string().optional(),
  items: z.record(z.object({
    state: z.enum(['recorded', 'unavailable', 'error']), productId: z.string(),
    observedAt: z.string().optional(), message: z.string().optional(), quote: z.unknown().optional(),
  })),
});

export function referenceMatches(reference: BasicReference, quote: ScrapedPrice): boolean {
  const normalize = (value: string) => value.normalize('NFC').trim();
  return reference.productId === quote.productId && normalize(reference.name) === normalize(quote.name) &&
    quote.packageSize?.unit === reference.unit && Math.abs(quote.packageSize.amount - reference.amount) < 1e-8;
}

type ActiveChain = typeof ACTIVE_BASIC_CHAINS[number];

function captureContext(chain: ActiveChain): string {
  return chain !== 'mercadona' ? 'public-catalog'
    : z.string().regex(/^\d{5}$/).parse(process.env.BASIC_CAPTURE_POSTAL_CODE || '08001');
}

export function captureJobId(date: string, postalCode: string, chain: ActiveChain = 'mercadona'): string {
  return `basics:v1:${date}:${chain}:${postalCode}`;
}

function retryDeadline(error: unknown): string {
  const response = error && typeof error === 'object' && 'response' in error
    ? error.response as { headers?: Record<string, string> } : undefined;
  const retry = response?.headers?.['retry-after'];
  const requested = retry && /^\d+$/.test(retry) ? Date.now() + Number(retry) * 1000 : Date.parse(retry || '');
  return new Date(Math.max(Date.now() + 60 * 60_000, Number.isFinite(requested) ? requested : 0)).toISOString();
}

export async function runBasicCapture(chain: ActiveChain = 'mercadona') {
  const postalCode = captureContext(chain);
  const references = BASIC_REFERENCES[chain];
  const date = captureDay();
  const id = captureJobId(date, postalCode, chain);
  const prisma = await getHistoryDatabase();
  const latest = await prisma.scrapingJob.findFirst({ where: {
    id: { startsWith: 'basics:v1:', endsWith: `:${chain}:${postalCode}` },
  }, orderBy: { createdAt: 'desc' } });
  if (latest) {
    const lastResult = resultSchema.parse(JSON.parse(latest.result));
    if (lastResult.nextAttemptAt && new Date(lastResult.nextAttemptAt) > new Date()) {
      return { id: latest.id, status: latest.status, skipped: true, recorded: latest.productsFound };
    }
  }
  const initial: z.infer<typeof resultSchema> = { version: 1, date, postalCode, attempts: 0, items: {} };
  await prisma.scrapingJob.upsert({ where: { id }, update: {},
    create: { id, supermarketId: chain, result: JSON.stringify(initial) } });
  const previous = await prisma.scrapingJob.findUniqueOrThrow({ where: { id } });
  const result = resultSchema.parse(JSON.parse(previous.result));
  const now = new Date();
  if (previous.status === 'complete' || result.attempts >= 3 ||
    (previous.status === 'running' && previous.startedAt && now.getTime() - previous.startedAt.getTime() < 30 * 60_000) ||
    (result.nextAttemptAt && new Date(result.nextAttemptAt) > now)) {
    return { id, status: previous.status, skipped: true, recorded: previous.productsFound };
  }
  result.attempts++;
  delete result.nextAttemptAt;
  const claimed = await prisma.scrapingJob.updateMany({
    where: { id, status: previous.status, startedAt: previous.startedAt, result: previous.result },
    data: { status: 'running', startedAt: now, completedAt: null, result: JSON.stringify(result) },
  });
  if (!claimed.count) return { id, status: 'running', skipped: true, recorded: previous.productsFound };
  const save = async (status: string, errors = '') => {
    const updated = await prisma.scrapingJob.updateMany({ where: { id, status: 'running', startedAt: now }, data: {
      status, result: JSON.stringify(result), errors,
      productsFound: Object.values(result.items).filter(item => item.state === 'recorded').length,
      completedAt: status === 'running' ? null : new Date(),
    } });
    if (!updated.count) throw new Error('Capture lease lost');
  };
  try {
    const scraper = chain === 'mercadona' ? new MercadonaScraper() : chain === 'consum' ? new ConsumScraper()
      : chain === 'caprabo' ? new CapraboScraper() : new AmetllerScraper();
    const warehouse = scraper instanceof MercadonaScraper ? await scraper.setPostalCode(postalCode) : 'public-catalog';
    if (result.warehouse && result.warehouse !== warehouse) throw new Error('Pricing warehouse changed during capture');
    result.warehouse = warehouse;
    for (const reference of references) {
      if (['recorded', 'unavailable'].includes(result.items[reference.foodId]?.state)) continue;
      if (captureDay() !== date) throw new Error('Capture crossed the commercial date; no backdating');
      let rateLimited = false;
      try {
        const quote = scraper instanceof CapraboScraper || scraper instanceof AmetllerScraper
          ? await scraper.getProductPrice(reference.productId, reference.sourceUrl || '')
          : await scraper.getProductPrice(reference.productId);
        if (!referenceMatches(reference, quote)) throw new Error('Product name or packaging changed; review reference');
        if (quote.source?.warehouse !== warehouse || captureDay(new Date(quote.scrapedAt)) !== date) {
          throw new Error('Unconfirmed pricing context or observation date');
        }
        if (quote.available && !observationFromQuote(quote)) throw new Error('Invalid price provenance');
        if (quote.available && await recordPriceObservations([quote], id) !== 1) throw new Error('Observation not persisted');
        result.items[reference.foodId] = { state: quote.available ? 'recorded' : 'unavailable',
          productId: reference.productId, observedAt: new Date(quote.scrapedAt).toISOString(), quote };
      } catch (error) {
        result.items[reference.foodId] = { state: 'error', productId: reference.productId,
          message: error instanceof Error ? error.message.slice(0, 500) : 'Source error' };
        if (error && typeof error === 'object' && 'response' in error) {
          const response = error.response as { status?: number; headers?: Record<string, string> };
          if (response?.status === 429 || response?.status === 403) {
            rateLimited = true;
            result.nextAttemptAt = retryDeadline(error);
          }
        }
      }
      await save('running');
      if (rateLimited) break;
    }
    const complete = references.every(reference => ['recorded', 'unavailable'].includes(result.items[reference.foodId]?.state));
    if (!complete) result.nextAttemptAt ||= new Date(Date.now() + 60 * 60_000).toISOString();
    const status = complete ? 'complete' : 'partial';
    await save(status, complete ? '' : 'Some basic foods were not captured; inspect result.items');
    return { id, status, skipped: false, recorded: Object.values(result.items).filter(item => item.state === 'recorded').length };
  } catch (error) {
    result.nextAttemptAt = retryDeadline(error);
    await save('failed', error instanceof Error ? error.message.slice(0, 500) : 'Capture failed');
    throw error;
  }
}

export async function getBasicCaptureStatus() {
  const prisma = await getHistoryDatabase();
  const postalCode = captureContext('mercadona');
  const chains = await Promise.all(BASIC_CHAINS.map(async chain => {
    const active = ACTIVE_BASIC_CHAINS.find(target => target === chain);
    if (!active) return { chain, status: 'pending-validation', references: 0, products: [], context: null, latest: null, current: false };
    const context = captureContext(active);
    const products = BASIC_REFERENCES[active];
    const latest = await prisma.scrapingJob.findFirst({
      where: { id: { startsWith: 'basics:v1:', endsWith: `:${chain}:${context}` } }, orderBy: { createdAt: 'desc' },
    });
    const result = latest ? resultSchema.parse(JSON.parse(latest.result)) : null;
    return { chain, status: 'active', references: products.length, products, context,
      missingFoods: BASIC_FOODS.filter(food => !products.some(reference => reference.foodId === food.id)).map(food => food.id),
      latest: latest && result ? { id: latest.id, status: latest.status, date: result.date,
        recorded: latest.productsFound, total: products.length, attempts: result.attempts,
        startedAt: latest.startedAt, completedAt: latest.completedAt, warehouse: result.warehouse,
        nextAttemptAt: result.nextAttemptAt, error: latest.errors || null,
        items: products.map(reference => ({ foodId: reference.foodId, state: result.items[reference.foodId]?.state || 'pending',
          observedAt: result.items[reference.foodId]?.observedAt, message: result.items[reference.foodId]?.message })),
      } : null,
      current: result?.date === captureDay() && latest?.status === 'complete',
    };
  }));
  return {
    foods: BASIC_FOODS, timeZone: 'Europe/Madrid', scheduledHour: 4, postalCode,
    chains, latest: chains.find(chain => chain.chain === 'mercadona')?.latest || null,
    current: chains.filter(chain => chain.status === 'active').every(chain => chain.current),
  };
}