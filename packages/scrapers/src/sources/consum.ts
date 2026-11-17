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
    availability: string;
    temporaryOutOfStock: boolean;
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

  private async request<T>(path = '', params?: Record<string, string | number>): Promise<T> {
    await this.waitForRateLimit();
    const response = await axios.get<T>(`${this.apiUrl}/catalog/product${path}`, {
      params, timeout: 15_000, headers: { Accept: 'application/json' },
    });
    return response.data;
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
    const data = await this.request<ConsumProductsResponse>('', { offset, limit });
    if (!Array.isArray(data.products)) throw new Error('Invalid Consum product response');
    return data.products;
  }

  /**
   * Obté el nombre total de productes
   */
  private async getTotalCount(): Promise<number> {
    const data = await this.request<ConsumProductsResponse>('', { offset: 0, limit: 1 });
    if (!Number.isSafeInteger(data.totalCount) || data.totalCount <= 0) throw new Error('Invalid Consum catalog count');
    return data.totalCount;
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
    if (!Number.isSafeInteger(product?.id) || product.id <= 0 || !product.productData?.name?.trim()) {
      throw new Error('Invalid Consum product identity');
    }
    if (!['0', '1'].includes(product.productData.availability) || typeof product.productData.temporaryOutOfStock !== 'boolean') {
      throw new Error('Unconfirmed Consum availability');
    }
    const normalPriceData = product.priceData.prices.find(p => p.id === 'PRICE');
    const price = normalPriceData?.value.centAmount;
    const referencePrice = normalPriceData?.value.centUnitAmount;
    if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0 ||
      Math.abs(Math.round(price * 100) / 100 - price) > 1e-8 ||
      typeof referencePrice !== 'number' || !Number.isFinite(referencePrice) || referencePrice <= 0) {
      throw new Error('Invalid Consum price');
    }
    const units: Record<string, { unit: string; scale: number }> = {
      kg: { unit: 'kg', scale: 1 }, g: { unit: 'kg', scale: 0.001 }, gr: { unit: 'kg', scale: 0.001 },
      l: { unit: 'l', scale: 1 }, ml: { unit: 'l', scale: 0.001 }, cl: { unit: 'l', scale: 0.01 },
      ud: { unit: 'ud', scale: 1 }, uds: { unit: 'ud', scale: 1 }, u: { unit: 'ud', scale: 1 },
      unidad: { unit: 'ud', scale: 1 }, unidades: { unit: 'ud', scale: 1 },
      dc: { unit: 'ud', scale: 12 },
    };
    const description = product.productData.description?.trim().toLowerCase() || '';
    const packaging = description.match(/(?:\b(\d+)\s*[x×]\s*)?(\d+(?:[.,]\d+)?)\s*(kg|gr|g|ml|cl|l|unidades|unidad|uds|ud|u|dc)\.?$/);
    const reference = product.priceData.unitPriceUnitType?.trim().toLowerCase().match(/^(\d+(?:[.,]\d+)?)\s*(kg|gr|g|ml|cl|l|unidades|unidad|uds|ud|u|dc)$/);
    if (!reference || !units[reference[2]]) throw new Error('Invalid Consum unit-price basis');
    const referenceAmount = Number(reference[1].replace(',', '.')) * units[reference[2]].scale;
    if (referenceAmount <= 0) throw new Error('Invalid Consum unit-price amount');
    const unit = units[reference[2]].unit;
    const pricePerUnit = referencePrice / referenceAmount;
    let packageSize: ScrapedPrice['packageSize'];
    if (packaging && !/aprox|peso variable|al peso/.test(description)) {
      const packUnit = units[packaging[3]];
      const amount = Number(packaging[1] || 1) * Number(packaging[2].replace(',', '.')) * packUnit.scale;
      if (Number.isFinite(amount) && amount > 0 && (packUnit.unit !== 'ud' || Number.isInteger(amount)) &&
        packUnit.unit === unit && Math.abs(price / amount - pricePerUnit) <= 0.011) {
        packageSize = { amount, unit: packUnit.unit };
      }
    }

    return {
      productId: `consum-${product.id}`,
      name: product.productData.name,
      supermarket: 'Consum',
      supermarketId: 'consum',
      price,
      unit,
      pricePerUnit,
      category: product.categories?.[0]?.name || 'Sense categoria',
      imageUrl: product.productData.imageURL,
      available: product.productData.availability === '1' && !product.productData.temporaryOutOfStock,
      scrapedAt: new Date(),
      packageSize,
      source: { provider: 'consum-rest', warehouse: 'public-catalog', url: `${this.apiUrl}/catalog/product/${product.id}` },
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

    // Obtenir el total de productes
    const totalCount = await this.getTotalCount();
    console.log(`[Consum] Total productes disponibles: ${totalCount}`);

    const targetCount = totalCount;

    while (offset < targetCount) {
      const limit = Math.min(batchSize, targetCount - offset);
      const batch = await this.getProducts(offset, limit);

      if (batch.length === 0) {
        throw new Error('Consum catalog ended before the declared count');
      }

      for (const product of batch) {
        products.push(this.normalizeProduct(product));
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
    const product = await this.getProduct(productId);
    const quote = this.normalizeProduct(product);
    return {
        id: `consum-${product.id}`,
        name: product.productData.name,
        normalizedName: this.normalizeProductName(product.productData.name),
        brand: product.productData.brand.name || undefined,
        category: product.categories[0]?.name || 'Sense categoria',
        description: product.productData.description,
        imageUrl: product.productData.imageURL,
        barcode: product.ean || undefined,
        unit: quote.unit,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
  }

  private async getProduct(productId: string): Promise<ConsumProduct> {
    if (!/^consum-\d+$/.test(productId)) throw new Error('Invalid Consum product identifier');
    const product = await this.request<ConsumProduct>(`/${productId.slice(7)}`);
    if (`consum-${product.id}` !== productId) throw new Error('Consum returned a different product');
    return product;
  }

  async getProductPrice(productId: string): Promise<ScrapedPrice> {
    return this.normalizeProduct(await this.getProduct(productId));
  }

  /**
   * Cerca productes per nom
   */
  async searchProducts(query: string): Promise<ScrapedPrice[]> {
    console.log(`[Consum] Cercant: ${query}...`);
    
    try {
      const data = await this.request<ConsumProductsResponse>('', { q: query, limit: 200 });
      if (!Array.isArray(data.products)) throw new Error('Invalid Consum search response');
      return data.products.map(product => this.normalizeProduct(product));
    } catch (error) {
      console.error('[Consum] Error cercant productes:', error);
      throw error;
    }
  }
}

export const consumScraper = new ConsumScraper();
export default ConsumScraper;
