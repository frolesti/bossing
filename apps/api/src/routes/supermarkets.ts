import { Router } from 'express';
import { z } from 'zod';

const router = Router();

const nearbyQuerySchema = z.object({
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  radius: z.coerce.number().default(10),
});

// Obtenir supermercats propers
router.get('/nearby', async (req, res) => {
  try {
    const query = nearbyQuerySchema.parse(req.query);
    
    // TODO: Obtenir supermercats de la base de dades amb PostGIS
    const mockSupermarkets = [
      {
        id: '1',
        name: 'Mercadona',
        address: 'Carrer Major 123',
        lat: query.lat + 0.001,
        lng: query.lng + 0.001,
        distance: 0.3,
        openNow: true,
      },
      {
        id: '2',
        name: 'Lidl',
        address: 'Avinguda Diagonal 456',
        lat: query.lat + 0.005,
        lng: query.lng - 0.002,
        distance: 0.8,
        openNow: true,
      },
    ];

    res.json({ data: mockSupermarkets });
  } catch (error) {
    res.status(400).json({ error: 'Coordenades invàlides' });
  }
});

// Obtenir detalls d'un supermercat
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  
  // TODO: Obtenir supermercat de la base de dades
  res.json({
    id,
    name: 'Supermercat',
    address: 'Adreça',
    schedule: [],
    products: [],
  });
});

// Obtenir productes d'un supermercat específic
router.get('/:id/products', async (req, res) => {
  const { id } = req.params;
  const { category, page = 1, limit = 50 } = req.query;
  
  // TODO: Obtenir productes del supermercat
  res.json({
    supermarketId: id,
    products: [],
    pagination: { page, limit, total: 0 },
  });
});

export { router as supermarketsRouter };
