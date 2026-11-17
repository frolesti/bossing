import puppeteer from 'puppeteer';
import { BaseScraper, type ScraperConfig } from '../base.js';
import type { Product, ScrapedPrice } from '@bossing/shared';

const config: ScraperConfig = {
  name: 'Lidl',
  baseUrl: 'https://www.lidl.es',
  rateLimit: 1,
  enabled: true,
};

/**
 * Scraper per a Lidl
 * 
 * NOTA: Lidl Espanya NO ven productes d'alimentació online.
 * La seva botiga online (lidl.es) només ven productes no alimentaris
 * (eines, electrònica, decoració, etc.). Els productes de supermercat
 * només es venen a les botigues físiques.
 * 
 * El scraper utilitza Puppeteer per cercar a la botiga online,
 * però els resultats seran limitats a productes no alimentaris.
 */
export class LidlScraper extends BaseScraper {
  constructor() {
    super(config);
  }

  private parsePrice(priceStr: string | null | undefined): number {
    if (!priceStr) return 0;
    const clean = priceStr.replace(/[^\d,\.]/g, '').trim();
    // Format espanyol: 1.234,56 -> 1234.56
    const normalized = clean.replace(/\./g, '').replace(',', '.');
    return parseFloat(normalized) || 0;
  }

  async scrapeProducts(category?: string): Promise<ScrapedPrice[]> {
    console.log(`[Lidl] Scraping ${category || 'all'}...`);
    // Per a l'scraping complet, naveguem per categories
    return this.searchProducts(category || 'alimentación');
  }

  async scrapeProductDetails(productId: string): Promise<Product | null> {
    console.log(`[Lidl] Getting details for ${productId}...`);
    return null;
  }

  async searchProducts(query: string): Promise<ScrapedPrice[]> {
    console.log(`[Lidl] Cercant: ${query} amb Puppeteer...`);
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ]
      });

      const page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      const gatheredProducts: ScrapedPrice[] = [];

      // Interceptem respostes API de Lidl
      page.on('response', async (response) => {
        const url = response.url();
        if (
          (url.includes('/api/') && url.includes('product')) ||
          (url.includes('/api/') && url.includes('gridbox')) ||
          (url.includes('/api/') && url.includes('search'))
        ) {
          try {
            const contentType = response.headers()['content-type'];
            if (!contentType?.includes('application/json')) return;
            const json = await response.json();
            
            // L'estructura de Lidl pot variar. Busquem arrays de productes.
            const items = json.items || json.products || json.gridBoxes || [];
            
            for (const item of items) {
              // Cada item pot ser un gridbox amb producte embegut
              const p = item.product || item;
              if (!p.fullTitle && !p.title && !p.keyfacts?.title) continue;
              
              const name = p.fullTitle || p.title || p.keyfacts?.title || '';
              const price = p.price?.price || p.pricing?.currentRetailPrice || 0;
              const oldPrice = p.price?.oldPrice || p.pricing?.recommendedRetailPrice || undefined;
              const unitPrice = p.price?.basePrice || p.pricing?.basePrice || price;
              const image = p.image || p.heroImage || p.images?.[0] || '';
              const id = p.productId || p.id || p.code || '';
              
              gatheredProducts.push({
                productId: `lidl-${id}`,
                name,
                supermarket: 'Lidl',
                supermarketId: 'lidl',
                price,
                originalPrice: oldPrice,
                unit: p.price?.basePriceUnit || 'ud',
                pricePerUnit: unitPrice,
                category: p.category || 'Alimentación',
                imageUrl: typeof image === 'string' ? image : (image?.url || ''),
                available: true,
                scrapedAt: new Date(),
              });
            }
          } catch {
            // Ignorar errors de parsing
          }
        }
      });

      // Lidl Espanya: /q/{query} per cercar (NO /es/search)
      // Nota: Lidl no ven alimentació online - només productes no alimentaris
      const searchUrl = `${config.baseUrl}/q/${encodeURIComponent(query)}`;
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      // Esperar a que es carreguin els productes
      try {
        await page.waitForSelector('[class*="product"], [class*="Product"], [data-grid-box]', { timeout: 10000 });
      } catch {
        // Si no trobem selectors específics, esperem un temps
      }
      
      // Esperar les respostes API
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Si no s'han interceptat via API, intentem extreure del DOM
      if (gatheredProducts.length === 0) {
        const domProducts = await page.evaluate(() => {
          const results: any[] = [];
          
          // Buscar productes en JSON-LD
          const scripts = document.querySelectorAll('script[type="application/ld+json"]');
          scripts.forEach(script => {
            try {
              const data = JSON.parse(script.textContent || '');
              if (data['@type'] === 'Product' || data['@type'] === 'ItemList') {
                const items = data.itemListElement || [data];
                items.forEach((item: any) => {
                  const product = item.item || item;
                  if (product.name && product.offers) {
                    results.push({
                      name: product.name,
                      price: product.offers?.price || product.offers?.lowPrice,
                      image: product.image,
                      id: product.sku || product.productID || product.url,
                    });
                  }
                });
              }
            } catch { /* ignore */ }
          });

          // Fallback: buscar en el DOM directament
          if (results.length === 0) {
            const cards = document.querySelectorAll(
              '.s-grid__item, .product-grid-box, [class*="ProductCard"], [class*="product-card"]'
            );
            cards.forEach(card => {
              const nameEl = card.querySelector(
                '.product-grid-box__title, [class*="product-name"], [class*="ProductTitle"], h3, h2'
              );
              const priceEl = card.querySelector(
                '.m-price__price, [class*="product-price"], [class*="Price"]'
              );
              const imgEl = card.querySelector('img');
              
              if (nameEl && priceEl) {
                results.push({
                  name: nameEl.textContent?.trim(),
                  priceText: priceEl.textContent?.trim(),
                  image: imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src'),
                  id: card.getAttribute('data-id') || nameEl.textContent?.trim()?.substring(0, 20),
                });
              }
            });
          }
          
          return results;
        });

        for (const p of domProducts) {
          const price = p.price || this.parsePrice(p.priceText);
          gatheredProducts.push({
            productId: `lidl-${p.id || Math.random().toString(36).slice(2)}`,
            name: p.name || '',
            supermarket: 'Lidl',
            supermarketId: 'lidl',
            price: typeof price === 'number' ? price : this.parsePrice(String(price)),
            unit: 'ud',
            pricePerUnit: typeof price === 'number' ? price : this.parsePrice(String(price)),
            category: 'Alimentación',
            imageUrl: p.image || '',
            available: true,
            scrapedAt: new Date(),
          });
        }
      }

      console.log(`[Lidl] Trobats ${gatheredProducts.length} productes`);
      return gatheredProducts;

    } catch (error) {
      console.error('[Lidl] Error:', error);
      return [];
    } finally {
      if (browser) await browser.close();
    }
  }
}

export const lidlScraper = new LidlScraper();
