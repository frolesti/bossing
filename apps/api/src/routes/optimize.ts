import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import {
  mercadonaScraper,
  MercadonaScraper,
  consumScraper,
  carrefourScraper,
  diaScraper,
  bonpreuScraper,
  ametllerScraper,
  capraboScraper,
  lasirenaScraper,
  plusfrescScraper,
  veritasScraper,
  condisScraper,
  bonareaScraper,
  sorliScraper,
  eroskiScraper
} from '@bossing/scrapers';
import type { PurchaseLine, ScrapedPrice } from '@bossing/shared';
import { fileCache } from '../services/cache.service.js';
import { mapWithConcurrency } from '../services/concurrency.service.js';
import { getLocalCatalogReferences } from '../services/local-catalog.service.js';
import { cheapestCompatibleProduct, compatibleProduct, genericProductQuery, productSearchQuery } from '../services/product-matching.service.js';
import {
  batchTranslateToSpanish,
  getSpanishVariantSync,
  getCatalanVariantSync,
} from '../services/translation.service.js';

const router: RouterType = Router();

// TTL per a la cache de l'optimitzador (4 hores)
const OPTIMIZE_CACHE_TTL = 1000 * 60 * 60 * 4;

const optimizeRequestSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string().optional(),
      catalogProductId: z.string().optional(),
      matchMode: z.enum(['generic', 'exact']).optional(),
      quantityMode: z.enum(['amount', 'packages']).default('amount'),
      name: z.string().trim().min(1),
      quantity: z.number().positive().finite().default(1),
      unit: z.string().trim().min(1).optional(),
    }).refine(item => item.quantityMode !== 'packages' || Number.isInteger(item.quantity), 'Package count must be an integer')
  ).min(1),
  postalCode: z.string().regex(/^\d{5}$/).optional(),
  supermarketIds: z.array(z.string()).min(1).optional(),
  stores: z.array(z.object({
    id: z.string().min(1), chain: z.string().min(1), name: z.string().min(1),
    address: z.string(), lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180),
  })).min(1).max(200).optional(),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  maxRadius: z.number().min(0.05).max(2).default(2),
  maxStops: z.number().min(1).max(5).default(3),
  prioritize: z.enum(['price', 'distance', 'balanced']).default('balanced'),
});

// ============================================================
// Traducció Català ↔ Castellà (Google Gemini + cache)
// Veure: services/translation.service.ts
// ============================================================

// Scrapers actius per comparació en viu (amb idioma principal)
const ACTIVE_SCRAPERS = [
  { scraper: mercadonaScraper, name: 'Mercadona', lang: 'es' as const },
  { scraper: consumScraper, name: 'Consum', lang: 'es' as const },
  { scraper: carrefourScraper, name: 'Carrefour', lang: 'es' as const },
  { scraper: diaScraper, name: 'DIA', lang: 'es' as const },
  { scraper: bonpreuScraper, name: 'Bonpreu', lang: 'ca' as const },
  { scraper: ametllerScraper, name: 'Ametller Origen', lang: 'ca' as const },
  { scraper: capraboScraper, name: 'Caprabo', lang: 'ca' as const },
  { scraper: lasirenaScraper, name: 'La Sirena', lang: 'es' as const },
  { scraper: plusfrescScraper, name: 'Plusfresc', lang: 'ca' as const },
  { scraper: condisScraper, name: 'Condis', lang: 'es' as const },
  { scraper: veritasScraper, name: 'Veritas', lang: 'es' as const },
  { scraper: bonareaScraper, name: 'bon\u00c0rea', lang: 'es' as const },
  { scraper: sorliScraper, name: 'Sorli', lang: 'ca' as const },
  { scraper: eroskiScraper, name: 'Eroski', lang: 'es' as const },
];

/**
 * Puntuació de coincidència robusta amb:
 * - Word-boundary awareness ("pa" no coincideix amb "pasta")
 * - Suport bilingüe (compara en català I castellà)
 * - Posició: prioritza quan el terme de cerca és el subjecte principal
 */
function matchScore(searchTerm: string, productName: string): number {
  const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const search = norm(searchTerm);
  const name = norm(productName);

  if (name === search) return 100;

  // Build search variants: original + translated (both directions)
  // Usa el servei de traducció (cache Groq o diccionari)
  const variants: string[] = [search];
  const spanishV = getSpanishVariantSync(searchTerm);
  if (spanishV) variants.push(norm(spanishV));
  // Also try Catalan variant if input looks Spanish
  const catalanV = getCatalanVariantSync(searchTerm);
  if (catalanV) variants.push(norm(catalanV));

  let bestScore = 0;

  for (const sv of variants) {
    // 1. Product name STARTS with the search phrase (word boundary)
    const startRegex = new RegExp(`^${esc(sv)}(\\s|$)`, 'i');
    if (startRegex.test(name)) {
      bestScore = Math.max(bestScore, 95);
      continue;
    }

    // 2. Full phrase appears as a whole-word match in the product name
    const phraseRegex = new RegExp(`(^|\\s)${esc(sv)}(\\s|$)`, 'i');
    if (phraseRegex.test(name)) {
      const idx = name.indexOf(sv);
      // Count words BEFORE the phrase — more words before = less likely primary product
      const textBefore = name.substring(0, idx).trim();
      const wordsBefore = textBefore ? textBefore.split(/\s+/).length : 0;
      // 0 words before: 90, 1: 75, 2: 55, 3: 40, 4+: 25
      const score = Math.max(90 - wordsBefore * 18, 20);
      bestScore = Math.max(bestScore, score);
      continue;
    }

    // 3. Word-by-word matching with position awareness
    const searchWords = sv.split(/[\s']+/).filter(w => w.length > 0);
    const nameWords = name.split(/[\s']+/).filter(w => w.length > 0);

    let matchedWords = 0;
    let positionSum = 0;

    for (const sw of searchWords) {
      let foundIdx = -1;
      if (sw.length <= 3) {
        // Short words: require EXACT word match ("pa" ≠ "pasta", "vi" ≠ "virgen")
        foundIdx = nameWords.findIndex(nw => nw === sw);
      } else {
        // Longer words: prefix matching with min 4 char overlap
        foundIdx = nameWords.findIndex(nw => {
          if (nw === sw) return true;
          if (nw.startsWith(sw)) return true;
          if (sw.startsWith(nw) && nw.length >= 4) return true;
          return false;
        });
      }

      if (foundIdx >= 0) {
        matchedWords++;
        positionSum += 1 - (foundIdx / Math.max(nameWords.length, 1));
      }
    }

    if (searchWords.length > 0 && matchedWords > 0) {
      const ratio = matchedWords / searchWords.length;
      if (ratio < 0.5) continue; // Need at least half of words

      const avgPos = positionSum / matchedWords;
      let score = ratio * 35 + avgPos * 25; // Max: 35+25=60

      // Heavy penalty if words appear very late (ingredient, not product)
      if (avgPos < 0.25) score *= 0.4;

      bestScore = Math.max(bestScore, Math.round(score));
    }
  }

  return bestScore;
}

/**
 * Troba el millor producte d'una llista de resultats per a un nom de cerca donat.
 * Llindar mínim de 40 per evitar falsos positius (tonyina per oli, tequeños per pa).
 */
function findBestMatch(itemName: string, products: ScrapedPrice[]): ScrapedPrice | null {
  if (products.length === 0) return null;

  const scored = products
    .filter(product => product.available && product.price > 0)
    .map(p => ({ product: p, score: matchScore(itemName, p.name) }))
    .filter(s => s.score >= 40)
    .sort((a, b) => {
      // First by score (relevance)
      if (b.score !== a.score) return b.score - a.score;
      // When tied, prefer simpler products (shorter names = the basic product)
      const lenDiff = a.product.name.length - b.product.name.length;
      if (Math.abs(lenDiff) > 8) return lenDiff;
      // Then cheapest
      return a.product.price - b.product.price;
    });

  return scored[0]?.product || null;
}

// Optimitzar ruta de compra (SCRAPING EN VIU — imatges i preus reals)
router.post('/', async (req, res) => {
  try {
    const parsedRequest = optimizeRequestSchema.parse(req.body);
    const { calculatePurchaseLine, summarizeBasket, calculateDistance, getInternalProduct, normalizePurchaseAmount } = await import('@bossing/shared');
    if (parsedRequest.items.some(item => item.catalogProductId && !getInternalProduct(item.catalogProductId))) {
      res.status(400).json({ error: 'Unknown internal catalog product' });
      return;
    }
    if (parsedRequest.items.some(item => {
      const internal = item.catalogProductId ? getInternalProduct(item.catalogProductId) : undefined;
      if (!internal || item.quantityMode === 'packages') return false;
      const amount = normalizePurchaseAmount(item.quantity, item.unit || internal.unit);
      return !amount || amount.unit !== internal.unit || internal.unit === 'u' && !Number.isInteger(amount.quantity);
    })) {
      res.status(400).json({ error: 'Incompatible product quantity or unit' });
      return;
    }
    const request = { ...parsedRequest, items: parsedRequest.items.map(item => {
      const internal = item.catalogProductId ? getInternalProduct(item.catalogProductId) : undefined;
      if (internal) {
        const amount = item.quantityMode === 'packages' ? { quantity: item.quantity, unit: internal.unit }
          : normalizePurchaseAmount(item.quantity, item.unit || internal.unit)!;
        return { ...item, ...amount, name: internal.name, matchMode: 'generic' as const, productId: undefined };
      }
      return item.matchMode === 'generic'
        ? { ...item, name: item.productId ? genericProductQuery(item.name) : item.name, productId: undefined } : item;
    }) };
    const startTime = Date.now();
    const chainId = (name: string) => {
      const id = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
      return id === 'ametller-origen' ? 'ametller' : id === 'la-sirena' ? 'lasirena' : id;
    };
    const selectedChainIds = request.stores ? [...new Set(request.stores.map(store => store.chain))]
      : request.supermarketIds?.map(chainId);
    const activeScrapers = ACTIVE_SCRAPERS.filter(({ name }) =>
      !selectedChainIds || selectedChainIds.includes(chainId(name)),
    );
    if (!activeScrapers.length || selectedChainIds?.some(id =>
      !activeScrapers.some(({ name }) => chainId(name) === id),
    )) {
      res.status(400).json({ error: 'Unknown supermarket' });
      return;
    }
    if (request.stores && (new Set(request.stores.map(store => store.id)).size !== request.stores.length ||
      request.stores.some(store => calculateDistance(request.location, store) > request.maxRadius))) {
      res.status(400).json({ error: 'Selected stores must be unique and inside the search radius' });
      return;
    }
    
    console.log(`[Optimize] Comparació en viu: ${request.items.length} ítems × ${ACTIVE_SCRAPERS.length} supermercats...`);
    
    // 1. Obtenir termes de cerca únics
    const uniqueTerms = [...new Set(request.items.map(i => i.name.toLowerCase().trim()))];
    
    // 1.5. Pre-traduir TOTS els termes en batch (1 sola crida a Groq)
    const genericTerms = [...new Set(request.items.filter(item => !item.productId).map(item => item.name.toLowerCase().trim()))];
    const translationsMap = genericTerms.length ? await batchTranslateToSpanish(genericTerms) : new Map<string, string>();
    console.log(`[Optimize] Traduccions: ${[...translationsMap.entries()].filter(([,v]) => v).map(([k,v]) => `"${k}"→"${v}"`).join(', ') || '(cap)'}`);
    
    // 2. Per cada scraper, cercar tots els termes en paral·lel (amb CACHE)
    const scraperResultsMap = new Map<string, Map<string, ScrapedPrice[]>>();
    const sourceErrors = new Map<string, Set<string>>();
    
    await mapWithConcurrency(activeScrapers, 3, async ({ scraper, name, lang }) => {
      const resultsPerTerm = new Map<string, ScrapedPrice[]>();
      const failedTerms = new Set<string>();
      sourceErrors.set(name, failedTerms);
      const mercadona = name === 'Mercadona' ? new MercadonaScraper() : null;
      if (mercadona && request.postalCode) {
        try {
          await mercadona.setPostalCode(request.postalCode);
        } catch (error) {
          console.warn('[Optimize] Mercadona postal-code source failed:', error);
          uniqueTerms.forEach(term => failedTerms.add(term));
          scraperResultsMap.set(name, resultsPerTerm);
          return;
        }
      }

      for (const term of uniqueTerms) {
        const termItems = request.items.filter(item => item.name.toLowerCase().trim() === term);
        const catalog = getLocalCatalogReferences(chainId(name));
        if (catalog.length && termItems.every(item => catalog.some(reference => reference.productId === item.productId))) {
          const candidates = termItems.every(item => item.productId)
            ? catalog.filter(reference => termItems.some(item => item.productId === reference.productId))
            : catalog.filter(reference => compatibleProduct(term, reference.name));
          try {
            const quotes: ScrapedPrice[] = [];
            const reader = name === 'Condis' ? condisScraper : name === 'Sorli' ? sorliScraper : bonareaScraper;
            for (const reference of candidates) {
              quotes.push(await reader.getProductPrice(reference.productId, reference.sourceUrl));
            }
            resultsPerTerm.set(term, quotes);
          } catch (error) {
            failedTerms.add(term);
            console.warn(`[Optimize] ${name} official detail failed:`, error instanceof Error ? error.message : error);
          }
          continue;
        }
        if (mercadona && termItems.every(item => item.productId)) {
          const ids = [...new Set(termItems.map(item => item.productId!))];
          if (mercadona && ids.every(id => /^merc-\d+(?:\.\d+)?$/.test(id))) {
            try {
              const quotes = await Promise.all(ids.map(id => mercadona.getProductPrice(id)));
              resultsPerTerm.set(term, quotes);
            } catch (error) {
              failedTerms.add(term);
              console.warn('[Optimize] Mercadona product source failed:', error);
            }
          }
          continue;
        }
        // Traduir el terme si el supermercat és castellà (usant la pre-traducció)
        const discoveryTerm = termItems.every(item => item.productId) ? genericProductQuery(term) : term;
        const actualSearchTerm = productSearchQuery(lang === 'es' ? translationsMap.get(discoveryTerm) || discoveryTerm : discoveryTerm, lang);
        const cacheKey = `opt:v5:${name}:${request.postalCode || 'unverified-zone'}:${actualSearchTerm}`;

        // Check cache first
        if (!mercadona && fileCache.isValid(cacheKey, OPTIMIZE_CACHE_TTL)) {
          const cached = fileCache.get<ScrapedPrice[]>(cacheKey);
          if (cached) {
            resultsPerTerm.set(term, cached.data);
            continue;
          }
        }

        try {
          const discoveryReader = name === 'bon\u00c0rea' ? bonareaScraper : name === 'Condis' ? condisScraper
            : name === 'Sorli' ? sorliScraper : name === 'Veritas' ? veritasScraper : null;
          const results = discoveryReader
            ? await discoveryReader.searchProducts(actualSearchTerm, productName => compatibleProduct(term, productName))
            : await (mercadona || scraper).searchProducts(actualSearchTerm);
          resultsPerTerm.set(term, results);
          // Cache the results
          if (!mercadona) fileCache.set(cacheKey, results);
          if (actualSearchTerm !== term) {
            console.log(`[Optimize] ${name}: "${term}" → cerca "${actualSearchTerm}" (${results.length} resultats)`);
          }
        } catch (e) {
          console.warn(`[Optimize] ${name} ha fallat per "${actualSearchTerm}":`, e instanceof Error ? e.message : e);
          resultsPerTerm.set(term, e && typeof e === 'object' && 'partialResults' in e && Array.isArray(e.partialResults) ? e.partialResults : []);
          failedTerms.add(term);
        }
      }

      scraperResultsMap.set(name, resultsPerTerm);
      return undefined;
    });
    
    console.log(`[Optimize] Cerques completades en ${Date.now() - startTime}ms`);
    
    // 3. Construir comparació per supermercat
    const chainRoutes = activeScrapers.map(({ name: supermarketName }) => {
      const scraperResults = scraperResultsMap.get(supermarketName);
      const lines: PurchaseLine[] = [];
      const itemsList: any[] = [];
      
      for (const reqItem of request.items) {
        const searchTerm = reqItem.name.toLowerCase().trim();
        const productsForTerm = scraperResults?.get(searchTerm) || [];
        const purchaseRequest = (product?: ScrapedPrice) => reqItem.quantityMode === 'packages' && product?.packageSize
          ? { ...reqItem, quantity: reqItem.quantity * product.packageSize.amount, unit: product.packageSize.unit }
          : reqItem;
        const compatible = productsForTerm.filter(product => reqItem.productId
          ? product.productId === reqItem.productId : compatibleProduct(reqItem.name, product.name));
        const eligible = compatible.filter(product => calculatePurchaseLine(purchaseRequest(product), product).found);
        const match = reqItem.productId ? eligible[0] : cheapestCompatibleProduct(reqItem.name, eligible);
        const purchase = calculatePurchaseLine(purchaseRequest(match), match);
        const alternatives = eligible.map(product => {
          const line = calculatePurchaseLine(purchaseRequest(product), product);
          return { productId: product.productId, name: product.name, price: product.price,
            pricePerUnit: product.price / product.packageSize!.amount, unit: product.packageSize!.unit,
            packageSize: product.packageSize, quantity: line.found ? line.packageCount : 0,
            lineTotal: line.found ? line.lineTotal : 0, purchasedQuantity: line.found
              ? reqItem.quantityMode === 'packages' ? line.packageCount : line.purchasedQuantity : 0,
            source: product.source, scrapedAt: product.scrapedAt };
        }).sort((first, second) => first.pricePerUnit - second.pricePerUnit || first.price - second.price);
        lines.push(purchase);
        
        if (match && purchase.found) {
          
          itemsList.push({
            name: match.name,
            price: match.price,
            productId: match.productId,
            quantity: purchase.packageCount,
            requestedQuantity: reqItem.quantity,
            requestedUnit: reqItem.quantityMode === 'packages' ? 'envasos' : reqItem.unit,
            purchasedQuantity: reqItem.quantityMode === 'packages' ? purchase.packageCount : purchase.purchasedQuantity,
            packageSize: match.packageSize,
            source: match.source,
            alternatives,
            candidateCount: productsForTerm.length,
            compatibleCount: alternatives.length,
            scrapedAt: match.scrapedAt,
            lineTotal: purchase.lineTotal,
            image: match.imageUrl || null,
            pricePerUnit: match.pricePerUnit || match.price,
            unit: match.unit || 'ud',
            found: true,
          });
        } else {
          itemsList.push({
            name: reqItem.name + ' (No disponible)',
            price: 0,
            quantity: reqItem.quantity,
            lineTotal: 0,
            found: false,
            reason: sourceErrors.get(supermarketName)?.has(searchTerm) ? 'source_error'
              : compatible.length ? 'format' : reqItem.productId ? 'identity' : 'missing',
            candidateCount: productsForTerm.length,
            compatibleCount: 0,
          });
        }
      }
      
      const summary = summarizeBasket(lines, supermarketName === 'Mercadona' && !!request.postalCode &&
        request.items.every(item => !!item.productId) && !sourceErrors.get(supermarketName)?.size);
      return {
        ...summary,
        status: sourceErrors.get(supermarketName)?.size ? 'source_error'
          : summary.comparable ? 'verified' : summary.complete ? 'unverified' : 'incomplete',
        totalDistance: 0,
        estimatedSavings: 0,
        stops: [{
          supermarket: {
            id: supermarketName.toLowerCase().replace(/\s+/g, '-'),
            name: supermarketName,
            address: '',
            lat: request.location.lat,
            lng: request.location.lng,
          },
          items: itemsList,
          subtotal: summary.subtotal,
          distanceFromPrevious: 0,
        }],
      };
    });
    
    const routes = request.stores ? request.stores.map(store => {
      const route = chainRoutes.find(candidate => chainId(candidate.stops[0].supermarket.name) === store.chain)!;
      const distance = calculateDistance(request.location, store);
      return {
        ...route, totalDistance: distance, pricingScope: 'online-catalog',
        stops: [{ ...route.stops[0], supermarket: { ...store, placeId: store.id }, distanceFromPrevious: distance }],
      };
    }) : chainRoutes.map(route => ({ ...route, pricingScope: 'online-catalog' }));

    // Ordenar: amb resultats primer, després per preu
    routes.sort((a, b) => {
      if (a.comparable !== b.comparable) return a.comparable ? -1 : 1;
      if (a.comparable && b.comparable) return a.totalCost! - b.totalCost!;
      return b.foundCount - a.foundCount;
    });
    
    // Calcular estalvis
    const bestPrice = routes.find(r => r.comparable)?.totalCost || 0;
    routes.forEach(r => {
      if (r.comparable && r.totalCost !== null && bestPrice > 0) {
        r.estimatedSavings = parseFloat((r.totalCost - bestPrice).toFixed(2));
      }
    });
    
    // Retornar només supermercats amb resultats
    const validRoutes = routes;
    const elapsed = Date.now() - startTime;
    
    console.log(`[Optimize] Completat: ${validRoutes.length} supermercats amb resultats (${elapsed}ms)`);
    
    res.json({
      request: {
        itemCount: request.items.length,
        maxRadius: request.maxRadius,
        prioritize: request.prioritize,
      },
      routes: validRoutes,
      meta: {
        historyStatus: 'scheduled',
        scraperCount: activeScrapers.length,
        duration: elapsed,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid basket request', details: error.flatten() });
      return;
    }
    console.error('Error optimizing route:', error);
    res.status(500).json({ error: 'Error calculating optimal route' });
  }
});

// Previsualitzar estalvis
router.post('/preview', async (req, res) => {
  try {
    const request = optimizeRequestSchema.parse(req.body);
    
    res.json({
      itemCount: request.items.length,
      nearbyStoresCount: ACTIVE_SCRAPERS.length,
    });
  } catch (error) {
    res.status(400).json({ error: 'Dades invàlides' });
  }
});

export { router as optimizeRouter };
