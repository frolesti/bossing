import axios from 'axios';
import { BaseScraper, type ScraperConfig } from '../base.js';
import type { ScrapedPrice } from '@bossing/shared';

const config: ScraperConfig = {
  name: 'Ametller Origen',
  baseUrl: 'https://www.ametllerorigen.com',
  rateLimit: 5,
  enabled: true,
};

interface AmetllerProduct {
  id: string;
  name: string;
  price: number;
  listPrice: number;
  images: string[];
  url: string;
  unitInfo?: string; // "*Unitat 1l"
}

interface AmetllerResponse {
  catalog: {
    content: AmetllerProduct[];
  };
}

export class AmetllerScraper extends BaseScraper {
  constructor() {
    super(config);
  }

  async searchProducts(query: string): Promise<ScrapedPrice[]> {
    console.log(`[Ametller] Searching for: ${query}...`);
    try {
      const response = await axios.get<AmetllerResponse>(
        'https://api.empathy.co/search/v1/query/ametller/search',
        {
          params: {
            query,
            lang: 'ca',
            start: 0,
            rows: 50,
            origin: 'default',
          },
        }
      );

      const items = response.data.catalog.content || [];
      
      return items.map((item) => {
        // Parse unit from "unitInfo": "*Unitat 1l" or "*Unitat 200ml"
        let unit = 'ud';
        let amount = 1;
        if (item.unitInfo) {
            const lower = item.unitInfo.toLowerCase();
            if (lower.includes('kg')) unit = 'kg';
            else if (lower.includes('l') && !lower.includes('ml')) unit = 'l';
            else if (lower.includes('g') || lower.includes('ml')) unit = 'ud'; // Treat small units as units for now or convert
        }

        return {
            productId: `ametller-${item.id}`,
            name: item.name,
            supermarket: 'Ametller Origen',
            supermarketId: 'ametller',
            price: item.price,
            originalPrice: item.listPrice || item.price,
            unit: unit,
            pricePerUnit: item.price, // API doesn't give PPU directly easily, assuming price for now
            category: 'Search',
            imageUrl: item.images?.[0] || '',
            available: true,
            scrapedAt: new Date(),
        };
      });

    } catch (error) {
      console.error('[Ametller] Error:', error);
      return [];
    }
  }

  async getCategories() { return []; }
  async getCategoryProducts() { return []; }
  async scrapeProducts() { return []; }
  async scrapeProductDetails() { return null; }
}

export const ametllerScraper = new AmetllerScraper();
