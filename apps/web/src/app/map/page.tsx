'use client';

import dynamic from 'next/dynamic';
import { ShoppingAreaControls, StoreSelection } from '@/components/map/ShoppingAreaControls';

const SupermarketGoogleMap = dynamic(() => import('@/components/map/GoogleMap'), {
  ssr: false, loading: () => <div className="h-[360px] sm:h-[440px] bg-surface-200 animate-pulse" />,
});

export default function MapPage() {
  return (
    <div className="app-page pb-24">
      <header className="page-header px-5 pt-4 pb-7 sm:px-10">
        <div className="border-b border-brand-600/25 pb-3 font-bold text-lg text-brand-600">bossing</div>
        <div className="pt-6">
          <p className="eyebrow text-brand-600 mb-2">La volta al mercat</p>
          <h1 className="font-heading text-4xl sm:text-5xl tracking-tight text-brand-600">Supermercats propers</h1>
          <p className="text-sm text-brand-700 mt-3">Omple el cabàs, a prop de casa.</p>
        </div>
      </header>
      <main className="px-4 py-5 space-y-5">
        <ShoppingAreaControls />
        <SupermarketGoogleMap />
        <StoreSelection />
      </main>
    </div>
  );
}