import puppeteer from 'puppeteer';
import { BaseScraper, type ScraperConfig } from '../base.js';
import type { ScrapedPrice } from '@bossing/shared';

const config: ScraperConfig = {
  name: 'Bonpreu',
  baseUrl: 'https://www.compraonline.bonpreuesclat.cat',
  rateLimit: 5,
  enabled: true,
};

export class BonpreuScraper extends BaseScraper {
  constructor() {
    super(config);
  }

  async searchProducts(query: string): Promise<ScrapedPrice[]> {
    console.log(`[Bonpreu] Searching for: ${query}...`);
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: "new",
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox', 
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--window-size=1920,1080'
        ]
      });

      const page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      const gatheredProducts: ScrapedPrice[] = [];

      // Intercept API response
      page.on('response', async (response) => {
        const url = response.url();
        // Match the API endpoint seen in debug: api/webproductpagews/v1/search/products or similar variants
        // Adjusting regex to be flexible based on debug output "api/webproductpagews/v6/products"
        if (url.includes('api/webproductpagews') && url.includes('products') && response.request().method() !== 'OPTIONS') {
          try {
            const contentType = response.headers()['content-type'];
            if (!contentType || !contentType.includes('application/json')) return;

            const json = await response.json();
            
            // Expected structure: { data: { products: [...] } } or just { products: [...] }
            let items = json.data?.products || json.products || [];
            
            items.forEach((p: any) => {
                const priceVal = p.price?.amount || 0;
                
                gatheredProducts.push({
                    productId: `bonpreu-${p.id}`,
                    name: p.name || p.displayName,
                    supermarket: 'Bonpreu',
                    supermarketId: 'bonpreu',
                    price: priceVal,
                    originalPrice: priceVal,
                    // Try to guess unit
                    unit: p.price?.perUnit ? 'unit' : 'ud', 
                    pricePerUnit: p.price?.perUnit || priceVal,
                    category: 'Search',
                    // Image might be in images[] array
                    imageUrl: p.image?.url || (p.images && p.images[0]?.url) || '',
                    available: !p.outOfStock,
                    scrapedAt: new Date()
                });
            });
          } catch (err) {
            // Ignore parse errors
          }
        }
      });

      const searchUrl = `${config.baseUrl}/products/search?q=${encodeURIComponent(query)}`;
      // Change to domcontentloaded for speed (don't wait for analytics/chat)
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      // Wait a bit for the API to fire and respond
      await new Promise(resolve => setTimeout(resolve, 5000));

      console.log(`[Bonpreu] Found ${gatheredProducts.length} products`);
      return gatheredProducts;

    } catch (error) {
      console.error('[Bonpreu] Error:', error);
      return [];
    } finally {
      if (browser) await browser.close();
    }
  }

  // Stubs
  async getCategories() { return []; }
  async getCategoryProducts() { return []; }
  async scrapeProducts() { return []; }
  async scrapeProductDetails() { return null; }
}

export const bonpreuScraper = new BonpreuScraper();
