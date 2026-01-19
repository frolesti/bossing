
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  checked: boolean;
}

interface ShoppingListContextType {
  items: ShoppingItem[];
  addItem: (item: Omit<ShoppingItem, 'id' | 'checked'>) => void;
  updateQuantity: (id: string, delta: number) => void;
  toggleChecked: (id: string) => void;
  removeItem: (id: string) => void;
  clearList: () => void;
  itemCount: number;
}

const ShoppingListContext = createContext<ShoppingListContextType | undefined>(undefined);

export function ShoppingListProvider({ children }: { children: ReactNode }) {
  // Inicialitzem amb llista buida o carregant de localStorage si volguéssim persistència
  const [items, setItems] = useState<ShoppingItem[]>([
      { id: '1', name: 'Llet', quantity: 2, unit: 'L', checked: false },
      { id: '2', name: 'Pa', quantity: 1, unit: 'u', checked: false },
      { id: '3', name: 'Ous', quantity: 12, unit: 'u', checked: false },
  ]);

  // Persistència bàsica (opcional, però recomanable per UX real)
  useEffect(() => {
    const saved = localStorage.getItem('shopping-list');
    if (saved) {
      try {
        setItems(JSON.parse(saved));
      } catch (e) {
        console.error('Error parsing shopping list', e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('shopping-list', JSON.stringify(items));
  }, [items]);

  const addItem = (newItem: Omit<ShoppingItem, 'id' | 'checked'>) => {
    setItems((prev) => {
      // Normalitzem noms per evitar duplicats (e.g. "Llet" == "llet ")
      const existingIndex = prev.findIndex(
        (i) => i.name.toLowerCase().trim() === newItem.name.toLowerCase().trim()
      );

      if (existingIndex >= 0) {
        // Si ja existeix, sumem la quantitat
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + newItem.quantity,
        };
        return updated;
      }

      // Si no existeix, creem un nou item
      const item: ShoppingItem = {
        ...newItem,
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
          ? { ...item, quantity: Math.max(1, item.quantity + delta) }
          : item
      )
    );
  };

  const toggleChecked = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    );
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
        toggleChecked,
        removeItem,
        clearList,
        itemCount,
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
