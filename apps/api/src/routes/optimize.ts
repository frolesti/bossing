import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';

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
    
    // TODO: Implementar l'algoritme d'optimització
    // 1. Obtenir tots els supermercats dins del radi
    // 2. Per cada supermercat, obtenir els preus dels productes de la llista
    // 3. Calcular totes les combinacions possibles (fins a maxStops parades)
    // 4. Aplicar l'algoritme d'optimització segons la prioritat
    // 5. Retornar les millors rutes

    const mockOptimizedRoutes: OptimizedRoute[] = [
      {
        totalCost: 45.67,
        totalDistance: 2.3,
        estimatedSavings: 8.45,
        stops: [
          {
            supermarket: {
              id: '1',
              name: 'Mercadona',
              address: 'Carrer Major 123',
              lat: request.location.lat + 0.001,
              lng: request.location.lng + 0.001,
            },
            items: [
              { name: 'Llet', price: 0.89, quantity: 2 },
              { name: 'Pa', price: 1.20, quantity: 1 },
            ],
            subtotal: 2.98,
            distanceFromPrevious: 0.3,
          },
          {
            supermarket: {
              id: '2',
              name: 'Lidl',
              address: 'Avinguda Diagonal 456',
              lat: request.location.lat + 0.005,
              lng: request.location.lng - 0.002,
            },
            items: [
              { name: 'Ous', price: 1.99, quantity: 12 },
              { name: 'Fruita', price: 3.50, quantity: 1 },
            ],
            subtotal: 5.49,
            distanceFromPrevious: 0.5,
          },
        ],
      },
    ];

    res.json({
      request: {
        itemCount: request.items.length,
        maxRadius: request.maxRadius,
        maxStops: request.maxStops,
        prioritize: request.prioritize,
      },
      routes: mockOptimizedRoutes,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    res.status(400).json({ error: 'Dades de sol·licitud invàlides' });
  }
});

// Previsualitzar estalvis sense ruta completa
router.post('/preview', async (req, res) => {
  try {
    const request = optimizeRequestSchema.parse(req.body);
    
    // TODO: Calcular estalvi estimat ràpidament
    res.json({
      itemCount: request.items.length,
      estimatedMinCost: 42.50,
      estimatedMaxCost: 58.90,
      potentialSavings: 16.40,
      nearbyStoresCount: 5,
    });
  } catch (error) {
    res.status(400).json({ error: 'Dades invàlides' });
  }
});

export { router as optimizeRouter };
