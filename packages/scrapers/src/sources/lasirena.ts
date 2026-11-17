import axios from 'axios';
import { BaseScraper, type ScraperConfig } from '../base.js';
import type { ScrapedPrice, Product } from '@bossing/shared';

const config: ScraperConfig = {
  name: 'La Sirena',
  baseUrl: 'https://www.lasirena.es',
  rateLimit: 5,
  enabled: true,
};

interface VtexSku {
  itemId: string;
  name: string;
  images: Array<{ imageUrl: string }>;
  sellers: Array<{
    sellerId: string;
    commertialOffer: {
      Price: number;
      ListPrice: number;
      AvailableQuantity: number;
      PriceWithoutDiscount: number;
    };
  }>;
  measurementUnit: string;
  unitMultiplier: number;
}

interface VtexProduct {
  productId: string;
  productName: string;
  brand: string;
  brandId: number;
  linkText: string;
  productReference: string;
  categories: string[];
  items: VtexSku[];
  'Información complementaria'?: string[];
}

export class LaSirenaScraper extends BaseScraper {
  constructor() {
    super(config);
  }

  async searchProducts(query: string): Promise<ScrapedPrice[]> {
    console.log(`[La Sirena] Searching for: ${query}...`);
    try {
      const allProducts: VtexProduct[] = [];
      const PAGE_SIZE = 50; // VTEX max per request
      let from = 0;
      
      // Paginate through all results (VTEX returns max 50 per request)
      while (true) {
        const to = from + PAGE_SIZE - 1;
        const response = await axios.get<VtexProduct[]>(
          `https://www.lasirena.es/api/catalog_system/pub/products/search/${encodeURIComponent(query)}`,
          {
            params: {
              _from: from,
              _to: to,
            },
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              Accept: 'application/json',
            },
            timeout: 15000,
          }
        );

        if (!Array.isArray(response.data)) throw new Error('Invalid La Sirena search response');
        const pageProducts = response.data;
        allProducts.push(...pageProducts);
        
        // If we got fewer than PAGE_SIZE, we've reached the end
        if (pageProducts.length < PAGE_SIZE) break;
        
        from += PAGE_SIZE;
        // Safety limit: max 500 products per search
        if (from >= 500) break;
        
        // Small delay between pages
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      console.log(`[La Sirena] Found ${allProducts.length} products for "${query}"`);

      return allProducts.map((p) => {
        const sku = p.items?.[0];
        const seller = sku?.sellers?.find(seller => seller.sellerId === '1');
        const offer = seller?.commertialOffer;
        if (!/^\d+$/.test(p.productId) || !p.productName?.trim() || sku?.itemId !== p.productId ||
          !offer || !Number.isFinite(offer.AvailableQuantity) || offer.AvailableQuantity < 0 ||
          !Number.isFinite(offer.PriceWithoutDiscount) || offer.PriceWithoutDiscount < 0) {
          throw new Error('Unconfirmed La Sirena identity or offer');
        }
        const price = offer.PriceWithoutDiscount;
        const listPrice = offer?.ListPrice || price;
        const imageUrl = sku?.images?.[0]?.imageUrl || '';
        const category = p.categories?.[0] || 'General';
        const available = (offer?.AvailableQuantity || 0) > 0;

        let packageSize: ScrapedPrice['packageSize'];
        const descriptions = p['Información complementaria'];
        if (descriptions?.length === 1 && sku.measurementUnit === 'un' && sku.unitMultiplier === 1) {
          const details: { desUnidadMedidaEtiq?: string; cantidadUnidadMedidaEtiq?: number } = JSON.parse(descriptions[0]);
          const measures: Record<string, { unit: string; scale: number }> = {
            KILOS: { unit: 'kg', scale: 1 }, GRAMOS: { unit: 'kg', scale: 0.001 },
            LITROS: { unit: 'l', scale: 1 }, MILILITROS: { unit: 'l', scale: 0.001 },
            UNIDADES: { unit: 'ud', scale: 1 },
          };
          const measure = measures[details.desUnidadMedidaEtiq || ''];
          const amount = typeof details.cantidadUnidadMedidaEtiq === 'number' && measure
            ? details.cantidadUnidadMedidaEtiq * measure.scale : 0;
          if (Number.isFinite(amount) && amount > 0 && (measure.unit !== 'ud' || Number.isInteger(amount))) {
            packageSize = { amount, unit: measure.unit };
          }
        }
        const unit = packageSize?.unit || 'ud';

        return {
          productId: `lasirena-${p.productId}`,
          name: p.productName,
          supermarket: 'La Sirena',
          supermarketId: 'lasirena',
          price,
          originalPrice: listPrice,
          unit,
          pricePerUnit: packageSize ? price / packageSize.amount : price,
          category,
          imageUrl,
          available,
          scrapedAt: new Date(),
          packageSize,
          source: { provider: 'lasirena-vtex', warehouse: 'public-catalog',
            url: `${config.baseUrl}/api/catalog_system/pub/products/search/${encodeURIComponent(query)}` },
        };
      });
    } catch (error) {
      console.error('[La Sirena] Error:', error instanceof Error ? error.message : error);
      throw error;
    }
  }

  async scrapeProducts(category?: string): Promise<ScrapedPrice[]> {
    const searchTerms = category
      ? [category]
      : [
          'pollo', 'pescado', 'pizza', 'helado', 'verdura',
          'marisco', 'carne', 'croqueta', 'empanada', 'lasaña',
          'arroz', 'patata', 'fruta', 'postre', 'pan',
        ];

    const allProducts: ScrapedPrice[] = [];
    const seenIds = new Set<string>();

    for (const term of searchTerms) {
      try {
        const results = await this.searchProducts(term);
        for (const product of results) {
          if (!seenIds.has(product.productId)) {
            seenIds.add(product.productId);
            allProducts.push(product);
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (error) {
        throw Object.assign(error instanceof Error ? error : new Error('La Sirena source failed'), {
          partialResults: allProducts,
        });
      }
    }

    console.log(`[La Sirena] Total products scraped: ${allProducts.length}`);
    return allProducts;
  }

  async scrapeProductDetails(): Promise<Product | null> {
    return null;
  }
}

export const lasirenaScraper = new LaSirenaScraper();
