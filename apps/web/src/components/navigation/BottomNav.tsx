'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, ListTodo, Map, User } from 'lucide-react';

const navItems = [
  { href: '/', icon: Home, label: 'Inici' },
  { href: '/search', icon: Search, label: 'Cercar' },
  { href: '/list', icon: ListTodo, label: 'Llista' },
  { href: '/map', icon: Map, label: 'Mapa' },
  { href: '/profile', icon: User, label: 'Perfil' },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 pb-safe">
      <div className="max-w-lg mx-auto flex justify-around items-center h-16">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center w-16 h-full transition-colors ${
                isActive
                  ? 'text-primary-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-xs mt-1 font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
