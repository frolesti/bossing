export interface ComparisonAlternative {
  productId: string;
  name: string;
  price: number;
  pricePerUnit: number;
  unit: string;
  packageSize: { amount: number; unit: string };
  quantity: number;
  lineTotal: number;
  purchasedQuantity: number;
  source?: { warehouse: string; url: string };
  scrapedAt?: string;
}

export interface ComparisonItem {
  itemId: string;
  productId?: string;
  productName: string;
  price: number;
  quantity: number;
  lineTotal: number;
  found: boolean;
  reason?: string;
  requestedQuantity?: number;
  requestedUnit?: string;
  purchasedQuantity?: number;
  packageSize?: { amount: number; unit: string };
  brand?: string;
  image?: string;
  pricePerUnit?: number;
  unit?: string;
  size?: number;
  source?: { warehouse: string; url: string };
  scrapedAt?: string;
  candidateCount?: number;
  compatibleCount?: number;
  alternatives?: ComparisonAlternative[];
}

export interface PriceComparison {
  storeId: string;
  address: string;
  distance: number;
  supermarket: string;
  total: number | null;
  subtotal: number;
  comparable: boolean;
  status: string;
  items: ComparisonItem[];
}

export function createShoppingPlan(comparisons: PriceComparison[], assignments: Record<string, string> = {}) {
  const requested = new Map(comparisons.flatMap(comparison => comparison.items).map(item => [item.itemId, item]));
  const groups = new Map<string, { store: PriceComparison; items: ComparisonItem[]; subtotal: number }>();
  const missing: ComparisonItem[] = [];
  for (const [itemId, requestedItem] of requested) {
    const candidates = comparisons.flatMap(store => store.items.filter(item => item.itemId === itemId && item.found &&
      Number.isFinite(item.lineTotal) && item.lineTotal > 0 && item.quantity > 0).map(item => ({ store, item })))
      .sort((first, second) => first.item.lineTotal - second.item.lineTotal || first.store.storeId.localeCompare(second.store.storeId));
    const selected = assignments[itemId] ? candidates.find(candidate => candidate.store.storeId === assignments[itemId]) : candidates[0];
    if (!selected) { missing.push(requestedItem); continue; }
    const group = groups.get(selected.store.storeId) || { store: selected.store, items: [], subtotal: 0 };
    group.items.push(selected.item);
    group.subtotal = Math.round((group.subtotal + selected.item.lineTotal) * 100) / 100;
    groups.set(selected.store.storeId, group);
  }
  return { groups: [...groups.values()], missing };
}