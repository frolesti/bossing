'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { ShoppingListProvider } from '@/context/ShoppingListContext';
import { ShoppingAreaProvider } from '@/context/ShoppingAreaContext';
import { ShoppingProgressProvider } from '@/context/ShoppingProgressContext';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ShoppingAreaProvider>
        <ShoppingListProvider>
          <ShoppingProgressProvider>{children}</ShoppingProgressProvider>
        </ShoppingListProvider>
      </ShoppingAreaProvider>
    </QueryClientProvider>
  );
}
