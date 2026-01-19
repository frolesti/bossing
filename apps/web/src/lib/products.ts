
export interface ProductDefinition {
  id?: string;
  name: string;
  category: string;
  unit: string;
  icon: string;
  imageUrl?: string;
  isGroup?: boolean;
}

export const PRODUCT_CATEGORIES = [];

export const COMMON_PRODUCTS: ProductDefinition[] = [];


