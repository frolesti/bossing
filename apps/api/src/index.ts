import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { productsRouter } from './routes/products.js';
import { supermarketsRouter } from './routes/supermarkets.js';
import { shoppingListRouter } from './routes/shopping-list.js';
import { optimizeRouter } from './routes/optimize.js';
import { errorHandler } from './middleware/error-handler.js';

const app = express();
const PORT = process.env.API_PORT || 3001;

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

// Error handling
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Bossing API running on http://localhost:${PORT}`);
});
