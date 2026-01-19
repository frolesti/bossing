import { BaseScraper, type ScraperConfig } from '../base.js';
import type { Product, ScrapedPrice } from '@bossing/shared';
import puppeteer from 'puppeteer';

const config: ScraperConfig = {
  name: 'Caprabo',
  baseUrl: 'https://www.capraboacasa.com',
  rateLimit: 1, // Limited by browser speed
  enabled: true,
};

export class CapraboScraper extends BaseScraper {
  constructor() {
    super(config);
  }

  async scrapeProducts(category?: string): Promise<ScrapedPrice[]> {
    return []; // Not implemented for category browsing yet
  }

  async scrapeProductDetails(productId: string): Promise<Product | null> {
    return null; // Not implemented
  }

  async searchProducts(query: string): Promise<ScrapedPrice[]> {
    console.log(`[Caprabo] Cercant: ${query}...`);
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      const url = `${this.config.baseUrl}/ca/search/results/?q=${encodeURIComponent(query)}`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

      // Extract products from data-metrics attributes on title links
      const items: any[] = await page.evaluate(() => {
        const results: any[] = [];
        const links = document.querySelectorAll('.product-title-link, .product-image-link');
        
        links.forEach(link => {
          const metrics = link.getAttribute('data-metrics');
          if (metrics) {
            try {
              const data = JSON.parse(metrics);
              // data.ecommerce.items is an array
              if (data.ecommerce && data.ecommerce.items && data.ecommerce.items.length > 0) {
                const item = data.ecommerce.items[0];
                const product = {
                  name: item.item_name,
                  price: item.price,
                  id: item.item_id,
                  brand: item.item_brand,
                  category: item.item_category,
                  image: '' // We need to find the image
                };
                results.push(product);
              }
            } catch (e) {
              // ignore
            }
          }
        });
        return results;
      });

      // Deduplicate results by ID
      const uniqueItems = Array.from(new Map(items.map(item => [item.id, item])).values());
      
      return uniqueItems.map(item => {
        const imageUrl = `https://www.capraboacasa.com/images/${item.id}.jpg`;
        const name = item.name as string;
        
        // Infer unit
        let unit = 'unitat';
        let pricePerUnit = item.price;
        const lowerName = name.toLowerCase();
        
        if (lowerName.includes('kg') || lowerName.includes('kilo')) unit = 'kg';
        else if (lowerName.includes('brik 1 l') || lowerName.includes('1 litre') || lowerName.includes('1l')) unit = 'l';
        else if (lowerName.includes('ml')) unit = 'ml';
        else if (lowerName.includes('g') && !lowerName.includes('mg')) unit = 'g';
        
        return {
          productId: `caprabo-${item.id}`,
          name: name,
          price: item.price,
          originalPrice: undefined,
          supermarket: 'Caprabo',
          supermarketId: 'caprabo',
          unit,
          pricePerUnit, // Can't easily calculate without parsing "250g" etc. accurately. Just set as price for now or same logic as Consum.
          category: item.category || 'Alimentació',
          subcategory: undefined,
          imageUrl: imageUrl,
          available: true,
          scrapedAt: new Date(),
        } as ScrapedPrice;
      });

    } catch (error) {
      console.error('[Caprabo] Error searching:', error);
      return [];
    } finally {
      if (browser) await browser.close();
    }
  }
}

export const capraboScraper = new CapraboScraper();
export default CapraboScraper;
