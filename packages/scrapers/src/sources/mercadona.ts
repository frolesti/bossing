import axios from 'axios';
import { BaseScraper, type ScraperConfig } from '../base.js';
import type { Product, ScrapedPrice } from '@bossing/shared';

const config: ScraperConfig = {
  name: 'Mercadona',
  baseUrl: 'https://tienda.mercadona.es',
  rateLimit: 2, // 2 requests per second
  enabled: true,
};

/**
 * Scraper per a Mercadona
 * 
 * Mercadona té una API interna que es pot accedir des del frontend.
 * Cal analitzar el tràfic de xarxa per obtenir els endpoints exactes.
 * 
 * NOTA: Aquest és un exemple. Caldrà fer enginyeria inversa de l'API real.
 */
export class MercadonaScraper extends BaseScraper {
  private readonly apiUrl = 'https://tienda.mercadona.es/api';

  constructor() {
    super(config);
  }

  async scrapeProducts(category?: string): Promise<ScrapedPrice[]> {
    const products: ScrapedPrice[] = [];

    try {
      // TODO: Implementar l'obtenció de categories i productes
      // Exemple de com seria l'estructura:
      
      // 1. Obtenir categories
      // const categories = await this.getCategories();
      
      // 2. Per cada categoria, obtenir productes
      // for (const cat of categories) {
      //   const catProducts = await this.getCategoryProducts(cat.id);
      //   products.push(...catProducts);
      // }

      console.log(`[Mercadona] Scraping ${category || 'all'} categories...`);
      
      // Mock data per ara
      products.push({
        productId: 'merc-001',
        name: 'Llet Hacendado Sencera 1L',
        supermarket: 'Mercadona',
        supermarketId: 'mercadona',
        price: 0.89,
        unit: 'L',
        pricePerUnit: 0.89,
        category: 'Lactis',
        imageUrl: 'https://example.com/milk.jpg',
        available: true,
        scrapedAt: new Date(),
      });

    } catch (error) {
      console.error('[Mercadona] Error scraping:', error);
      throw error;
    }

    return products;
  }

  async scrapeProductDetails(productId: string): Promise<Product | null> {
    try {
      // TODO: Implementar obtenció de detalls del producte
      console.log(`[Mercadona] Getting details for ${productId}...`);
      return null;
    } catch (error) {
      console.error('[Mercadona] Error getting product details:', error);
      return null;
    }
  }

  async searchProducts(query: string): Promise<ScrapedPrice[]> {
    try {
      // TODO: Implementar cerca de productes
      console.log(`[Mercadona] Searching for: ${query}...`);
      return [];
    } catch (error) {
      console.error('[Mercadona] Error searching:', error);
      return [];
    }
  }

  private async getCategories(): Promise<Array<{ id: string; name: string }>> {
    // TODO: Implementar
    return [];
  }
}

export const mercadonaScraper = new MercadonaScraper();
