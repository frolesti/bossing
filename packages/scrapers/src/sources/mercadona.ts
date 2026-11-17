import axios, { type AxiosInstance } from 'axios';
import { BaseScraper, type ScraperConfig } from '../base.js';
import type { Product, ScrapedPrice } from '@bossing/shared';

const config: ScraperConfig = {
  name: 'Mercadona',
  baseUrl: 'https://tienda.mercadona.es',
  rateLimit: 3,
  enabled: true,
};

interface MercaProduct {
  id: string;
  display_name: string;
  thumbnail: string;
  published: boolean;
  unavailable_from?: string | null;
  unavailable_weekdays?: number[];
  categories: Array<{ id: number; name: string }>;
  price_instructions: {
    unit_price: string;
    reference_price: string;
    reference_format: string;
    unit_size: number;
    size_format: string;
    is_pack: boolean;
    pack_size: number | null;
    total_units: number | null;
    approx_size?: boolean;
    selling_method?: number;
    previous_unit_price?: string | null;
  };
}

interface MercaCategory {
  id: number;
  name: string;
  categories?: MercaCategory[];
  products?: MercaProduct[];
}

function money(value: unknown, label: string): number {
  if (typeof value !== 'string' || !/^\d+(\.\d+)?$/.test(value.trim())) {
    throw new Error(`Invalid Mercadona ${label}`);
  }
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`Invalid Mercadona ${label}`);
  return parsed;
}

export class MercadonaScraper extends BaseScraper {
  private readonly apiBase = 'https://tienda.mercadona.es/api';
  private http: AxiosInstance;
  private categoriesCache: MercaCategory[] | null = null;
  private subcategoryNameCache = new Map<number, string>();
  private parentCategoryIds = new Map<number, number>();
  private catalogCache: ScrapedPrice[] | null = null;
  private catalogTime = 0;
  private catalogRequest: Promise<ScrapedPrice[]> | null = null;
  private nextRequestTime = 0;
  private static readonly CATALOG_TTL = 2 * 60 * 60 * 1000;

  constructor(private warehouse = 'bcn1') {
    super(config);
    if (!/^[a-z0-9]+$/.test(warehouse)) throw new Error('Invalid Mercadona warehouse');
    this.http = axios.create({ baseURL: this.apiBase, timeout: 15_000 });
    this.http.interceptors.request.use(async request => {
      const start = Math.max(Date.now(), this.nextRequestTime);
      this.nextRequestTime = start + Math.ceil(1000 / config.rateLimit);
      const wait = start - Date.now();
      if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
      return request;
    });
  }

  async setPostalCode(postalCode: string): Promise<string> {
    if (!/^\d{5}$/.test(postalCode)) throw new Error('Invalid postal code');
    const response = await this.http.put('/postal-codes/actions/change-pc/', {
      new_postal_code: postalCode,
    });
    const warehouse: unknown = response.headers['x-customer-wh'];
    if (typeof warehouse !== 'string' || !/^[a-z0-9]+$/.test(warehouse)) {
      throw new Error('Mercadona did not confirm the postal-code warehouse');
    }
    this.warehouse = warehouse;
    this.categoriesCache = null;
    this.subcategoryNameCache.clear();
    this.parentCategoryIds.clear();
    this.catalogCache = null;
    this.catalogRequest = null;
    return warehouse;
  }

  private async category(id?: number, warehouse = this.warehouse): Promise<MercaCategory[]> {
    const { data } = await this.http.get(id === undefined ? '/categories/' : `/categories/${id}/`, {
      params: { lang: 'es', wh: warehouse },
    });
    const categories = id === undefined ? data.results : data.categories;
    if (!Array.isArray(categories)) throw new Error('Invalid Mercadona category response');
    return categories;
  }

  async getCategories(): Promise<MercaCategory[]> {
    if (this.categoriesCache) return this.categoriesCache;
    const warehouse = this.warehouse;
    const categories = await this.category(undefined, warehouse);
    if (!categories.length) throw new Error('Mercadona returned an empty category tree');
    if (warehouse !== this.warehouse) throw new Error('Mercadona warehouse changed during request');
    this.categoriesCache = categories;
    return categories;
  }

  private quote(product: MercaProduct, warehouse: string, url: string, category?: string): ScrapedPrice {
    if (!product || !/^\d+(?:\.\d+)?$/.test(product.id) || !product.display_name?.trim()) {
      throw new Error(`Invalid Mercadona product identity: ${JSON.stringify({ id: product?.id, name: product?.display_name })}`);
    }
    if (typeof product.published !== 'boolean') throw new Error('Missing Mercadona availability');
    const instructions = product.price_instructions;
    if (!instructions) throw new Error(`Missing Mercadona price for ${product.id}`);
    const price = money(instructions.unit_price, `price for ${product.id}`);
    const pricePerUnit = money(instructions.reference_price, `reference price for ${product.id}`);
    const size = Number(instructions.unit_size);
    const fixed = instructions.approx_size === false && instructions.selling_method === 0;
    const amount = size;
    return {
      productId: `merc-${product.id}`,
      name: product.display_name,
      supermarket: 'Mercadona',
      supermarketId: 'mercadona',
      price,
      originalPrice: instructions.previous_unit_price
        ? money(instructions.previous_unit_price, 'previous price') : undefined,
      unit: instructions.reference_format.toLowerCase(),
      pricePerUnit,
      category: category || product.categories?.[0]?.name || 'Altres',
      imageUrl: product.thumbnail,
      available: product.published && !product.unavailable_from && !product.unavailable_weekdays?.length,
      scrapedAt: new Date(),
      source: { provider: 'mercadona-rest', warehouse, url },
      packageSize: fixed && Number.isFinite(amount) && amount > 0
        ? { amount, unit: instructions.size_format.toLowerCase() } : undefined,
    };
  }

  private async categoryProducts(categoryId: number, warehouse: string, leafId?: number): Promise<ScrapedPrice[]> {
    const groups = await this.category(categoryId, warehouse);
    return groups.filter(group => leafId === undefined || group.id === leafId).flatMap(group => {
      if (!Array.isArray(group.products)) throw new Error(`Missing Mercadona products in ${categoryId}`);
      return group.products.filter(product => product.published).map(product =>
        this.quote(product, warehouse, `${this.apiBase}/categories/${categoryId}/`, group.name),
      );
    });
  }

  async getCategoryProducts(categoryId: number): Promise<ScrapedPrice[]> {
    const parentId = this.parentCategoryIds.get(categoryId);
    return this.categoryProducts(parentId ?? categoryId, this.warehouse, parentId ? categoryId : undefined);
  }

  async loadFullCatalog(): Promise<ScrapedPrice[]> {
    if (this.catalogCache && Date.now() - this.catalogTime < MercadonaScraper.CATALOG_TTL) {
      return this.catalogCache;
    }
    if (this.catalogRequest) return this.catalogRequest;
    const warehouse = this.warehouse;
    const request = (async () => {
      const categories = await this.getCategories();
      const ids = [...new Set(categories.flatMap(category => category.categories?.map(sub => sub.id) || []))];
      if (!ids.length) throw new Error('Mercadona has no catalog categories');
      const products = new Map<string, ScrapedPrice>();
      for (let index = 0; index < ids.length; index += 3) {
        const batches = await Promise.all(ids.slice(index, index + 3).map(id => this.categoryProducts(id, warehouse)));
        for (const product of batches.flat()) products.set(product.productId, product);
      }
      if (warehouse !== this.warehouse) throw new Error('Mercadona warehouse changed during catalog load');
      if (!products.size) throw new Error('Mercadona returned an empty catalog');
      const catalog = [...products.values()];
      this.catalogCache = catalog;
      this.catalogTime = Date.now();
      return catalog;
    })();
    this.catalogRequest = request;
    try {
      return await request;
    } finally {
      if (this.catalogRequest === request) this.catalogRequest = null;
    }
  }

  async searchProducts(query: string): Promise<ScrapedPrice[]> {
    if (!query.trim()) throw new Error('Mercadona search query must not be empty');
    const words = this.normalizeProductName(query).split(' ').filter(Boolean);
    if (!words.length) throw new Error('Mercadona search query must contain words');
    const catalog = await this.loadFullCatalog();
    return catalog.filter(product => {
      const name = this.normalizeProductName(product.name);
      return words.every(word => name.includes(word));
    });
  }

  async scrapeProducts(category?: string): Promise<ScrapedPrice[]> {
    const catalog = await this.loadFullCatalog();
    return category ? catalog.filter(product =>
      this.normalizeProductName(product.category).includes(this.normalizeProductName(category)),
    ) : catalog;
  }

  async getProductPrice(productId: string): Promise<ScrapedPrice> {
    const id = productId.replace(/^merc-/, '');
    if (!/^\d+(?:\.\d+)?$/.test(id)) throw new Error('Invalid Mercadona product ID');
    const warehouse = this.warehouse;
    const url = `${this.apiBase}/products/${id}/`;
    const { data } = await this.http.get<MercaProduct>(`/products/${id}/`, {
      params: { lang: 'es', wh: warehouse },
    });
    if (data.id !== id) throw new Error('Mercadona returned a different product');
    return this.quote(data, warehouse, url);
  }

  async scrapeProductDetails(productId: string): Promise<Product | null> {
    const quote = await this.getProductPrice(productId);
    return {
      id: quote.productId,
      name: quote.name,
      normalizedName: this.normalizeProductName(quote.name),
      category: quote.category,
      imageUrl: quote.imageUrl,
      unit: quote.packageSize?.unit || quote.unit,
      size: quote.packageSize?.amount,
      createdAt: quote.scrapedAt,
      updatedAt: quote.scrapedAt,
    };
  }

  async searchByEAN(_ean: string): Promise<ScrapedPrice | null> {
    throw new Error('EAN lookup is not supported by the authoritative Mercadona catalog');
  }

  async getSubcategories(parentId: number): Promise<{ id: string; name: string; image?: string; isGroup?: boolean }[]> {
    const roots = await this.getCategories();
    const parent = roots.find(category => category.id === parentId);
    const knownGroup = roots.some(root => root.categories?.some(sub => sub.id === parentId));
    if (!parent && !knownGroup) return [];
    const groups = parent?.categories || await this.category(parentId);
    for (const group of groups) {
      this.subcategoryNameCache.set(group.id, group.name);
      if (!parent) this.parentCategoryIds.set(group.id, parentId);
    }
    return groups.map(group => ({
      id: String(group.id), name: group.name, image: group.products?.[0]?.thumbnail, isGroup: true,
    }));
  }

  getSubcategoryName(catId: number): string | null {
    if (this.subcategoryNameCache.has(catId)) return this.subcategoryNameCache.get(catId)!;
    for (const root of this.categoriesCache || []) {
      if (root.id === catId) return root.name;
      const sub = root.categories?.find(category => category.id === catId);
      if (sub) return sub.name;
    }
    return null;
  }

  async getCategoryProductsByName(categoryName: string): Promise<ScrapedPrice[]> {
    return this.searchProducts(categoryName);
  }

  private normalizeProductName(name: string): string {
    return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }
}

export const mercadonaScraper = new MercadonaScraper();