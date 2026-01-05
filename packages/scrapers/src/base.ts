import type { Product, ScrapedPrice } from '@bossing/shared';

export interface ScraperConfig {
  name: string;
  baseUrl: string;
  rateLimit: number; // requests per second
  enabled: boolean;
}

export interface ScraperResult {
  source: string;
  products: ScrapedPrice[];
  scrapedAt: Date;
  duration: number;
  errors: string[];
}

export abstract class BaseScraper {
  protected config: ScraperConfig;

  constructor(config: ScraperConfig) {
    this.config = config;
  }

  abstract scrapeProducts(category?: string): Promise<ScrapedPrice[]>;
  
  abstract scrapeProductDetails(productId: string): Promise<Product | null>;

  abstract searchProducts(query: string): Promise<ScrapedPrice[]>;

  getName(): string {
    return this.config.name;
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  async run(category?: string): Promise<ScraperResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let products: ScrapedPrice[] = [];

    try {
      products = await this.scrapeProducts(category);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }

    return {
      source: this.config.name,
      products,
      scrapedAt: new Date(),
      duration: Date.now() - startTime,
      errors,
    };
  }
}
