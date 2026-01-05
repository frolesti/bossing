import { SearchBar } from '@/components/search/SearchBar';
import { QuickActions } from '@/components/home/QuickActions';
import { NearbyDeals } from '@/components/home/NearbyDeals';
import { ShoppingListPreview } from '@/components/home/ShoppingListPreview';

export default function HomePage() {
  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <header className="pt-4">
        <h1 className="text-2xl font-bold text-gray-900">
          Hola! 👋
        </h1>
        <p className="text-gray-500 mt-1">
          Troba les millors ofertes avui
        </p>
      </header>

      {/* Search */}
      <SearchBar />

      {/* Quick Actions */}
      <QuickActions />

      {/* Shopping List Preview */}
      <ShoppingListPreview />

      {/* Nearby Deals */}
      <NearbyDeals />
    </div>
  );
}
