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

interface MercadonaCategoryStructure {
  id: number;
  name: string;
  isGeneric: boolean;
  children?: MercadonaCategoryStructure[];
  products?: MercadonaProduct[];
}

/**
 * Scraper per a Mercadona
 * Utilitza l'API pública de tienda.mercadona.es
 */
export class MercadonaScraper extends BaseScraper {
  private readonly apiUrl = 'https://tienda.mercadona.es/api';
  private categoriesCache: MercadonaCategory[] | null = null;
  // Cache per a estructures de categories individuals (Level 2 -> Level 3 mapping)
  private categoryStructureCache: Map<number, MercadonaCategoryStructure> = new Map();
  // Mapping L1 -> L2 (Root categories cache)
  private rootCategoriesCache: Map<number, MercadonaCategory> = new Map();

  constructor() {
    super(config);
  }

  /**
   * Obté l'estructura d'una categoria (si té subcategories o productes)
   * Això permet identificar "Generators" (Level 3) com "Aceite de oliva".
   */
  async getCategoryStructure(id: number): Promise<MercadonaCategoryStructure | null> {
    if (this.categoryStructureCache.has(id)) {
        return this.categoryStructureCache.get(id)!;
    }

    try {
        const response = await axios.get<MercadonaCategoryDetailResponse>(
            `${this.apiUrl}/categories/${id}/`,
            {
                params: { lang: 'ca' },
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                }
            }
        );

        const data = response.data;
        
        // Detectem si té subcategories (Level 3) -> Són els nostres "Generics"
        const hasSubcategories = data.categories && data.categories.length > 0;
        
        const structure: MercadonaCategoryStructure = {
            id: data.id,
            name: data.name,
            isGeneric: !hasSubcategories, // Si no té fills, és un generic/fulla
            children: hasSubcategories ? data.categories!.map(c => ({
                id: c.id,
                name: c.name,
                isGeneric: true, // Level 3 sempre el tractem com generic
            })) : undefined,
            products: hasSubcategories ? undefined : (data.categories as any) // Si no té fills de categoria, potser té 'categories' que en realitat són llistes de productes? No, l'estructura varia.
        };

        // Si és fulla, potser volem obtenir els productes immediatament
        // En aquesta API, els productes estan dins de 'categories' (que fan de grups de visualització)
        // ex: cat 420 (Oli oliva) -> categories: [{ products: [...] }]
        
        this.categoryStructureCache.set(id, structure);
        return structure;

    } catch (error) {
        console.error(`[Mercadona] Error getting structure for ${id}:`, error);
        return null;
    }
  }

  /**
   * Obté totes les categories de Mercadona
   * Retorna les subcategories (Nivell 2) que són les que tenen productes reals,
   * per evitar problemes amb categories "contenidor" buides.
    // Mapping L1 -> L2 (Root categories cache)
    private rootCategoriesCache: Map<number, MercadonaCategory> = new Map();

  /**
   * Obté totes les categories de Mercadona (Nivell 1 - Roots)
   * Aquestes són les categories generals (ex: "Forn i Pastisseria", "Fruita i Verdura")
   */
  async getCategories(): Promise<MercadonaCategory[]> {
    try {
      if (!this.categoriesCache) {
        const response = await axios.get<MercadonaCategoriesResponse>(
          `${this.apiUrl}/categories/`,
          {
            params: { lang: 'ca' },
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            }
          }
        );
        this.categoriesCache = response.data.results;
        
        // Populate root cache
        if (this.categoriesCache) {
            this.categoriesCache.forEach(root => {
                this.rootCategoriesCache.set(root.id, root);
            });
        }
      }

      // Retrobem directament les categories arrel (Nivell 1)
      // Mantenim l'estructura original per permetre navegació
      return this.categoriesCache || [];

    } catch (error) {
      console.error('[Mercadona] Error obtenint categories:', error);
      return [];
    }
  }

  /**
   * Obté els productes d'una categoria específica
   * Gestiona automàticament categories pare (containers) i subcategories reals.
   */
  async getCategoryProducts(categoryId: number): Promise<MercadonaProduct[]> {
    console.log(`[Mercadona] getCategoryProducts called for ID ${categoryId}`);
    try {
      // 1. Assegurar que tenim la info de l'arbre de categories per saber si és pare
      if (!this.categoriesCache) {
          await this.getCategories();
      }

      // 2. Comprovar si és una categoria arrel (Pare)
      // Les categories arrel NO tenen endpoint propi (/categories/ID returns 404),
      // hem d'iterar sobre els seus fills.
      const parentCategory = this.categoriesCache?.find(c => c.id === categoryId);

      if (parentCategory && parentCategory.categories && parentCategory.categories.length > 0) {
        // És una categoria PARE. Iterem els fills.
        console.log(`[Mercadona] Categoria ${categoryId} és ROOT. Recuperant productes dels fills...`);
        const products: MercadonaProduct[] = [];
        
        // Per performance, limitem a les 3 primeres subcategories inicialment
        // (O podríem fer-ho totes en paral·lel amb Promise.all si calgués)
        const subcategoriesToFetch = parentCategory.categories; // .slice(0, 4);

        for (const sub of subcategoriesToFetch) {
            try {
                // Fetch directe a la subcategoria (que sí hauria de tenir endpoint)
                const subProducts = await this.fetchSubCategoryProducts(sub.id);
                products.push(...subProducts);
            } catch (err) {
                console.warn(`[Mercadona] Error parcial en subcategoria ${sub.id}`);
            }
        }
        return products;
      }

      // 3. Si no és arrel coneguda, assumim que és una subcategoria o ID directe
      return await this.fetchSubCategoryProducts(categoryId);

    } catch (error) {
      console.error(`[Mercadona] Error general obtenint categoria ${categoryId}:`, error);
      return [];
    }
  }

  /**
   * Helper per fer la petició directa a una subcategoria (endpoint final)
   */
  private async fetchSubCategoryProducts(subId: number): Promise<MercadonaProduct[]> {
      const response = await axios.get<MercadonaCategoryDetailResponse>(
        `${this.apiUrl}/categories/${subId}/`,
        {
          params: { lang: 'ca' },
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          }
        }
      );
      
      const products: MercadonaProduct[] = [];
      
      // La resposta directa sol tenir categories filles (nivell 3) amb productes
      if (response.data.categories) {
        for (const subcategory of response.data.categories) {
          if (subcategory.products) {
            products.push(...subcategory.products);
          }
        }
      }
      return products;
  }

  /**
   * Obté subcategories (drill down).
   * - Si levelId és Root (L1) -> Retorna fills L2.
   * - Si levelId és L2 -> Retorna fills L3 (Generics).
   */
  async getSubcategories(levelId: number): Promise<{id: string, name: string, image?: string, isGroup?: boolean}[]> {
    
    // 1. Check if it is a Root Category (cached)
    if (this.rootCategoriesCache.has(levelId)) {
        const root = this.rootCategoriesCache.get(levelId);
        if (root?.categories) {
            return root.categories.map((c: MercadonaSubcategory) => ({
                id: c.id.toString(),
                name: c.name,
                isGroup: true // Indica que encara es pot baixar més
            }));
        }
    }
    
    // 2. If not root, assume L2 and fetch L3
    return this.getLevel3Categories(levelId);
  }

  /**
   * Obté les subcategories de nivell 3 (Generics) donat un ID de nivell 2.
   * Ex: Entra 112 (Aceite, vinagre, sal) -> Surt [420 (Aceite oliva), 422 (Aceite girasol)...]
   */
  async getLevel3Categories(level2Id: number): Promise<{id: string, name: string, image?: string, isGroup?: boolean}[]> {
    try {
        const response = await axios.get<MercadonaCategoryDetailResponse>(
            `${this.apiUrl}/categories/${level2Id}/`,
            {
                params: { lang: 'ca' },
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                }
            }
        );

        if (response.data.categories) {
            return response.data.categories.map(c => ({
                id: c.id.toString(),
                name: c.name,
                // Usem la imatge del primer producte com a representativa
                image: c.products && c.products.length > 0 ? c.products[0].thumbnail : undefined
            }));
        }
        return [];
    } catch (error) {
        console.error(`[Mercadona] Error obtenint Level 3 per ${level2Id}:`, error);
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
