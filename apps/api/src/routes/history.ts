import { Router, type Router as RouterType } from 'express';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { getBasicCaptureStatus } from '../services/basic-capture.service.js';
import { HISTORY_PROVIDERS } from '../services/price-history.service.js';
import { ACTIVE_BASIC_CHAINS, BASIC_REFERENCES } from '../services/basic-foods.js';

const router: RouterType = Router();
const querySchema = z.object({ days: z.enum(['30', '90', '365']).default('90') });
const storefrontUrls = new Map<string, string>(Object.entries(BASIC_REFERENCES).flatMap(([chain, references]) => references
  .filter(reference => reference.sourceUrl)
  .map(reference => [`catalog:${chain}:${reference.productId}`, reference.sourceUrl!] as const)));

router.get('/', async (req, res) => {
  const query = querySchema.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: 'Periode invalid.' }); return; }
  try {
    const { prisma } = await import('@bossing/database');
    const until = new Date();
    const since = new Date(until.getTime() - Number(query.data.days) * 86_400_000);
    const rows = await prisma.priceHistory.findMany({
      where: { sourceProvider: { in: HISTORY_PROVIDERS }, sourceUrl: { not: null }, warehouse: { not: null },
        packageAmount: { not: null }, packageUnit: { not: null }, recordedAt: { gte: since, lte: until } },
      include: { product: true, supermarket: true }, orderBy: [{ recordedAt: 'desc' }, { id: 'asc' }], take: 5001,
    });
    const series = new Map<string, {
      id: string; productId: string; name: string; supermarket: string; warehouse: string;
      packageAmount: number; packageUnit: string; sourceUrl: string; storefrontUrl?: string; automaticCaptureEnabled: boolean;
      points: { at: string; price: number; pricePerUnit: number }[];
    }>();
    for (const row of rows.slice(0, 5000).reverse()) {
      const id = createHash('sha256').update(JSON.stringify([row.productId, row.supermarketId,
        row.sourceProvider, row.warehouse, row.packageAmount, row.packageUnit])).digest('hex');
      if (!series.has(id)) series.set(id, { id, productId: row.productId, name: row.product.name,
        supermarket: row.supermarket.name, warehouse: row.warehouse!, packageAmount: row.packageAmount!,
        packageUnit: row.packageUnit!, sourceUrl: row.sourceUrl!, storefrontUrl: storefrontUrls.get(row.productId),
        automaticCaptureEnabled: ACTIVE_BASIC_CHAINS.some(chain => chain === row.supermarket.slug), points: [] });
      series.get(id)!.points.push({ at: row.recordedAt.toISOString(), price: row.price, pricePerUnit: row.pricePerUnit });
    }
    res.json({ series: [...series.values()].sort((first, second) => first.name.localeCompare(second.name, 'ca')),
      since: since.toISOString(), until: until.toISOString(), truncated: rows.length > 5000, pricingScope: 'online-catalog' });
  } catch (error) {
    console.error('Error reading price history:', error);
    res.status(503).json({ error: 'No es pot consultar l’historic de preus.' });
  }
});

router.get('/tracking', async (_req, res) => {
  try { res.json(await getBasicCaptureStatus()); }
  catch (error) {
    console.error('Error reading basic capture status:', error);
    res.status(503).json({ error: 'No es pot consultar l’estat de les captures.' });
  }
});

export { router as historyRouter };