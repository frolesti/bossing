import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';

const router: RouterType = Router();
const coordinates = z.object({ lat: z.coerce.number().min(-90).max(90), lng: z.coerce.number().min(-180).max(180) });
const addressQuery = z.object({ q: z.string().trim().min(3).max(200) });
interface ResolvedLocation { lat: number; lng: number; address: string; postalCode?: string }
interface GeocodingResult { lat: string; lon: string; display_name: string; address?: { postcode?: string } }
const cache = new Map<string, { value: ResolvedLocation; time: number }>();
const pending = new Map<string, Promise<ResolvedLocation>>();
let nextLookupAt = 0;

async function lookup(endpoint: 'reverse' | 'search', parameters: Record<string, string>): Promise<ResolvedLocation> {
  const query = new URLSearchParams({ ...parameters, format: 'jsonv2', addressdetails: '1', 'accept-language': 'ca' });
  const key = `${endpoint}?${query}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.time < 86_400_000) return cached.value;
  const current = pending.get(key);
  if (current) return current;
  const request = (async () => {
    const start = Math.max(Date.now(), nextLookupAt);
    nextLookupAt = start + 1000;
    if (start > Date.now()) await new Promise(resolve => setTimeout(resolve, start - Date.now()));
    const response = await fetch(`https://nominatim.openstreetmap.org/${endpoint}?${query}`, {
      headers: { 'User-Agent': 'Bossing/0.1 (supermarket comparison app)' }, signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error('Geocoding source unavailable');
    const payload = await response.json();
    const result: GeocodingResult | undefined = endpoint === 'search' ? payload[0] : payload;
    if (!result?.display_name || !Number.isFinite(Number(result.lat)) || !Number.isFinite(Number(result.lon))) {
      throw new Error('Address not found');
    }
    const postcode = result.address?.postcode;
    const value = { lat: Number(result.lat), lng: Number(result.lon), address: result.display_name,
      postalCode: postcode && /^\d{5}$/.test(postcode) ? postcode : undefined };
    if (cache.size >= 200) cache.delete(cache.keys().next().value!);
    cache.set(key, { value, time: Date.now() });
    return value;
  })();
  pending.set(key, request);
  try { return await request; } finally { pending.delete(key); }
}

router.get('/', async (req, res) => {
  try {
    const point = coordinates.parse(req.query);
    res.json(await lookup('reverse', { lat: point.lat.toFixed(5), lon: point.lng.toFixed(5), zoom: '18' }));
  } catch (error) {
    res.status(error instanceof z.ZodError ? 400 : 502).json({ error: 'No es pot resoldre la ubicacio.' });
  }
});

router.get('/search', async (req, res) => {
  try {
    const query = addressQuery.parse(req.query);
    res.json(await lookup('search', { q: query.q, countrycodes: 'es', limit: '1' }));
  } catch (error) {
    res.status(error instanceof z.ZodError ? 400 : 502).json({ error: 'No es pot resoldre aquesta adreca.' });
  }
});

export { router as locationRouter };