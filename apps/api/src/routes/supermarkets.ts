import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';

const router: RouterType = Router();

const nearbyQuerySchema = z.object({
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  radius: z.coerce.number().default(5), // km
});

// Dades de supermercats (en producció vindrien de la BD amb PostGIS)
interface Supermarket {
  id: string;
  name: string;
  chain: string;
  address: string;
  lat: number;
  lng: number;
  phone?: string;
  schedule?: string;
}

// Supermercats de prova a València
const SUPERMARKETS_DB: Supermarket[] = [
  // Mercadona
  { id: 'merc-1', name: 'Mercadona', chain: 'mercadona', address: 'C/ Colón, 15, 46004 València', lat: 39.4699, lng: -0.3763, phone: '963 521 234' },
  { id: 'merc-2', name: 'Mercadona', chain: 'mercadona', address: 'Av. del Port, 45, 46023 València', lat: 39.4589, lng: -0.3453, phone: '963 376 543' },
  { id: 'merc-3', name: 'Mercadona', chain: 'mercadona', address: 'C/ Xàtiva, 8, 46002 València', lat: 39.4655, lng: -0.3773, phone: '963 941 232' },
  { id: 'merc-4', name: 'Mercadona', chain: 'mercadona', address: 'Gran Via Ferran el Catòlic, 25, 46008 València', lat: 39.4732, lng: -0.3892, phone: '963 825 678' },
  // Consum
  { id: 'cons-1', name: 'Consum', chain: 'consum', address: 'Plaça de l\'Ajuntament, 10, 46002 València', lat: 39.4695, lng: -0.3767, phone: '963 525 800' },
  { id: 'cons-2', name: 'Consum', chain: 'consum', address: 'C/ Doctor Lluch, 45, 46011 València', lat: 39.4523, lng: -0.3234, phone: '963 712 345' },
  { id: 'cons-3', name: 'Consum', chain: 'consum', address: 'C/ Cura Femenia, 12, 46014 València', lat: 39.4834, lng: -0.4012, phone: '963 782 156' },
  // Carrefour
  { id: 'carf-1', name: 'Carrefour Express', chain: 'carrefour', address: 'C/ Russafa, 23, 46006 València', lat: 39.4612, lng: -0.3745, phone: '963 456 789' },
  { id: 'carf-2', name: 'Carrefour', chain: 'carrefour', address: 'C.C. Ademuz, Av. Pío XII, 46015 València', lat: 39.4899, lng: -0.4123, phone: '963 867 432' },
  { id: 'carf-3', name: 'Carrefour', chain: 'carrefour', address: 'C.C. El Saler, Av. Professor López Piñero, 46013 València', lat: 39.4456, lng: -0.3512, phone: '963 134 567' },
  // DIA
  { id: 'dia-1', name: 'DIA', chain: 'dia', address: 'C/ Conde de Altea, 23, 46005 València', lat: 39.4669, lng: -0.3623, phone: '963 234 567' },
  { id: 'dia-2', name: 'DIA', chain: 'dia', address: 'C/ San Vicente Mártir, 89, 46007 València', lat: 39.4578, lng: -0.3812, phone: '963 345 678' },
  { id: 'dia-3', name: 'DIA', chain: 'dia', address: 'Av. Blasco Ibáñez, 123, 46022 València', lat: 39.4789, lng: -0.3545, phone: '963 456 123' },
  // Lidl
  { id: 'lidl-1', name: 'Lidl', chain: 'lidl', address: 'Av. del Cid, 65, 46018 València', lat: 39.4523, lng: -0.4034, phone: '900 800 543' },
  { id: 'lidl-2', name: 'Lidl', chain: 'lidl', address: 'C/ Músic Ginés, 3, 46022 València', lat: 39.4867, lng: -0.3623, phone: '900 800 543' },
  // Aldi
  { id: 'aldi-1', name: 'Aldi', chain: 'aldi', address: 'C/ Poeta al Russafí, 2, 46019 València', lat: 39.4534, lng: -0.4156, phone: '900 123 456' },
];

// Funció Haversine per calcular distància
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Radi de la Terra en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Obtenir supermercats propers
router.get('/nearby', async (req, res) => {
  try {
    const query = nearbyQuerySchema.parse(req.query);
    
    // Calcular distàncies i filtrar per radi
    const nearbySupers = SUPERMARKETS_DB
      .map(s => ({
        ...s,
        distance: calculateDistance(query.lat, query.lng, s.lat, s.lng),
      }))
      .filter(s => s.distance <= query.radius)
      .sort((a, b) => a.distance - b.distance);

    res.json({ 
      data: nearbySupers,
      meta: {
        total: nearbySupers.length,
        radius: query.radius,
        center: { lat: query.lat, lng: query.lng },
      }
    });
  } catch (error) {
    res.status(400).json({ error: 'Coordenades invàlides' });
  }
});

// Obtenir supermercats per cadena
router.get('/chain/:chain', async (req, res) => {
  const { chain } = req.params;
  const supermarkets = SUPERMARKETS_DB.filter(s => s.chain === chain.toLowerCase());
  res.json({ data: supermarkets, meta: { total: supermarkets.length } });
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
