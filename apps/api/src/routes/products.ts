import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';

const router: RouterType = Router();
const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

router.get('/suggestions', async (_req, res, next) => {
  try {
    const catalog = await import('@bossing/shared');
    res.json({ catalogVersion: catalog.INTERNAL_CATALOG_VERSION, capture: catalog.INTERNAL_CATALOG_IMPORT,
      categories: catalog.INTERNAL_CATALOG_CATEGORIES.filter(category => !category.parentId), products: [] });
  } catch (error) { next(error); }
});

router.get('/categories/:id/generics', async (req, res, next) => {
  try {
    const catalog = await import('@bossing/shared');
    if (!catalog.INTERNAL_CATALOG_CATEGORIES.some(category => category.id === req.params.id)) {
      res.status(404).json({ error: 'Categoria desconeguda' });
      return;
    }
    res.json(catalog.getInternalCategoryChildren(req.params.id));
  } catch (error) { next(error); }
});

router.get('/category/:id', async (req, res, next) => {
  try {
    const catalog = await import('@bossing/shared');
    const categories = new Set([req.params.id]);
    if (!catalog.INTERNAL_CATALOG_CATEGORIES.some(category => categories.has(category.id))) {
      res.status(404).json({ error: 'Categoria desconeguda' });
      return;
    }
    for (const category of catalog.INTERNAL_CATALOG_CATEGORIES) {
      if (category.parentId && categories.has(category.parentId)) categories.add(category.id);
    }
    res.json({ catalogVersion: catalog.INTERNAL_CATALOG_VERSION,
      data: catalog.INTERNAL_CATALOG_PRODUCTS.filter(product => categories.has(product.category) || product.categoryIds?.some(id => categories.has(id))) });
  } catch (error) { next(error); }
});

router.get('/search', async (req, res, next) => {
  const parsed = searchQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Cerca no valida' });
    return;
  }
  try {
    const catalog = await import('@bossing/shared');
    const { q, page, limit } = parsed.data;
    const products = catalog.searchInternalCatalog(q);
    res.json({ catalogVersion: catalog.INTERNAL_CATALOG_VERSION,
      data: products.slice((page - 1) * limit, page * limit), pagination: { page, limit, total: products.length } });
  } catch (error) { next(error); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const catalog = await import('@bossing/shared');
    const product = catalog.getInternalProduct(req.params.id);
    if (!product) {
      res.status(404).json({ error: 'Producte desconegut' });
      return;
    }
    res.json(product);
  } catch (error) { next(error); }
});

export { router as productsRouter };