'use client';

import { Search } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function SearchBar() {
  const [query, setQuery] = useState('');
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push('/');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
        size={18}
      />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Cerca productes..."
        className="input pl-10"
      />
    </form>
  );
}
