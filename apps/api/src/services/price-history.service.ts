import { createHash } from 'node:crypto';
import type { ScrapedPrice } from '@bossing/shared';

const HISTORY_SOURCES = [
  { provider: 'mercadona-rest', chain: 'mercadona', name: 'Mercadona', host: 'tienda.mercadona.es', color: '#198465', id: /^merc-\d+(?:\.\d+)?$/ },
  { provider: 'consum-rest', chain: 'consum', name: 'Consum', host: 'tienda.consum.es', color: '#ef7d00', id: /^consum-\d+$/ },
  { provider: 'caprabo-storefront', chain: 'caprabo', name: 'Caprabo', host: 'www.capraboacasa.com', color: '#e31b34', id: /^caprabo-\d+$/ },
  { provider: 'ametller-scapi', chain: 'ametller', name: 'Ametller Origen', host: 'www.ametllerorigen.com', color: '#54733e', id: /^ametller-\d+$/ },
  { provider: 'bonpreu-storefront', chain: 'bonpreu', name: 'Bonpreu', host: 'www.compraonline.bonpreuesclat.cat', color: '#e6b300', id: /^bonpreu-\d+$/ },
  { provider: 'bonarea-storefront', chain: 'bonarea', name: 'bon\u00c0rea', host: 'www.bonarea-online.com', color: '#dc2638', id: /^bonarea-\d+_\d+$/ },
  { provider: 'condis-storefront', chain: 'condis', name: 'Condis', host: 'compraonline.condis.es', color: '#bb162b', id: /^condis-\d+$/ },
  { provider: 'sorli-storefront', chain: 'sorli', name: 'Sorli', host: 'www.sorliclic.com', color: '#e5282d', id: /^sorli-\d+$/ },
  { provider: 'dia-storefront', chain: 'dia', name: 'DIA', host: 'www.dia.es', color: '#d52b1e', id: /^dia-\d+(?:P\d+)?$/ },
  { provider: 'alcampo-storefront', chain: 'alcampo', name: 'Alcampo', host: 'www.compraonline.alcampo.es', color: '#d71920', id: /^alcampo-\d+$/ },
  { provider: 'eroski-storefront', chain: 'eroski', name: 'Eroski', host: 'supermercado.eroski.es', color: '#df0024', id: /^eroski-\d+$/ },
  { provider: 'aldi-storefront', chain: 'aldi', name: 'Aldi', host: 'www.aldi.es', color: '#005aab', id: /^aldi-\d+$/ },
  { provider: 'carrefour-storefront', chain: 'carrefour', name: 'Carrefour', host: 'www.carrefour.es', color: '#005aa8', id: /^carrefour-(?:VC4AECOMM-)?\d+$/ },
  { provider: 'veritas-storefront', chain: 'veritas', name: 'Veritas', host: 'www.veritas.es', color: '#6b8c32', id: /^veritas-\d+$/ },
  { provider: 'plusfresc-rest', chain: 'plusfresc', name: 'Plusfresc', host: 'wscompra.plusfresc.cat', color: '#bd202e', id: /^plusfresc-\d+$/ },
] as const;

export const HISTORY_PROVIDERS = HISTORY_SOURCES.map(source => source.provider);

export function observationFromQuote(quote: ScrapedPrice, captureId?: string) {
  const { source, packageSize } = quote;
  const policy = HISTORY_SOURCES.find(policy => policy.provider === source?.provider);
  if (!policy || !source || !quote.available || !policy.id.test(quote.productId) ||
    quote.supermarketId !== policy.chain || !source.warehouse || !packageSize ||
    !Number.isFinite(packageSize.amount) || packageSize.amount <= 0 || !packageSize.unit ||
    !Number.isFinite(quote.price) || quote.price <= 0 ||
    !Number.isFinite(quote.pricePerUnit) || quote.pricePerUnit <= 0) return null;
  try {
    const url = new URL(source.url);
    if (url.protocol !== 'https:' || url.hostname !== policy.host || url.username || url.password) return null;
    if (policy.chain === 'consum' && (source.warehouse !== 'public-catalog' ||
      url.pathname !== `/api/rest/V1.0/catalog/product/${quote.productId.slice(7)}`)) return null;
    if (policy.chain === 'caprabo' && (source.warehouse !== 'public-catalog' ||
      !url.pathname.startsWith(`/ca/productdetail/${quote.productId.slice(8)}-`))) return null;
    if (policy.chain === 'bonpreu' && (source.warehouse !== 'public-catalog' || url.port || url.search || url.hash ||
      !new RegExp(`^/products/[^/]+/${quote.productId.slice(8)}$`).test(url.pathname))) return null;
    if (policy.chain === 'bonarea' && (source.warehouse !== 'public-catalog' || url.port || url.search || url.hash ||
      !new RegExp(`^/online/producto/[^/]+/${quote.productId.slice(8)}$`).test(url.pathname))) return null;
    if (policy.chain === 'condis' && (source.warehouse !== 'public-catalog' || url.port || url.search || url.hash ||
      !new RegExp(`^/[^/]+/p/${quote.productId.slice(7)}/es_ES$`).test(url.pathname))) return null;
    if (policy.chain === 'sorli' && (!/^postal:\d{5}$/.test(source.warehouse) || url.port || url.search || url.hash ||
      !new RegExp(`^/ca/p/[^/]+/${quote.productId.slice(6)}$`).test(url.pathname))) return null;
    if (policy.chain === 'veritas' && (source.warehouse !== 'public-catalog' || url.port || url.search || url.hash ||
      !new RegExp(`^/compra/[^/]+-${quote.productId.slice(8)}$`).test(url.pathname))) return null;
    if (policy.chain === 'plusfresc' && (source.warehouse !== 'centre:12;postal:25001' || url.port || url.search || url.hash ||
      !/^\/api\/search\/languages\/ca\/[^/]+\/products\/12$/.test(url.pathname))) return null;
    if (policy.chain === 'dia' && (source.warehouse !== 'public-catalog' || url.port || url.search || url.hash ||
      !new RegExp(`^/(?:[^/]+/)+p/${quote.productId.slice(4)}$`).test(url.pathname))) return null;
    if (policy.chain === 'alcampo' && (source.warehouse !== 'public-catalog' || url.port || url.search || url.hash ||
      !new RegExp(`^/products/[^/]+/${quote.productId.slice(8)}$`).test(url.pathname))) return null;
    if (policy.chain === 'eroski' && (source.warehouse !== 'public-catalog' || url.port || url.search || url.hash ||
      !new RegExp(`^/(es|ca|en)/productdetail/${quote.productId.slice(7)}-[^/]+/$`).test(url.pathname))) return null;
    if (policy.chain === 'aldi' && (source.warehouse !== 'public-catalog' || url.port || url.search || url.hash ||
      !new RegExp(`^/producto/[^/]+-${quote.productId.slice(5)}\\.html$`).test(url.pathname))) return null;
    if (policy.chain === 'carrefour' && (source.warehouse !== 'public-catalog' || url.port || url.search || url.hash ||
      !new RegExp(`^/supermercado/[^/]+/R-${quote.productId.slice(10)}/p$`).test(url.pathname))) return null;
    if (policy.chain === 'ametller' && (source.warehouse !== 'public-catalog' ||
      url.pathname !== `/mobify/proxy/api/product/shopper-products/v1/organizations/f_ecom_blzv_prd/products/${quote.productId.slice(9)}` ||
      url.searchParams.get('siteId') !== 'ametller' || url.searchParams.get('currency') !== 'EUR' || url.searchParams.get('locale') !== 'ca')) return null;
  } catch { return null; }
  const recordedAt = new Date(quote.scrapedAt);
  if (!Number.isFinite(recordedAt.getTime()) || recordedAt.getTime() <= 0 || recordedAt.getTime() > Date.now() + 60_000) return null;
  const identity = JSON.stringify([source.provider, quote.productId, source.warehouse,
    packageSize.amount, packageSize.unit, captureId || recordedAt.toISOString()]);
  return {
    id: createHash('sha256').update(identity).digest('hex'),
    productId: `catalog:${policy.chain}:${quote.productId}`, chain: policy.chain,
    name: quote.name, category: quote.category, imageUrl: quote.imageUrl,
    price: quote.price, pricePerUnit: quote.pricePerUnit, recordedAt,
    sourceProvider: source.provider, sourceUrl: source.url, warehouse: source.warehouse,
    packageAmount: packageSize.amount, packageUnit: packageSize.unit,
  };
}

export async function getHistoryDatabase() {
  const { prisma } = await import('@bossing/database');
  return prisma;
}

export async function recordPriceObservations(quotes: ScrapedPrice[], captureId?: string) {
  const observations = new Map(quotes.map(quote => observationFromQuote(quote, captureId)).filter(observation => observation !== null)
    .map(observation => [observation.id, observation]));
  if (!observations.size) return 0;
  const prisma = await getHistoryDatabase();
  await prisma.$transaction(async transaction => {
    const supermarkets = new Map<string, string>();
    for (const observation of observations.values()) {
      const { name, category, imageUrl, chain, ...history } = observation;
      if (!supermarkets.has(chain)) {
        const policy = HISTORY_SOURCES.find(policy => policy.chain === chain)!;
        const supermarket = await transaction.supermarket.upsert({
          where: { slug: chain }, update: {},
          create: { name: policy.name, slug: chain, website: `https://${policy.host}`, color: policy.color },
        });
        supermarkets.set(chain, supermarket.id);
      }
      await transaction.product.upsert({
        where: { id: observation.productId }, update: { name, imageUrl },
        create: { id: observation.productId, name, normalizedName: name.toLowerCase(), category,
          imageUrl, unit: observation.packageUnit, size: observation.packageAmount },
      });
      await transaction.priceHistory.upsert({
        where: { id: history.id }, update: {}, create: { ...history, supermarketId: supermarkets.get(chain)! },
      });
    }
  });
  return observations.size;
}