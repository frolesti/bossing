import type { ScrapedPrice } from '../types.js';

export interface PurchaseRequest {
  productId?: string;
  quantity: number;
  unit?: string;
}

export type PurchaseLine =
  | { found: false; reason: 'missing' | 'identity' | 'unavailable' | 'format' | 'quantity' | 'price' }
  | { found: true; packageCount: number; purchasedQuantity: number; lineTotalCents: number; lineTotal: number };

function normalizedUnit(unit: string): { unit: string; scale: number } | undefined {
  const units: Record<string, { unit: string; scale: number }> = {
    l: { unit: 'l', scale: 1 }, ml: { unit: 'l', scale: 0.001 },
    cl: { unit: 'l', scale: 0.01 },
    kg: { unit: 'kg', scale: 1 }, g: { unit: 'kg', scale: 0.001 },
    ud: { unit: 'ud', scale: 1 }, u: { unit: 'ud', scale: 1 },
    dc: { unit: 'ud', scale: 12 },
    dotzena: { unit: 'ud', scale: 12 }, dotzenes: { unit: 'ud', scale: 12 },
    docena: { unit: 'ud', scale: 12 }, docenas: { unit: 'ud', scale: 12 },
    unitat: { unit: 'ud', scale: 1 }, unitats: { unit: 'ud', scale: 1 },
  };
  return units[unit.trim().toLowerCase()];
}

export function normalizePurchaseAmount(quantity: number, unit: string): { quantity: number; unit: string } | undefined {
  const definition = normalizedUnit(unit);
  if (!definition || !Number.isFinite(quantity) || quantity <= 0) return undefined;
  const amount = definition.scale < 1 ? quantity / (1 / definition.scale) : quantity * definition.scale;
  return { quantity: amount, unit: definition.unit === 'ud' ? 'u' : definition.unit };
}

export function calculatePurchaseLine(request: PurchaseRequest, product?: ScrapedPrice): PurchaseLine {
  if (!product) return { found: false, reason: 'missing' };
  if (request.productId && request.productId !== product.productId) return { found: false, reason: 'identity' };
  if (!product.available) return { found: false, reason: 'unavailable' };
  if (!Number.isFinite(request.quantity) || request.quantity <= 0) return { found: false, reason: 'quantity' };
  const requestedUnit = request.unit && normalizedUnit(request.unit);
  const packageUnit = product.packageSize && normalizedUnit(product.packageSize.unit);
  if (!requestedUnit || !packageUnit || requestedUnit.unit !== packageUnit.unit ||
    !product.packageSize || !Number.isFinite(product.packageSize.amount) || product.packageSize.amount <= 0) {
    return { found: false, reason: 'format' };
  }
  const priceCents = Math.round(product.price * 100);
  if (!Number.isSafeInteger(priceCents) || priceCents <= 0 || Math.abs(priceCents / 100 - product.price) > 1e-8) {
    return { found: false, reason: 'price' };
  }
  const requestedAmount = request.quantity * requestedUnit.scale;
  const packageAmount = product.packageSize.amount * packageUnit.scale;
  const ratio = requestedAmount / packageAmount;
  const packageCount = Math.ceil(ratio - Number.EPSILON * Math.max(1, ratio) * 4);
  const lineTotalCents = packageCount * priceCents;
  if (!Number.isSafeInteger(lineTotalCents) || packageCount < 1) return { found: false, reason: 'quantity' };
  return {
    found: true, packageCount,
    purchasedQuantity: packageCount * packageAmount / requestedUnit.scale,
    lineTotalCents, lineTotal: lineTotalCents / 100,
  };
}

export function summarizeBasket(lines: PurchaseLine[], identitiesAndLocationVerified: boolean) {
  const foundCount = lines.filter(line => line.found).length;
  const complete = lines.length > 0 && foundCount === lines.length;
  const comparable = complete && identitiesAndLocationVerified;
  const subtotalCents = lines.reduce((sum, line) => sum + (line.found ? line.lineTotalCents : 0), 0);
  return {
    complete, comparable, foundCount,
    totalCost: comparable ? subtotalCents / 100 : null,
    subtotal: subtotalCents / 100,
  };
}