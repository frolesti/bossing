'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LineChart, ListTodo, Map } from 'lucide-react';
import { useShoppingProgress } from '@/context/ShoppingProgressContext';

const navItems = [
  { href: '/', icon: ListTodo, label: 'Llista' },
  { href: '/map', icon: Map, label: 'Mapa' },
  { href: '/history', icon: LineChart, label: 'Evolució' },
];

export function BottomNav() {
  const pathname = usePathname();
  const { progress } = useShoppingProgress();

  return (
    <nav aria-label="Navegació principal" className="fixed bottom-0 left-0 right-0 z-50" style={{ pointerEvents: 'none' }}>
      <div className="bottom-nav">
        <div className="flex justify-around items-center">
          {navItems.map(({ href, icon: Icon, label }) => {
            const isActive = pathname === href || (href === '/' && pathname === '/list');
            return (
              <Link
                key={href}
                href={href === '/' ? progress.lastListHref : href}
                scroll={href === '/' ? false : undefined}
                aria-current={isActive ? 'page' : undefined}
                className="nav-tab"
              >
                <Icon size={20} strokeWidth={isActive ? 2.2 : 1.6} />
                <span className={`text-xs ${isActive ? 'font-bold' : 'font-medium'}`}>
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
