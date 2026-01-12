import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { 
  mercadonaScraper, 
  consumScraper, 
  carrefourScraper, 
  diaScraper, 
  lidlScraper 
} from '@bossing/scrapers';
import type { ScrapedPrice } from '@bossing/shared';

const router: RouterType = Router();

const searchQuerySchema = z.object({
  q: z.string().min(1),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  radius: z.coerce.number().default(10),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
});

// Helper per a icones de categories
function getIconForCategory(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('fruit') || n.includes('verdura')) return '🥬';
  if (n.includes('carn')) return '🥩';
  if (n.includes('llet') || n.includes('postres') || n.includes('formatge')) return '🧀';
  if (n.includes('forn')) return '🥖';
  if (n.includes('begud') || n.includes('celler')) return '🍷';
  if (n.includes('congelat')) return '❄️';
  if (n.includes('netej') || n.includes('llar')) return '🧹';
  if (n.includes('perfum') || n.includes('higiene')) return '🧴';
  if (n.includes('mascota')) return '🐶';
  if (n.includes('bebè')) return '👶';
  return '📦';
}

// Helper per a colors de categories
function getColorForCategory(name: string): string {
    const n = name.toLowerCase();
  if (n.includes('fruit') || n.includes('verdura')) return 'bg-green-100 text-green-700';
  if (n.includes('carn')) return 'bg-red-100 text-red-700';
  if (n.includes('llet') || n.includes('postres')) return 'bg-yellow-100 text-yellow-700';
  if (n.includes('begud') || n.includes('celler')) return 'bg-purple-100 text-purple-700';
  if (n.includes('congelat')) return 'bg-cyan-100 text-cyan-700';
  return 'bg-gray-100 text-gray-700';
}
function getSupermarketIcon(supermarket: string): string {
    switch (supermarket.toLowerCase()) {
        case 'mercadona': return '🛒';
        case 'consum': return '🟧';
        case 'carrefour': return '🔵';
        case 'lidl': return '🟡';
        case 'dia': return '🔴';
        default: return '🏪';
    }
}
// Obtenir suggeriments de productes (basat en ubicació - sense dades hardcoded)
router.get('/suggestions', async (req, res) => {
  const { lat, lng } = req.query;

  try {
      console.log('Fetching real categories from Mercadona...');
      // Obtenim categories reals del scraper
      const categories = await mercadonaScraper.getCategories();
      
      // Mapegem al format del frontend
      const mappedCategories = categories.map(c => ({
          id: c.id.toString(), // ID real de Mercadona (numèric a string)
          name: c.name,
          icon: getIconForCategory(c.name),
          color: getColorForCategory(c.name)
      }));

      // NOTA: No retornem productes inicials per defecte per evitar 
      // milers de peticions o dades "hardcoded".
      // L'frontend ha de fer cerques o demanar productes per categoria.
      
      // Opcionalment podriem fer una cerca ràpida de "bàsics"
      // const basics = await mercadonaScraper.searchProducts('llet'); 

      res.json({
        categories: mappedCategories,
        products: [] 
      });
  } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Endpoint per obtenir subcategories genèriques (Level 3) o subcategories (Level 2)
// Funciona com a "Drill Down" dinàmic
router.get('/categories/:id/generics', async (req, res) => {
    const { id } = req.params;
    try {
        const catId = parseInt(id);
        if (isNaN(catId)) {
            res.status(400).json({ error: 'Invalid category ID' });
            return;
        }

        // Usem la nova lògica unificada del scraper
        const result = await mercadonaScraper.getSubcategories(catId);
        
        const mappedResults = result.map(c => ({
            id: c.id,
            name: c.name,
            icon: c.isGroup ? '📂' : getIconForCategory(c.name),
            image: c.image,
            color: getColorForCategory(c.name),
            isGroup: c.isGroup
        }));

        res.json(mappedResults);
    } catch (error) {
        console.error(`Error fetching generics for category ${id}:`, error);
        res.status(500).json({ error: 'Failed to fetch generic categories' });
    }
});

// Helper per mapejar categories
function mapCategory(scrapedCategory: string): string {
  const cat = scrapedCategory.toLowerCase();
  if (cat.includes('fruit') || cat.includes('verdur') || cat.includes('carn') || cat.includes('peix')) return 'fresh';
  if (cat.includes('llet') || cat.includes('iogurt') || cat.includes('postres') || cat.includes('ous')) return 'fridge';
  if (cat.includes('aigua') || cat.includes('refresc') || cat.includes('alcohol') || cat.includes('suc')) return 'drinks';
  if (cat.includes('congelat') || cat.includes('gelat')) return 'frozen';
  if (cat.includes('netej') || cat.includes('llar') || cat.includes('mascota')) return 'household';
  return 'pantry'; // Default
}

// Obtenir productes d'una categoria específica
router.get('/category/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Convertim id a nombre per Mercadona
    const catId = parseInt(id);
    if (isNaN(catId)) {
        return res.status(400).json({ error: 'Invalid category ID' });
    }

    console.log(`Fetching products for category ${catId}...`);
    // Obtenim productes reals
    // NOTA: Algunes categories mare poden no tenir productes directament o retornar 404 si són "virtuals"
    // Intentem fallar suaument
    let mercadonaProducts: any[] = [];
    try {
        mercadonaProducts = await mercadonaScraper.getCategoryProducts(catId);
    } catch (e) {
        console.warn(`Category ${catId} fetch failed, maybe it's empty or invalid.`);
    }

    // ESTRATÈGIA COMPARADOR:
    // Utilitzem el nom de la categoria de Mercadona per cercar productes similars a la resta de supermercats
    let otherSupermarketsCallback: Promise<ScrapedPrice[]>[] = [];
    
    if (mercadonaProducts.length > 0) {
        // Intentem deduir el nom de la categoria (ex: "Aceite") del primer producte
        // Els productes tenen categories: [{id: 112, name: "Aceite..."}]
        const referenceProduct = mercadonaProducts[0];
        const categoryName = referenceProduct.categories?.find((c: any) => c.id === catId)?.name || referenceProduct.categories?.[0]?.name;
        
        if (categoryName) {
            console.log(`Expanding category "${categoryName}" to other supermarkets...`);
            // Llancem cerques paral·leles (sense bloquejar massa si fallen)
            const searchSafe = (scraper: any, name: string) => scraper.searchProducts(categoryName).catch((e: any) => {
                console.warn(`Cross-search failed for ${name}:`, e.message);
                return [];
            });

            otherSupermarketsCallback = [
                searchSafe(consumScraper, 'Consum'),
                searchSafe(carrefourScraper, 'Carrefour'),
                searchSafe(lidlScraper, 'Lidl'),
                searchSafe(diaScraper, 'Dia')
            ];
        }
    }

    // Esperem resultats externs
    const otherResultsResults = await Promise.all(otherSupermarketsCallback);
    
    // Log per debug
    console.log(`[Cross-Search] Consum: ${otherResultsResults[0]?.length || 0} items`);
    console.log(`[Cross-Search] Carrefour: ${otherResultsResults[1]?.length || 0} items`);
    console.log(`[Cross-Search] Lidl: ${otherResultsResults[2]?.length || 0} items`);
    console.log(`[Cross-Search] Dia: ${otherResultsResults[3]?.length || 0} items`);

    const otherResults = otherResultsResults.flat();

    // Mapegem Mercadona al format comú
    const formattedMercadona = mercadonaProducts.map(p => ({
        name: p.display_name,
        category: id,
        unit: p.price_instructions.size_format || 'u',
        icon: '🛒', // Icona fixa per Mercadona aquí
        imageUrl: p.thumbnail,
        supermarket: 'Mercadona',
        price: parseFloat(p.price_instructions.unit_price)
    }));

    // Mapegem la resta
    const formattedOthers = otherResults.map(p => ({
        name: p.name,
        category: id,
        unit: p.unit || 'u',
        icon: getSupermarketIcon(p.supermarket),
        imageUrl: p.imageUrl,
        supermarket: p.supermarket,
        price: p.price
    }));

    // Barregem resultats (Mercadona primer, després la resta barrejada?)
    // O millor: interleave o sort per preu? Per ara, concatenem.
    const allProducts = [...formattedMercadona, ...formattedOthers];
    
    const results = allProducts.slice(0, 100); // Limitem a 100 per no saturar

    res.json({ data: results });
  } catch (error) {
    console.error('Error fetching category products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Cerca de productes
router.get('/search', async (req, res) => {
  try {
    const query = searchQuerySchema.parse(req.query);
    
    // Cerca real utilitzant tots els scrapers
    console.log(`Searching for: ${query.q}`);
    
    // Helper per gestionar errors de cerca individual
    const searchSafe = async (scraper: { searchProducts: (q: string) => Promise<ScrapedPrice[]> }, name: string) => {
        try {
            return await scraper.searchProducts(query.q);
        } catch (e) {
            console.error(`${name} search failed:`, e);
            return [];
        }
    };

    const [mercadonaResults, consumResults, carrefourResults, diaResults, lidlResults] = await Promise.all([
      searchSafe(mercadonaScraper, 'Mercadona'),
      searchSafe(consumScraper, 'Consum'),
      searchSafe(carrefourScraper, 'Carrefour'),
      searchSafe(diaScraper, 'Dia'),
      searchSafe(lidlScraper, 'Lidl')
    ]);

    const allResults = [
        ...mercadonaResults, 
        ...consumResults, 
        ...carrefourResults, 
        ...diaResults, 
        ...lidlResults
    ];
    
    // Deduplicate by name if needed, or allow both to show price comparison hint
    // For suggestions list, we might want unique names?
    // User wants "options", maybe unique names are better, but knowing it's available in Consum vs Mercadona is useful.
    // The frontend only shows Name + Icon roughly.
    // If I return "Llet Hacendado" and "Llet Consum", that's fine.
    
    // Sort by price or relevance?
    // Mercadona results come first, then Consum. Maybe interleave?
    // For now, just merged is fine.

      // Deduplicate by name and supermarket?
      // const uniqueResults = Array.from(new Map(allResults.map(item => [item.productId, item])).values());
  
      const results = allResults.map(item => ({
        id: item.productId || item.name.replace(/\s+/g, '-').toLowerCase(),
        name: item.name,
        category: mapCategory(item.category || ''),
        unit: item.unit || 'u', // Afegim unitat real
        icon: getSupermarketIcon(item.supermarket), // Helper per icona
        imageUrl: item.imageUrl,
        prices: [
          { 
            supermarket: item.supermarket, 
            price: item.price, 
            updated: item.scrapedAt || new Date() 
          }
        ],
      }));
  
      res.json({
        data: results,
        pagination: {
          page: query.page,
          limit: query.limit,
          total: results.length,
        },
      });
    } catch (error) {
    console.error('Search error:', error);
    res.status(400).json({ error: 'Error cercant productes: ' + (error instanceof Error ? error.message : String(error)) });
  }
});

// Obtenir detalls d'un producte
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  
  // TODO: Obtenir producte de la base de dades
  res.json({
    id,
    name: 'Producte exemple',
    prices: [],
    priceHistory: [],
  });
});

// Comparar preus d'un producte
router.get('/:id/compare', async (req, res) => {
  const { id } = req.params;
  const { lat, lng } = req.query;

  // TODO: Comparar preus a supermercats propers
  res.json({
    productId: id,
    comparisons: [],
    cheapest: null,
  });
});

export { router as productsRouter };
