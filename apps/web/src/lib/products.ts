
import { INTERNAL_CATALOG_CATEGORIES, INTERNAL_CATALOG_PRODUCTS, normalizePurchaseAmount } from '@bossing/shared';
export { getInternalCategoryChildren, getInternalProduct, searchInternalCatalog } from '@bossing/shared';

export interface ProductDefinition {
  id?: string;
  name: string;
  category: string;
  unit: string;
  icon: string;
  imageUrl?: string;
  isGroup?: boolean;
  packageSize?: { amount: number; unit: string };
  quantityMode?: 'amount' | 'packages';
  defaultQuantity?: number;
  iconUrl?: string;
  iconPosition?: string;
}

export const PRODUCT_CATEGORIES = INTERNAL_CATALOG_CATEGORIES.filter(category => !category.parentId);

export const COMMON_PRODUCTS: readonly ProductDefinition[] = INTERNAL_CATALOG_PRODUCTS;

export function normalizePurchaseQuantity(quantity: number, unit: string, quantityMode?: 'amount' | 'packages') {
  const normalized = normalizePurchaseAmount(quantity, unit);
  return { unit: normalized?.unit || unit, quantity: quantityMode === 'packages' ? quantity : normalized?.quantity || quantity };
}

export function purchaseUnitOptions(unit: string, quantityMode?: 'amount' | 'packages', name = '') {
  if (quantityMode === 'packages') return [{ value: 'packages', label: 'Envasos' }];
  const canonical = normalizePurchaseQuantity(1, unit).unit;
  if (canonical === 'u') return [{ value: 'u', label: 'Unitats' },
    ...(/^(?:ous?|huevos?)\b/i.test(name) ? [{ value: 'dc', label: 'Dotzenes' }] : [])];
  if (canonical === 'l') return [{ value: 'l', label: 'Litres' }, { value: 'ml', label: 'Mil\u00b7lilitres' }];
  if (canonical === 'kg') return [{ value: 'kg', label: 'Quilos' }, { value: 'g', label: 'Grams' }];
  return [{ value: unit, label: unit }];
}

interface DisplayQuantity {
  quantity: number;
  unit: string;
  name: string;
  quantityMode?: 'amount' | 'packages';
  displayUnit?: string;
}

export function purchaseDisplayUnit(item: DisplayQuantity): string {
  const options = purchaseUnitOptions(item.unit, item.quantityMode, item.name);
  if (options.some(option => option.value === item.displayUnit)) return item.displayUnit!;
  return options.some(option => option.value === 'dc') && item.quantity % 12 === 0 ? 'dc' : options[0].value;
}

export function purchaseUnitFactor(unit: string): number {
  return unit === 'dc' ? 12 : unit === 'ml' || unit === 'g' ? 0.001 : 1;
}

export function purchaseQuantityStep(item: DisplayQuantity): number {
  const unit = purchaseDisplayUnit(item);
  return unit === 'dc' ? 12 : unit === 'kg' || unit === 'ml' ? 0.1 : unit === 'g' ? 0.05 : 1;
}

export function formatPurchaseQuantity(item: DisplayQuantity): string {
  const unit = purchaseDisplayUnit(item);
  const quantity = item.quantity / purchaseUnitFactor(unit);
  const formatted = quantity.toLocaleString('ca-ES', { maximumFractionDigits: 3 });
  if (unit === 'packages') return `${formatted} ${quantity === 1 ? 'env\u00e0s' : 'envasos'}`;
  if (unit === 'u') return `${formatted} ${quantity === 1 ? 'unitat' : 'unitats'}`;
  if (unit === 'dc') return `${formatted} ${quantity === 1 ? 'dotzena' : 'dotzenes'} (${item.quantity} unitats)`;
  return `${formatted} ${unit}`;
}


