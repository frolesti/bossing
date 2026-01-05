import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';

const router: RouterType = Router();

const shoppingItemSchema = z.object({
  productId: z.string().optional(),
  name: z.string(),
  quantity: z.number().default(1),
  unit: z.string().optional(),
  notes: z.string().optional(),
});

const shoppingListSchema = z.object({
  name: z.string().default('La meva llista'),
  items: z.array(shoppingItemSchema),
});

// Obtenir llistes de compra de l'usuari
router.get('/', async (_req, res) => {
  // TODO: Autenticació i obtenir llistes de l'usuari
  res.json({
    data: [
      {
        id: '1',
        name: 'Compra setmanal',
        items: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  });
});

// Crear nova llista
router.post('/', async (req, res) => {
  try {
    const list = shoppingListSchema.parse(req.body);
    
    // TODO: Guardar a la base de dades
    res.status(201).json({
      id: 'new-list-id',
      ...list,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } catch (error) {
    res.status(400).json({ error: 'Dades de llista invàlides' });
  }
});

// Obtenir una llista específica
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  
  // TODO: Obtenir llista de la base de dades
  res.json({
    id,
    name: 'Llista',
    items: [],
  });
});

// Actualitzar llista
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const updates = shoppingListSchema.partial().parse(req.body);
    
    // TODO: Actualitzar a la base de dades
    res.json({
      id,
      ...updates,
      updatedAt: new Date(),
    });
  } catch (error) {
    res.status(400).json({ error: 'Dades invàlides' });
  }
});

// Afegir producte a la llista
router.post('/:id/items', async (req, res) => {
  const { id } = req.params;
  
  try {
    const item = shoppingItemSchema.parse(req.body);
    
    // TODO: Afegir a la base de dades
    res.status(201).json({
      listId: id,
      item: {
        id: 'new-item-id',
        ...item,
      },
    });
  } catch (error) {
    res.status(400).json({ error: 'Dades del producte invàlides' });
  }
});

// Eliminar producte de la llista
router.delete('/:listId/items/:itemId', async (req, res) => {
  const { listId, itemId } = req.params;
  
  // TODO: Eliminar de la base de dades
  res.json({ success: true, listId, itemId });
});

export { router as shoppingListRouter };
