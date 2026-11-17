'use client';

import { createContext, useContext, useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import type { PriceComparison } from '@/lib/shopping-plan';

interface ShoppingProgress {
  newItemName: string;
  selectionMode: 'generic' | 'exact';
  categoryHistory: string[];
  comparisons: PriceComparison[];
  showComparison: boolean;
  expandedSupermarkets: string[];
  comparisonError: string | null;
  assignments: Record<string, string>;
  comparisonScope: string | null;
  lastListHref: string;
  scrollPositions: Record<string, number>;
  showAllStores: boolean;
  showUnsupportedStores: boolean;
}

const initialProgress: ShoppingProgress = {
  newItemName: '', selectionMode: 'generic', categoryHistory: [], comparisons: [], showComparison: false,
  expandedSupermarkets: [], comparisonError: null, assignments: {}, comparisonScope: null,
  lastListHref: '/', scrollPositions: {}, showAllStores: false, showUnsupportedStores: false,
};

const ShoppingProgressContext = createContext<{
  progress: ShoppingProgress;
  setProgress: Dispatch<SetStateAction<ShoppingProgress>>;
  ready: boolean;
  isComparing: boolean;
  setIsComparing: Dispatch<SetStateAction<boolean>>;
  comparisonRequest: { current: number };
} | null>(null);

export function ShoppingProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState(initialProgress);
  const [ready, setReady] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const comparisonRequest = useRef(0);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem('shopping-progress:v1') || 'null');
      if (saved && Array.isArray(saved.comparisons) && Array.isArray(saved.categoryHistory) &&
        typeof saved.lastListHref === 'string' && /^\/(?:list)?(?:\?step=(?:stores|comparison|plan))?$/.test(saved.lastListHref)) {
        setProgress({ ...initialProgress, ...saved });
      }
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { sessionStorage.setItem('shopping-progress:v1', JSON.stringify(progress)); } catch {}
  }, [progress, ready]);

  return <ShoppingProgressContext.Provider value={{ progress, setProgress, ready, isComparing, setIsComparing, comparisonRequest }}>
    {children}
  </ShoppingProgressContext.Provider>;
}

export function useShoppingProgress() {
  const context = useContext(ShoppingProgressContext);
  if (!context) throw new Error('ShoppingProgressProvider is required');
  return context;
}

export function useProgressState<Key extends keyof ShoppingProgress>(key: Key): [ShoppingProgress[Key], Dispatch<SetStateAction<ShoppingProgress[Key]>>] {
  const { progress, setProgress } = useShoppingProgress();
  return [progress[key], value => setProgress(previous => ({ ...previous,
    [key]: typeof value === 'function' ? (value as (current: ShoppingProgress[Key]) => ShoppingProgress[Key])(previous[key]) : value,
  }))];
}