import axios from 'axios';
import { BaseScraper, type ScraperConfig } from '../base.js';
import type { Product, ScrapedPrice } from '@bossing/shared';

const config: ScraperConfig = {
  name: 'Mercadona',
  baseUrl: 'https://tienda.mercadona.es',
  rateLimit: 2, // 2 requests per second
  enabled: true,
};

// Credencials públiques d'Algolia per a cerca
const ALGOLIA_APP_ID = '7UZJKL1DJ0';
const ALGOLIA_API_KEY = '9d8f2e39e90df472b4f2e559a116fe17';
const DEFAULT_WAREHOUSE = 'vlc1'; // València per defecte

interface AlgoliaProduct {
  objectID: string;
  id: string;
  slug: string;
  brand: string | null;
  display_name: string;
  thumbnail: string;
  price_instructions: {
    unit_price: string;
    reference_price: string;
    reference_format: string;
    unit_size: number;
    size_format: string;
    is_new: boolean;
    price_decreased: boolean;
    previous_unit_price?: string | null;
  };
  categories: Array<{ id: number; name: string; categories?: Array<{ name: string }> }>;
  _highlightResult?: Record<string, unknown>;
}

interface AlgoliaResponse {
  hits: AlgoliaProduct[];
  nbHits: number;
  page: number;
  nbPages: number;
  hitsPerPage: number;
}

interface MercadonaCategory {
  id: number;
  name: string;
  categories?: MercadonaSubcategory[];
}

interface MercadonaSubcategory {
  id: number;
  name: string;
  products?: MercadonaProduct[];
}

interface MercadonaCategoryDetailResponse {
  id: number;
  name: string;
  categories?: MercadonaSubcategory[];
}

interface MercadonaProduct {
  id: string;
  slug: string;
  display_name: string;
  thumbnail: string;
  share_url: string;
  published: boolean;
  packaging?: string;
  price_instructions: {
    unit_price: string;
    bulk_price: string;
    reference_price: string;
    reference_format: string;
    unit_size: number;
    size_format: string;
    is_pack: boolean;
    pack_size?: number;
    total_units?: number;
    is_new: boolean;
    price_decreased: boolean;
    previous_unit_price?: string;
  };
  categories: Array<{ id: number; name: string }>;
}

interface MercadonaCategoriesResponse {
  count: number;
  results: MercadonaCategory[];
}

/**
 * Scraper per a Mercadona
 * Utilitza l'API pública de tienda.mercadona.es
 */
export class MercadonaScraper extends BaseScraper {
  private readonly apiUrl = 'https://tienda.mercadona.es/api';

  constructor() {
    super(config);
  }

  /**
   * Obté totes les categories de Mercadona
   */
  async getCategories(): Promise<MercadonaCategory[]> {
    try {
      const response = await axios.get<MercadonaCategoriesResponse>(
        `${this.apiUrl}/categories/`
      );
      return response.data.results;
    } catch (error) {
      console.error('[Mercadona] Error obtenint categories:', error);
      return [];
    }
  }

  /**
   * Obté els productes d'una categoria específica
   */
  async getCategoryProducts(categoryId: number): Promise<MercadonaProduct[]> {
    try {
      const response = await axios.get<MercadonaCategoryDetailResponse>(
        `${this.apiUrl}/categories/${categoryId}/`
      );
      
      const products: MercadonaProduct[] = [];
      
      // Recórrer subcategories
      if (response.data.categories) {
        for (const subcategory of response.data.categories) {
          if (subcategory.products) {
            products.push(...subcategory.products);
          }
        }
      }
      
      return products;
    } catch (error) {
      console.error(`[Mercadona] Error obtenint categoria ${categoryId}:`, error);
      return [];
    }
  }

  /**
   * Converteix un producte de Mercadona al format de l'app
   */
  private mapProduct(product: MercadonaProduct, categoryName: string): ScrapedPrice {
    const priceInfo = product.price_instructions;
    
    return {
      productId: `merc-${product.id}`,
      name: product.display_name,
      supermarket: 'Mercadona',
      supermarketId: 'mercadona',
      price: parseFloat(priceInfo.unit_price),
      originalPrice: priceInfo.previous_unit_price 
        ? parseFloat(priceInfo.previous_unit_price) 
        : undefined,
      unit: priceInfo.size_format || 'ud',
      pricePerUnit: parseFloat(priceInfo.reference_price),
      category: categoryName,
      imageUrl: product.thumbnail,
      available: product.published,
      scrapedAt: new Date(),
    };
  }

  async scrapeProducts(categorySlug?: string): Promise<ScrapedPrice[]> {
    const products: ScrapedPrice[] = [];

    try {
      console.log('[Mercadona] Obtenint categories...');
      const categories = await this.getCategories();
      console.log(`[Mercadona] Trobades ${categories.length} categories`);

      // Si s'especifica una categoria, filtrar
      const categoriesToScrape = categorySlug
        ? categories.filter(c => c.name.toLowerCase().includes(categorySlug.toLowerCase()))
        : categories;

      for (const category of categoriesToScrape) {
        console.log(`[Mercadona] Processant: ${category.name}`);
        
        // Respectar rate limit
        await this.delay(1000 / this.config.rateLimit);
        
        if (category.categories) {
          for (const subcat of category.categories) {
            const subcatProducts = await this.getCategoryProducts(subcat.id);
            
            for (const product of subcatProducts) {
              products.push(this.mapProduct(product, category.name));
            }
            
            // Respectar rate limit entre subcategories
            await this.delay(500);
          }
        }
      }

      console.log(`[Mercadona] Total productes obtinguts: ${products.length}`);

    } catch (error) {
      console.error('[Mercadona] Error scraping:', error);
      throw error;
    }

    return products;
  }

  async scrapeProductDetails(productId: string): Promise<Product | null> {
    try {
      // L'ID intern és sense prefix
      const id = productId.replace('merc-', '');
      const response = await axios.get(`${this.apiUrl}/products/${id}/`);
      
      const data = response.data;
      return {
        id: `merc-${data.id}`,
        name: data.display_name,
        normalizedName: this.normalizeProductName(data.display_name),
        brand: this.extractBrand(data.display_name),
        category: data.categories?.[0]?.name || 'Altres',
        description: data.details?.description,
        imageUrl: data.thumbnail,
        unit: data.price_instructions?.size_format || 'ud',
        size: data.price_instructions?.unit_size,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (error) {
      console.error('[Mercadona] Error obtenint detalls:', error);
      return null;
    }
  }

  async searchProducts(query: string): Promise<ScrapedPrice[]> {
    console.log(`[Mercadona] Cercant via Algolia: ${query}...`);
    
    try {
      const response = await axios.post<AlgoliaResponse>(
        `https://${ALGOLIA_APP_ID.toLowerCase()}-dsn.algolia.net/1/indexes/products_prod_${DEFAULT_WAREHOUSE}_es/query`,
        {
          params: `query=${encodeURIComponent(query)}&hitsPerPage=50`
        },
        {
          headers: {
            'X-Algolia-Application-Id': ALGOLIA_APP_ID,
            'X-Algolia-API-Key': ALGOLIA_API_KEY,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log(`[Mercadona] Algolia trobats: ${response.data.nbHits} resultats`);

      return response.data.hits.map(hit => {
        const priceInfo = hit.price_instructions;
        const categoryName = hit.categories?.[0]?.name || 'Altres';
        
        return {
          productId: `merc-${hit.id}`,
          name: hit.display_name,
          supermarket: 'Mercadona',
          supermarketId: 'mercadona',
          price: parseFloat(priceInfo.unit_price),
          originalPrice: priceInfo.previous_unit_price 
            ? parseFloat(priceInfo.previous_unit_price) 
            : undefined,
          unit: priceInfo.size_format || 'ud',
          pricePerUnit: parseFloat(priceInfo.reference_price),
          category: categoryName,
          imageUrl: hit.thumbnail,
          available: true,
          scrapedAt: new Date(),
        };
      });
    } catch (error) {
      console.error('[Mercadona] Error cerca Algolia:', error);
      // Fallback a cerca local
      console.log('[Mercadona] Fallback a cerca local...');
      const allProducts = await this.scrapeProducts();
      const normalizedQuery = query.toLowerCase();
      return allProducts.filter(p => 
        p.name.toLowerCase().includes(normalizedQuery)
      );
    }
  }

  /**
   * Cerca producte per codi de barres (EAN)
   */
  async searchByEAN(ean: string): Promise<ScrapedPrice | null> {
    console.log(`[Mercadona] Cercant EAN: ${ean}...`);
    
    try {
      const response = await axios.post<AlgoliaResponse>(
        `https://${ALGOLIA_APP_ID.toLowerCase()}-dsn.algolia.net/1/indexes/products_prod_${DEFAULT_WAREHOUSE}_es/query`,
        {
          params: `query=${ean}&hitsPerPage=10`
        },
        {
          headers: {
            'X-Algolia-Application-Id': ALGOLIA_APP_ID,
            'X-Algolia-API-Key': ALGOLIA_API_KEY,
            'Content-Type': 'application/json',
          },
        }
      );

      // Buscar per nom que contingui el codi (Algolia no indexa EAN directament)
      const match = response.data.hits[0];
      
      if (!match) {
        return null;
      }

      const priceInfo = match.price_instructions;
      const categoryName = match.categories?.[0]?.name || 'Altres';

      return {
        productId: `merc-${match.id}`,
        name: match.display_name,
        supermarket: 'Mercadona',
        supermarketId: 'mercadona',
        price: parseFloat(priceInfo.unit_price),
        originalPrice: priceInfo.previous_unit_price 
          ? parseFloat(priceInfo.previous_unit_price) 
          : undefined,
        unit: priceInfo.size_format || 'ud',
        pricePerUnit: parseFloat(priceInfo.reference_price),
        category: categoryName,
        imageUrl: match.thumbnail,
        available: true,
        scrapedAt: new Date(),
      };
    } catch (error) {
      console.error('[Mercadona] Error cerca EAN:', error);
      return null;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private normalizeProductName(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractBrand(name: string): string | undefined {
    // Marques comunes de Mercadona
    const brands = ['Hacendado', 'Deliplus', 'Bosque Verde', 'Compy', 'Asturiana', 'Puleva'];
    for (const brand of brands) {
      if (name.includes(brand)) {
        return brand;
      }
    }
    return undefined;
  }
}

export const mercadonaScraper = new MercadonaScraper();
