import puppeteer from 'puppeteer';
import { BaseScraper, type ScraperConfig } from '../base.js';
import type { Product, ScrapedPrice } from '@bossing/shared';

const config: ScraperConfig = {
  name: 'DIA',
  baseUrl: 'https://www.dia.es',
  rateLimit: 5,
  enabled: true,
};

export class DIAScraper extends BaseScraper {
  constructor() {
    super(config);
  }

  private async parsePrice(priceStr: string | null | undefined): Promise<number> {
    if (!priceStr) return 0;
    // "1.234,56 €" -> 1.23456 -> 1234.56.
    // Standard format is 1,23 € or 1.234,56 €
    // Remove symbols and trim
    const clean = priceStr.replace(/[^\d,\.]/g, '').trim();
    // Replace comma with dot if it's the decimal separator
    // If we have thousands like 1.000,00 -> we need to handle it.
    // Simple heuristic for Spain price format: comma is decimal.
    const normalized = clean.replace(/\./g, '').replace(',', '.');
    return parseFloat(normalized) || 0;
  }

  async searchProducts(query: string): Promise<ScrapedPrice[]> {
    console.log(`[DIA] Searching for: ${query} using Puppeteer...`);
    let browser;
    try {
      // Launch Puppeteer.
      // NOTE: In production/docker this might need args like --no-sandbox
      browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080 });
      // Use a common user agent
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      const url = `${config.baseUrl}/search?q=${encodeURIComponent(query)}`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });

      // Wait for product cards valid selector
      try {
         await page.waitForSelector('div[data-test-id="product-card"]', { timeout: 15000 });
      } catch (e) {
         console.warn(`[DIA] Timeout waiting for products for query "${query}"`);
         return [];
      }

      // Extract data
      const productsData = await page.evaluate(() => {
        const items: any[] = [];
        const cards = document.querySelectorAll('div[data-test-id="product-card"]');
        
        cards.forEach(card => {
            // Selectors based on inspection
            const nameEl = card.querySelector('[data-test-id="search-product-card-name"], .search-product-card__product-name');
            const priceEl = card.querySelector('[data-test-id="search-product-card-unit-price"], .search-product-card__active-price');
            const unitPriceEl = card.querySelector('[data-test-id="search-product-card-kilo-price"], .search-product-card__price-per-unit');
            const imgEl = card.querySelector('img[data-test-id="search-product-card-image"], .search-product-card__product-image');
            const linkEl = card.querySelector('a[data-test-id="search-product-card-name"], a.search-product-card__product-link');
            
            if (nameEl && priceEl) {
                items.push({
                    name: nameEl.textContent?.trim(),
                    priceText: priceEl.textContent?.trim(),
                    unitPriceText: unitPriceEl?.textContent?.trim(),
                    imageUrl: imgEl?.getAttribute('src'),
                    link: linkEl?.getAttribute('href'),
                    id: card.getAttribute('object_id') || linkEl?.getAttribute('href')?.split('/').pop()
                });
            }
        });
        return items;
      });

      const results: ScrapedPrice[] = [];
      for (const p of productsData) {
        const price = await this.parsePrice(p.priceText);
        // Unit price usually format "(3,33 €/KILO)" or "(0,33 €/U)"
        const pricePerUnit = await this.parsePrice(p.unitPriceText);
        
        // Extract unit string e.g. "KILO", "LITRO", "U"
        let unit = 'ud';
        if (p.unitPriceText && p.unitPriceText.includes('/')) {
            const parts = p.unitPriceText.split('/');
            if (parts.length > 1) {
                unit = parts[1].replace(')', '').trim().toLowerCase();
            }
        }

        results.push({
          productId: `dia-${p.id}`,
          name: p.name,
          supermarket: 'DIA',
          supermarketId: 'dia',
          price: price,
          originalPrice: price,
          unit: unit,
          pricePerUnit: pricePerUnit,
          category: 'Search',
          imageUrl: p.imageUrl ? (p.imageUrl.startsWith('http') ? p.imageUrl : `${config.baseUrl}${p.imageUrl}`) : '',
          available: true,
          scrapedAt: new Date(),
        });
      }

      console.log(`[DIA] Found ${results.length} products`);
      return results;

    } catch (error) {
      console.error('[DIA] Error details:', error);
      return [];
    } finally {
      if (browser) await browser.close();
    }
  }

  // Not implemented fully yet
  async getCategories() { return []; }
  async getCategoryProducts() { return []; }
  async scrapeProducts(category?: string) { return []; }
  async scrapeProductDetails(productId: string) { return null; }
}

export const diaScraper = new DIAScraper();
export default DIAScraper;
