import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { productsRouter } from './routes/products.js';
import { supermarketsRouter } from './routes/supermarkets.js';
import { shoppingListRouter } from './routes/shopping-list.js';
import { optimizeRouter } from './routes/optimize.js';
import { locationRouter } from './routes/location.js';
import { historyRouter } from './routes/history.js';
import { errorHandler } from './middleware/error-handler.js';
import { fileCache } from './services/cache.service.js';

const app = express();
const PORT = process.env.API_PORT || 3001;

// Init Cache
fileCache.load().catch(console.error);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/products', productsRouter);
app.use('/api/supermarkets', supermarketsRouter);
app.use('/api/shopping-list', shoppingListRouter);
app.use('/api/optimize', optimizeRouter);
app.use('/api/location', locationRouter);
app.use('/api/history', historyRouter);

// Error handling
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Bossing API running on http://localhost:${PORT}`);
});
