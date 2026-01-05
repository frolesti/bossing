import { Router } from 'express';
import { z } from 'zod';

const router = Router();

const searchQuerySchema = z.object({
  q: z.string().min(1),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  radius: z.coerce.number().default(10),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
});

// Cerca de productes
router.get('/search', async (req, res) => {
  try {
    const query = searchQuerySchema.parse(req.query);
    
    // TODO: Implementar cerca real a la base de dades
    const mockResults = [
      {
        id: '1',
        name: 'Llet Sencera 1L',
        category: 'Lactis',
        prices: [
          { supermarket: 'Mercadona', price: 0.89, updated: new Date() },
          { supermarket: 'Lidl', price: 0.79, updated: new Date() },
          { supermarket: 'Carrefour', price: 0.95, updated: new Date() },
        ],
      },
    ];

    res.json({
      data: mockResults,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: mockResults.length,
      },
    });
  } catch (error) {
    res.status(400).json({ error: 'Paràmetres de cerca invàlids' });
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
