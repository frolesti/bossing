import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { prisma } from '@bossing/database';

const router: RouterType = Router();

const optimizeRequestSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string().optional(),
      name: z.string(),
      quantity: z.number().default(1),
    })
  ),
  location: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
  maxRadius: z.number().default(10), // km
  maxStops: z.number().min(1).max(5).default(3),
  prioritize: z.enum(['price', 'distance', 'balanced']).default('balanced'),
});

interface OptimizedRoute {
  totalCost: number;
  totalDistance: number;
  estimatedSavings: number;
  stops: Array<{
    supermarket: {
      id: string;
      name: string;
      address: string;
      lat: number;
      lng: number;
    };
    items: Array<{
      name: string;
      price: number;
      quantity: number;
    }>;
    subtotal: number;
    distanceFromPrevious: number;
  }>;
}

// Optimitzar ruta de compra
router.post('/', async (req, res) => {
  try {
    const request = optimizeRequestSchema.parse(req.body);
    
    // 1. Obtenir tots els supermercats actius
    const supermarkets = await prisma.supermarket.findMany({
        where: { isActive: true },
        include: { prices: true } // Això pot ser lent si hi ha milers de preus. TODO: Optimitzar query
    });

    // 2. Resoldre productes (NOU ALGORISME DE MATCHING)
    // En lloc de tancar-nos a un sol producte ID, busquem tots els candidats possibles per paraula clau
    // i després triem el millor per a cada supermercat.
    
    // Per a cada item de la request, cerquem TOTES les opcions possibles a la DB
    const itemCandidates = await Promise.all(request.items.map(async (item) => {
        let candidates = [];

        // Estratègia de cerca:
        // 1. Si tenim ID exact, prioritat màxima
        if (item.productId) {
             const exact = await prisma.product.findUnique({ 
                 where: { id: item.productId },
                 include: { prices: true }
             });
             if (exact) candidates.push(exact);
        }

        // 2. Si no hem trobat res (o no hi ha ID), cerquem per text
        if (candidates.length === 0) {
            // Normalitzem la cerca
            const searchTerm = item.name.toLowerCase().trim();
            const words = searchTerm.split(' ').filter(w => w.length > 2);

            // A. Cerca per "conté la frase sencera" (més estricte)
            candidates = await prisma.product.findMany({
                where: {
                    OR: [
                        { normalizedName: { contains: searchTerm } },
                        { name: { contains: searchTerm } }
                    ]
                },
                include: { prices: true }
            });

            // B. Si la cerca estricta retorna pocs resultats (o cap), provem una cerca més laxa
            // (e.g. si usuari posa "Macarrons, llacets i espirals", busquem només "Macarrons")
            if (candidates.length === 0 && words.length > 0) {
                // Provem amb la primera paraula clau significativa
                const primaryKeyword = words[0]; 
                // Excepció per paraules molt curtes com 'pa', 'te', 'vi'
                if (primaryKeyword.length > 2 || ['pa', 'te', 'vi', 'ux'].includes(primaryKeyword)) {
                    candidates = await prisma.product.findMany({
                        where: {
                            normalizedName: { contains: primaryKeyword }
                        },
                        include: { prices: true }
                    });
                }
            }
        }

        return {
            reqItem: item,
            candidates: candidates
        };
    }));

    // 3. Generar rutes "Single Supermarket" (comparació intel·ligent)
    const supermarketRoutes: OptimizedRoute[] = supermarkets.map(supermarket => {
        let totalCost = 0;
        let foundCount = 0;
        const itemsList: any[] = [];
        
        for (const { reqItem, candidates } of itemCandidates) {
            // Dins dels candidats, busquem el millor per a AQUEST supermercat
            // El "millor" és aquell que té preu definit per a aquest super ID
            // Si n'hi ha varis, agafem el més barat per defecte
            
            const validOptions = candidates
                .map(prod => {
                    const priceEntry = prod.prices.find(p => p.supermarketId === supermarket.id);
                    return priceEntry ? { product: prod, price: priceEntry } : null;
                })
                .filter(Boolean) as { product: any, price: any }[];

            // Ordenem per preu ascendent
            validOptions.sort((a, b) => a.price.price - b.price.price);
            
            if (validOptions.length > 0) {
                const match = validOptions[0]; // El més barat
                
                totalCost += match.price.price * reqItem.quantity;
                foundCount++;
                
                itemsList.push({
                    name: match.product.name,
                    price: match.price.price,
                    quantity: reqItem.quantity,
                    // Rich data 
                    brand: match.product.brand,
                    image: match.product.imageUrl,
                    pricePerUnit: match.price.pricePerUnit,
                    unit: match.product.unit,
                    size: match.product.size
                });
            } else {
                 // No tenim cap producte equivalent en aquest super
                 itemsList.push({
                    name: reqItem.name + ' (No disponible)',
                    price: 0,
                    quantity: reqItem.quantity,
                    found: false
                 });
            }
        }
        
        // Simulem dades de lloc ja que no tenim geolocalització real de botigues encara a la DB
        const mockDist = 1.2 + Math.random() * 5; 

        return {
            totalCost: parseFloat(totalCost.toFixed(2)),
            totalDistance: parseFloat(mockDist.toFixed(2)),
            estimatedSavings: 0, // A calcular després comparant amb el pitjor
            stops: [
                {
                    supermarket: {
                        id: supermarket.id,
                        name: supermarket.name,
                        address: 'Carrer Demo, 123',
                        lat: request.location.lat, 
                        lng: request.location.lng 
                    },
                    items: itemsList,
                    subtotal: parseFloat(totalCost.toFixed(2)),
                    distanceFromPrevious: mockDist
                }
            ]
        };
    });

    // Ordenar per preu, filtrar els que tenen 0 productes trobats si es vol
    supermarketRoutes.sort((a, b) => {
         // Prioritzem els que tenen preu > 0 (si tots són 0, no importa)
         if (a.totalCost === 0 && b.totalCost > 0) return 1;
         if (b.totalCost === 0 && a.totalCost > 0) return -1;
         return a.totalCost - b.totalCost;
    });

    const bestPrice = supermarketRoutes[0]?.totalCost || 0;
    
    // Calcular estalvi respecte al més car (o mitjana)
    supermarketRoutes.forEach(r => {
        if (r.totalCost > 0) {
           // Això de l'estalvi és una mica relatiu si es comparen diferents cistelles (productes no trobats)
           // Però per la UI ho deixem senzill
            const diff = r.totalCost - bestPrice;
            r.estimatedSavings = diff < 0 ? 0 : parseFloat(diff.toFixed(2));
        }
    });

    res.json({
      request: {
        itemCount: request.items.length,
        maxRadius: request.maxRadius,
        prioritize: request.prioritize,
      },
      routes: supermarketRoutes,
    });
  } catch (error) {
    console.error('Error optimizing route:', error);
    res.status(500).json({ error: 'Error calculating optimal route' });
  }
});

// Previsualitzar estalvis sense ruta completa
router.post('/preview', async (req, res) => {
  try {
    const request = optimizeRequestSchema.parse(req.body);
    
    // Simple estimació basada en DB
    // Count how many generic matches we have
    const matchCount = await prisma.product.count({
        where: {
            OR: request.items.map(i => ({ normalizedName: { contains: i.name.toLowerCase() } }))
        }
    });

    res.json({
      itemCount: request.items.length,
      estimatedMinCost: 40.50, // TODO: Calcular real si cal
      estimatedMaxCost: 60.90,
      potentialSavings: 20.40,
      nearbyStoresCount: await prisma.supermarket.count({ where: { isActive: true } }),
    });
  } catch (error) {
    res.status(400).json({ error: 'Dades invàlides' });
  }
});

export { router as optimizeRouter };
