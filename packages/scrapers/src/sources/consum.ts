import axios from 'axios';
import { BaseScraper, type ScraperConfig } from '../base.js';
import type { Product, ScrapedPrice } from '@bossing/shared';

const config: ScraperConfig = {
  name: 'Consum',
  baseUrl: 'https://tienda.consum.es',
  rateLimit: 2, // 2 requests per second
  enabled: true,
};

interface ConsumProduct {
  id: number;
  code: string;
  ean: string;
  productData: {
    name: string;
    brand: {
      id: string;
      name: string;
    };
    url: string;
    imageURL: string;
    description: string;
  };
  priceData: {
    prices: Array<{
      id: string; // 'PRICE' or 'OFFER_PRICE'
      value: {
        centAmount: number;
        centUnitAmount: number;
      };
    }>;
    unitPriceUnitType: string; // '1 Kg', '1 L', etc.
  };
  categories: Array<{
    id: number;
    name: string;
  }>;
  offers: Array<{
    id: number;
    shortDescription: string;
    amount: number;
  }>;
}

interface ConsumProductsResponse {
  totalCount: number;
  hasMore: boolean;
  products: ConsumProduct[];
}

/**
 * Scraper per a Consum
 * Utilitza l'API pública de tienda.consum.es
 */
export class ConsumScraper extends BaseScraper {
  private readonly apiUrl = 'https://tienda.consum.es/api/rest/V1.0';
  private lastRequestTime = 0;

  constructor() {
    super(config);
  }

  /**
   * Wait for rate limit
   */
  private async waitForRateLimit(): Promise<void> {
    const minInterval = 1000 / this.config.rateLimit;
    const elapsed = Date.now() - this.lastRequestTime;
    if (elapsed < minInterval) {
      await new Promise(resolve => setTimeout(resolve, minInterval - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  /**
   * Obté productes amb paginació
   */
  private async getProducts(offset: number = 0, limit: number = 100): Promise<ConsumProduct[]> {
    try {
      const response = await axios.get<ConsumProductsResponse>(
        `${this.apiUrl}/catalog/product`,
        {
          params: {
            offset,
            limit,
          },
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        }
      );
      return response.data.products;
    } catch (error) {
      console.error('[Consum] Error obtenint productes:', error);
      return [];
    }
  }

  /**
   * Obté el nombre total de productes
   */
  private async getTotalCount(): Promise<number> {
    try {
      const response = await axios.get<ConsumProductsResponse>(
        `${this.apiUrl}/catalog/product`,
        {
          params: { offset: 0, limit: 1 },
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        }
      );
      return response.data.totalCount;
    } catch (error) {
      console.error('[Consum] Error obtenint total:', error);
      return 0;
    }
  }

  /**
   * Normalitza un nom de producte
   */
  private normalizeProductName(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Converteix un producte de Consum al format ScrapedPrice
   */
  private normalizeProduct(product: ConsumProduct): ScrapedPrice {
    // Obtenir el preu normal i el preu d'oferta si existeix
    const normalPriceData = product.priceData.prices.find(p => p.id === 'PRICE');
    const offerPriceData = product.priceData.prices.find(p => p.id === 'OFFER_PRICE');
    
    const price = offerPriceData?.value.centAmount ?? normalPriceData?.value.centAmount ?? 0;
    const originalPrice = offerPriceData ? normalPriceData?.value.centAmount : undefined;
    const pricePerUnit = offerPriceData?.value.centUnitAmount ?? normalPriceData?.value.centUnitAmount ?? price;

    // Extreure la unitat del format "1 Kg", "1 L", etc.
    const unitMatch = product.priceData.unitPriceUnitType?.match(/(\d+)\s*(\w+)/);
    const unit = unitMatch ? unitMatch[2].toLowerCase() : 'unitat';

    const category = product.categories[0]?.name || 'Sense categoria';

    return {
      productId: `consum-${product.id}`,
      name: product.productData.name,
      supermarket: 'Consum',
      supermarketId: 'consum',
      price,
      originalPrice,
      unit,
      pricePerUnit,
      category,
      imageUrl: product.productData.imageURL,
      available: true,
      scrapedAt: new Date(),
    };
  }

  /**
   * Scrape productes de Consum
   */
  async scrapeProducts(_category?: string): Promise<ScrapedPrice[]> {
    console.log('[Consum] Iniciant scraping...');
    
    const products: ScrapedPrice[] = [];
    const batchSize = 100;
    let offset = 0;
    const maxProducts = 500; // Limitem a 500 per ara per no saturar

    // Obtenir el total de productes
    const totalCount = await this.getTotalCount();
    console.log(`[Consum] Total productes disponibles: ${totalCount}`);

    const targetCount = Math.min(maxProducts, totalCount);

    while (offset < targetCount) {
      await this.waitForRateLimit();

      const limit = Math.min(batchSize, targetCount - offset);
      const batch = await this.getProducts(offset, limit);

      if (batch.length === 0) {
        break;
      }

      for (const product of batch) {
        try {
          products.push(this.normalizeProduct(product));
        } catch (error) {
          console.error(`[Consum] Error normalitzant producte ${product.id}:`, error);
        }
      }

      offset += batch.length;
      console.log(`[Consum] Processats ${offset}/${targetCount} productes`);
    }

    console.log(`[Consum] Scraping completat: ${products.length} productes`);
    return products;
  }

  /**
   * Obté detalls d'un producte específic
   */
  async scrapeProductDetails(productId: string): Promise<Product | null> {
    const id = productId.replace('consum-', '');
    
    try {
      const response = await axios.get<ConsumProduct>(
        `${this.apiUrl}/catalog/product/${id}`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        }
      );

      const product = response.data;
      const unitMatch = product.priceData.unitPriceUnitType?.match(/(\d+)\s*(\w+)/);
      const unit = unitMatch ? unitMatch[2].toLowerCase() : 'unitat';

      return {
        id: `consum-${product.id}`,
        name: product.productData.name,
        normalizedName: this.normalizeProductName(product.productData.name),
        brand: product.productData.brand.name || undefined,
        category: product.categories[0]?.name || 'Sense categoria',
        description: product.productData.description,
        imageUrl: product.productData.imageURL,
        barcode: product.ean || undefined,
        unit,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (error) {
      console.error(`[Consum] Error obtenint producte ${productId}:`, error);
      return null;
    }
  }

  /**
   * Cerca productes per nom
   */
  async searchProducts(query: string): Promise<ScrapedPrice[]> {
    console.log(`[Consum] Cercant: ${query}...`);
    
    try {
      const response = await axios.get<ConsumProductsResponse>(
        `${this.apiUrl}/catalog/product`,
        {
          params: {
            q: query,
            limit: 50,
          },
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        }
      );

      return response.data.products.map(p => this.normalizeProduct(p));
    } catch (error) {
      console.error('[Consum] Error cercant productes:', error);
      return [];
    }
  }
}

export const consumScraper = new ConsumScraper();
export default ConsumScraper;
