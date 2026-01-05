import axios from 'axios';
import { BaseScraper, type ScraperConfig } from '../base.js';
import type { Product, ScrapedPrice } from '@bossing/shared';

const config: ScraperConfig = {
  name: 'Carrefour',
  baseUrl: 'https://www.carrefour.es',
  rateLimit: 1, // Més conservador per evitar bloqueig
  enabled: true,
};

// Endpoint API descobert a GitHub
const CARREFOUR_API_BASE = 'https://www.carrefour.es/cloud-api';

interface CarrefourCategory {
  id: string;
  name: string;
  seoUrl: string;
  level: number;
  subcategories?: CarrefourCategory[];
}

interface CarrefourProduct {
  display_name: string;
  product_id: string;
  active_price: {
    price: number;
    unit_price: number;
    unit_measure: string;
    original_price?: number;
  };
  image_path: string;
  category_path?: string;
  ean?: string;
  brand?: string;
  in_stock: boolean;
}

interface CarrefourProductsResponse {
  products: CarrefourProduct[];
  total: number;
  offset: number;
}

/**
 * Scraper per a Carrefour
 * 
 * Carrefour té una API protegida que requereix cookies de sessió.
 * Utilitzem headers similars a un navegador per evitar bloqueig.
 */
export class CarrefourScraper extends BaseScraper {
  private lastRequestTime = 0;
  
  // Headers per simular navegador
  private readonly browserHeaders = {
    'Accept': 'application/json',
    'Accept-Language': 'es-ES,es;q=0.9,ca;q=0.8',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://www.carrefour.es/',
    'Origin': 'https://www.carrefour.es',
  };

  constructor() {
    super(config);
  }

  private async waitForRateLimit(): Promise<void> {
    const minInterval = 1000 / this.config.rateLimit;
    const elapsed = Date.now() - this.lastRequestTime;
    if (elapsed < minInterval) {
      await new Promise(resolve => setTimeout(resolve, minInterval - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  /**
   * Obtenir categories principals
   */
  async getCategories(): Promise<CarrefourCategory[]> {
    try {
      const response = await axios.get(
        `${CARREFOUR_API_BASE}/categories-api/v1/categories/menu/`,
        { headers: this.browserHeaders }
      );
      return response.data?.categories || [];
    } catch (error) {
      console.error('[Carrefour] Error obtenint categories:', error);
      return [];
    }
  }

  /**
   * Obtenir productes d'una categoria
   * Nota: Pot requerir cookies de sessió per funcionar
   */
  async getCategoryProducts(categoryPath: string, offset: number = 0): Promise<CarrefourProduct[]> {
    try {
      await this.waitForRateLimit();
      
      const response = await axios.get<CarrefourProductsResponse>(
        `${CARREFOUR_API_BASE}/plp-food-papi/v1${categoryPath}`,
        {
          params: { offset, limit: 24 },
          headers: this.browserHeaders,
        }
      );
      
      return response.data?.products || [];
    } catch (error: any) {
      // 403 significa que necessitem cookies/autenticació
      if (error.response?.status === 403) {
        console.warn('[Carrefour] API protegida - necessita autenticació');
      } else {
        console.error(`[Carrefour] Error obtenint productes de ${categoryPath}:`, error.message);
      }
      return [];
    }
  }

  private mapProduct(product: CarrefourProduct): ScrapedPrice {
    return {
      productId: `carf-${product.product_id}`,
      name: product.display_name,
      supermarket: 'Carrefour',
      supermarketId: 'carrefour',
      price: product.active_price.price,
      originalPrice: product.active_price.original_price,
      unit: product.active_price.unit_measure || 'ud',
      pricePerUnit: product.active_price.unit_price,
      category: product.category_path || 'General',
      imageUrl: product.image_path,
      available: product.in_stock,
      scrapedAt: new Date(),
    };
  }

  async scrapeProducts(_category?: string): Promise<ScrapedPrice[]> {
    const products: ScrapedPrice[] = [];

    try {
      console.log('[Carrefour] Intentant obtenir productes via API...');
      
      // Intentar obtenir categories
      const categories = await this.getCategories();
      
      if (categories.length === 0) {
        console.warn('[Carrefour] No s\'han pogut obtenir categories - API pot estar protegida');
        return [];
      }

      console.log(`[Carrefour] Trobades ${categories.length} categories`);

      // Processar primeres categories (limitat per evitar bloqueig)
      for (const category of categories.slice(0, 5)) {
        if (category.seoUrl) {
          const categoryProducts = await this.getCategoryProducts(category.seoUrl);
          products.push(...categoryProducts.map(p => this.mapProduct(p)));
          console.log(`[Carrefour] ${category.name}: ${categoryProducts.length} productes`);
        }
      }

    } catch (error) {
      console.error('[Carrefour] Error scraping:', error);
    }

    console.log(`[Carrefour] Total productes: ${products.length}`);
    return products;
  }

  async scrapeProductDetails(productId: string): Promise<Product | null> {
    console.log(`[Carrefour] Getting details for ${productId}...`);
    // Implementació futura
    return null;
  }

  async searchProducts(query: string): Promise<ScrapedPrice[]> {
    console.log(`[Carrefour] Cercant: ${query}...`);
    
    try {
      await this.waitForRateLimit();
      
      // Endpoint de cerca
      const response = await axios.get(
        `${CARREFOUR_API_BASE}/search-api/v1/search`,
        {
          params: { query, limit: 50 },
          headers: this.browserHeaders,
        }
      );

      const products = response.data?.products || [];
      return products.map((p: CarrefourProduct) => this.mapProduct(p));
    } catch (error: any) {
      if (error.response?.status === 403) {
        console.warn('[Carrefour] Cerca protegida - necessita autenticació');
      } else {
        console.error('[Carrefour] Error cercant:', error.message);
      }
      return [];
    }
  }
}

export const carrefourScraper = new CarrefourScraper();
