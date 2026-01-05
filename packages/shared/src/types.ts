// ==================
// PRODUCTES
// ==================

export interface Product {
  id: string;
  name: string;
  normalizedName: string;
  brand?: string;
  category: string;
  subcategory?: string;
  description?: string;
  imageUrl?: string;
  barcode?: string;
  unit: string; // 'kg', 'L', 'unitat', etc.
  size?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScrapedPrice {
  productId: string;
  name: string;
  supermarket: string;
  supermarketId: string;
  price: number;
  originalPrice?: number; // Per ofertes
  unit: string;
  pricePerUnit: number;
  category: string;
  subcategory?: string;
  imageUrl?: string;
  available: boolean;
  scrapedAt: Date;
}

export interface PriceHistory {
  productId: string;
  supermarketId: string;
  price: number;
  pricePerUnit: number;
  recordedAt: Date;
}

// ==================
// SUPERMERCATS
// ==================

export interface Supermarket {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  website: string;
  color: string; // Per UI
}

export interface SupermarketLocation {
  id: string;
  supermarketId: string;
  name: string;
  address: string;
  city: string;
  postalCode: string;
  lat: number;
  lng: number;
  phone?: string;
  schedule: DaySchedule[];
  isOpen24h: boolean;
}

export interface DaySchedule {
  day: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Diumenge
  open: string; // "09:00"
  close: string; // "21:00"
  closed: boolean;
}

// ==================
// LLISTA DE COMPRA
// ==================

export interface ShoppingList {
  id: string;
  userId: string;
  name: string;
  items: ShoppingListItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ShoppingListItem {
  id: string;
  productId?: string;
  name: string;
  quantity: number;
  unit?: string;
  notes?: string;
  checked: boolean;
  addedAt: Date;
}

// ==================
// OPTIMITZACIÓ
// ==================

export interface OptimizeRequest {
  items: Array<{
    productId?: string;
    name: string;
    quantity: number;
  }>;
  location: Coordinates;
  maxRadius: number; // km
  maxStops: number;
  prioritize: 'price' | 'distance' | 'balanced';
}

export interface OptimizedRoute {
  totalCost: number;
  totalDistance: number;
  estimatedSavings: number;
  stops: RouteStop[];
}

export interface RouteStop {
  supermarket: {
    id: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
  };
  items: Array<{
    name: string;
    price: number;
    quantity: number;
  }>;
  subtotal: number;
  distanceFromPrevious: number;
}

// ==================
// GEOLOCALITZACIÓ
// ==================

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface GeoSearchParams {
  lat: number;
  lng: number;
  radius: number; // km
}

// ==================
// USUARI
// ==================

export interface User {
  id: string;
  email: string;
  name?: string;
  preferredLocation?: Coordinates;
  favoriteSupermarkets: string[];
  createdAt: Date;
}

// ==================
// API RESPONSES
// ==================

export interface ApiResponse<T> {
  data: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
