import axios from 'axios';
import { BaseScraper, type ScraperConfig } from '../base.js';
import type { Product, ScrapedPrice } from '@bossing/shared';

const config: ScraperConfig = {
  name: 'DIA',
  baseUrl: 'https://www.dia.es',
  rateLimit: 1, // Conservador per evitar bloqueig
  enabled: true,
};

// Endpoints descoberts a GitHub
const DIA_API_BASE = 'https://www.dia.es/api/v1';

interface DIAProduct {
  product_id: string;
  name: string;
  display_name: string;
  price: number;
  unit_price: number;
  unit_measure: string;
  original_price?: number;
  image_url: string;
  category: string;
  ean?: string;
  brand?: string;
  in_stock: boolean;
  is_offer: boolean;
}

interface DIACategory {
  id: string;
  name: string;
  slug: string;
  subcategories?: DIACategory[];
}

interface DIAProductsResponse {
  products: DIAProduct[];
  total: number;
  page: number;
}

/**
 * Scraper per a DIA
 * 
 * DIA té una API que requereix cookies de sessió.
 * Actualment implementem scraping bàsic amb fallback.
 */
export class DIAScraper extends BaseScraper {
  private lastRequestTime = 0;

  // Headers per simular navegador
  private readonly browserHeaders = {
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'es-ES,es;q=0.9,ca;q=0.8',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://www.dia.es/',
    'Origin': 'https://www.dia.es',
    'X-Requested-With': 'XMLHttpRequest',
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
   * Obtenir categories principals via HTML parsing
   */
  async getCategories(): Promise<DIACategory[]> {
    // Categories conegudes de DIA
    return [
      { id: '1', name: 'Frutas', slug: '/frutas' },
      { id: '2', name: 'Verduras', slug: '/verduras' },
      { id: '3', name: 'Carnes', slug: '/carnes' },
      { id: '4', name: 'Pescados y mariscos', slug: '/pescados-y-mariscos' },
      { id: '5', name: 'Huevos, leche y mantequilla', slug: '/huevos-leche-y-mantequilla' },
      { id: '6', name: 'Yogures y postres', slug: '/yogures-y-postres' },
      { id: '7', name: 'Charcutería y quesos', slug: '/charcuteria-y-quesos' },
      { id: '8', name: 'Panes, harinas y masas', slug: '/panes-harinas-y-masas' },
      { id: '9', name: 'Galletas, bollos y cereales', slug: '/galletas-bollos-y-cereales' },
      { id: '10', name: 'Agua, refrescos y zumos', slug: '/agua-refrescos-y-zumos' },
    ];
  }

  /**
   * Intent d'obtenir productes via API
   */
  async getCategoryProducts(categorySlug: string): Promise<DIAProduct[]> {
    try {
      await this.waitForRateLimit();
      
      const response = await axios.get<DIAProductsResponse>(
        `${DIA_API_BASE}/plp-back/reduced${categorySlug}`,
        {
          headers: this.browserHeaders,
        }
      );
      
      return response.data?.products || [];
    } catch (error: any) {
      // 403/404 significa que l'API no és accessible sense autenticació
      if (error.response?.status === 403 || error.response?.status === 404) {
        console.warn(`[DIA] API protegida per ${categorySlug}`);
      } else {
        console.error(`[DIA] Error obtenint productes de ${categorySlug}:`, error.message);
      }
      return [];
    }
  }

  private mapProduct(product: DIAProduct, categoryName: string): ScrapedPrice {
    return {
      productId: `dia-${product.product_id}`,
      name: product.display_name || product.name,
      supermarket: 'DIA',
      supermarketId: 'dia',
      price: product.price,
      originalPrice: product.original_price,
      unit: product.unit_measure || 'ud',
      pricePerUnit: product.unit_price,
      category: categoryName,
      imageUrl: product.image_url,
      available: product.in_stock,
      scrapedAt: new Date(),
    };
  }

  async scrapeProducts(_category?: string): Promise<ScrapedPrice[]> {
    const products: ScrapedPrice[] = [];

    try {
      console.log('[DIA] Intentant obtenir productes via API...');
      
      const categories = await this.getCategories();
      console.log(`[DIA] Processant ${categories.length} categories...`);

      for (const category of categories.slice(0, 5)) {
        const categoryProducts = await this.getCategoryProducts(category.slug);
        
        if (categoryProducts.length > 0) {
          products.push(...categoryProducts.map(p => this.mapProduct(p, category.name)));
          console.log(`[DIA] ${category.name}: ${categoryProducts.length} productes`);
        }
      }

      if (products.length === 0) {
        console.warn('[DIA] API no accessible - considereu usar Puppeteer per scraping real');
      }

    } catch (error) {
      console.error('[DIA] Error scraping:', error);
    }

    console.log(`[DIA] Total productes: ${products.length}`);
    return products;
  }

  async scrapeProductDetails(productId: string): Promise<Product | null> {
    console.log(`[DIA] Getting details for ${productId}...`);
    return null;
  }

  async searchProducts(query: string): Promise<ScrapedPrice[]> {
    console.log(`[DIA] Cercant: ${query}...`);
    
    try {
      await this.waitForRateLimit();
      
      const response = await axios.get(
        `${DIA_API_BASE}/search-service/search`,
        {
          params: { query, limit: 50 },
          headers: this.browserHeaders,
        }
      );

      const products = response.data?.products || [];
      return products.map((p: DIAProduct) => this.mapProduct(p, 'Cerca'));
    } catch (error: any) {
      if (error.response?.status === 403 || error.response?.status === 404) {
        console.warn('[DIA] Cerca protegida - API no accessible');
      } else {
        console.error('[DIA] Error cercant:', error.message);
      }
      return [];
    }
  }
}

export const diaScraper = new DIAScraper();
export default DIAScraper;
