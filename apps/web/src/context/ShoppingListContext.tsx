
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { normalizePurchaseQuantity, searchInternalCatalog, getInternalProduct } from '@/lib/products';

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  checked: boolean;
  productId?: string;
  catalogProductId?: string;
  matchMode?: 'generic' | 'exact';
  quantityMode?: 'amount' | 'packages';
  displayUnit?: string;
}

interface ShoppingListContextType {
  items: ShoppingItem[];
  addItem: (item: Omit<ShoppingItem, 'id' | 'checked'>) => void;
  updateQuantity: (id: string, delta: number) => void;
  setQuantity: (id: string, quantity: number) => void;
  updatePreferences: (id: string, preferences: Partial<Pick<ShoppingItem, 'unit' | 'matchMode' | 'quantityMode' | 'displayUnit'>>) => void;
  toggleChecked: (id: string) => void;
  removeItem: (id: string) => void;
  clearList: () => void;
  itemCount: number;
  storageLoaded: boolean;
}

const ShoppingListContext = createContext<ShoppingListContextType | undefined>(undefined);

export function ShoppingListProvider({ children }: { children: ReactNode }) {
  const [storageLoaded, setStorageLoaded] = useState(false);
  // Inicialitzem amb llista buida o carregant de localStorage si volguéssim persistència
  const [items, setItems] = useState<ShoppingItem[]>([
      { id: '1', name: 'Llet', catalogProductId: 'bossing:milk', quantity: 2, unit: 'l', checked: false },
      { id: '2', name: 'Pa', catalogProductId: 'bossing:bread', quantity: 1, unit: 'u', quantityMode: 'packages', checked: false },
      { id: '3', name: 'Ous', catalogProductId: 'bossing:eggs', quantity: 12, unit: 'u', checked: false },
  ]);

  // Persistència bàsica (opcional, però recomanable per UX real)
  useEffect(() => {
    const saved = localStorage.getItem('shopping-list');
    if (saved) {
      try {
        setItems(JSON.parse(saved).map((item: ShoppingItem) => {
          const quantityMode = item.quantityMode || (/^(u|ud)$/i.test(item.unit) && !/\b(ous|huevos?)\b/i.test(item.name) ? 'packages' : 'amount');
          const internal = item.catalogProductId ? getInternalProduct(item.catalogProductId)
            : !item.productId ? searchInternalCatalog(item.name).find(product =>
              product.name.localeCompare(item.name, 'ca', { sensitivity: 'base' }) === 0) : undefined;
          return { ...item, ...normalizePurchaseQuantity(item.quantity, item.unit, quantityMode),
            ...(internal ? { catalogProductId: internal.id, name: internal.name, productId: undefined, matchMode: 'generic' as const }
              : { matchMode: item.matchMode || 'generic' }), quantityMode };
        }));
      } catch (e) {
        console.error('Error parsing shopping list', e);
      }
    }
    setStorageLoaded(true);
  }, []);

  useEffect(() => {
    if (storageLoaded) localStorage.setItem('shopping-list', JSON.stringify(items));
  }, [items, storageLoaded]);

  const addItem = (newItem: Omit<ShoppingItem, 'id' | 'checked'>) => {
    const normalizedItem = { ...newItem, ...normalizePurchaseQuantity(newItem.quantity, newItem.unit, newItem.quantityMode) };
    setItems((prev) => {
      // Normalitzem noms per evitar duplicats (e.g. "Llet" == "llet ")
      const existingIndex = prev.findIndex(
        (i) => newItem.catalogProductId
          ? i.catalogProductId === newItem.catalogProductId && i.unit === normalizedItem.unit && i.quantityMode === normalizedItem.quantityMode
          : newItem.productId
          ? i.productId === newItem.productId && i.unit === normalizedItem.unit && i.quantityMode === normalizedItem.quantityMode
          : !i.productId && i.name.toLowerCase().trim() === newItem.name.toLowerCase().trim() && i.unit === normalizedItem.unit && i.quantityMode === normalizedItem.quantityMode
      );

      if (existingIndex >= 0) {
        // Si ja existeix, sumem la quantitat
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: Math.round((updated[existingIndex].quantity + normalizedItem.quantity) * 1000) / 1000,
        };
        return updated;
      }

      // Si no existeix, creem un nou item
      const item: ShoppingItem = {
        ...normalizedItem,
        id: Date.now().toString(),
        checked: false,
      };
      return [...prev, item];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, quantity: Math.max(item.quantityMode === 'packages' || item.unit === 'u' ? 1 : 0.001,
            Math.round((item.quantity + delta) * 1000) / 1000) }
          : item
      )
    );
  };

  const setQuantity = (id: string, quantity: number) => {
    if (!Number.isFinite(quantity) || quantity <= 0) return;
    setItems(previous => previous.map(item => item.id === id &&
      (!(item.quantityMode === 'packages' || item.unit === 'u') || Number.isInteger(quantity))
      ? { ...item, quantity: Math.round(quantity * 1000) / 1000 } : item));
  };

  const toggleChecked = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    );
  };

  const updatePreferences = (id: string, preferences: Partial<Pick<ShoppingItem, 'unit' | 'matchMode' | 'quantityMode' | 'displayUnit'>>) => {
    setItems(previous => previous.map(item => item.id === id ? { ...item, ...preferences,
      quantity: preferences.quantityMode === 'packages' ? Math.max(1, Math.ceil(item.quantity)) : item.quantity } : item));
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const clearList = () => {
    setItems([]);
  };

  const itemCount = items.length;

  return (
    <ShoppingListContext.Provider
      value={{
        items,
        addItem,
        updateQuantity,
        setQuantity,
        updatePreferences,
        toggleChecked,
        removeItem,
        clearList,
        itemCount,
        storageLoaded,
      }}
    >
      {children}
    </ShoppingListContext.Provider>
  );
}

export function useShoppingList() {
  const context = useContext(ShoppingListContext);
  if (context === undefined) {
    throw new Error('useShoppingList must be used within a ShoppingListProvider');
  }
  return context;
}
