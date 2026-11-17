'use client';

import Link from 'next/link';
import { ArrowRight, Check, Plus } from 'lucide-react';
import { useShoppingList } from '@/context/ShoppingListContext';
import { formatPurchaseQuantity } from '@/lib/products';

export function ShoppingListPreview() {
  const { items, toggleChecked } = useShoppingList();
  const itemCount = items.length;
  const pendingCount = items.filter(item => !item.checked).length;

  if (itemCount === 0) {
    return (
      <section className="notebook px-8 py-9">
        <div className="pl-5">
          <p className="eyebrow text-ink-muted mb-3">La llibreta de la nevera</p>
          <h2 className="font-heading text-3xl text-ink mb-3">Què falta a casa?</h2>
          <p className="text-sm text-ink-secondary mb-6 leading-relaxed">
            Tot comença amb una llista. Apunta el primer producte i prepara la pròxima compra.
          </p>
          <Link href="/list" className="btn-primary inline-flex items-center gap-2">
            <Plus size={16} />
            Començar la llista
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="list-preview-title">
      <div className="flex items-end justify-between gap-3 mb-4">
        <div>
          <p className="eyebrow text-ink-muted mb-1">La llibreta de la nevera</p>
          <h2 id="list-preview-title" className="font-heading text-3xl text-ink">La teva llista</h2>
        </div>
        <Link
          href="/list"
          className="flex items-center gap-1 text-sm text-brand-600 font-bold hover:underline py-2"
        >
          Obrir
          <ArrowRight size={16} />
        </Link>
      </div>

      <div className="notebook">
        <div className="flex justify-between gap-2 pl-16 pr-4 py-3 border-b border-surface-300">
          <span className="eyebrow text-ink-muted">Per a la pròxima compra</span>
          <span className="text-xs text-ink-secondary whitespace-nowrap">{pendingCount} pendents</span>
        </div>
        {items.slice(0, 4).map((item) => (
          <div
            key={item.id}
            className="notebook-row"
          >
            <button
              type="button"
              aria-label={`${item.checked ? 'Marcar com a pendent' : 'Marcar com a comprat'}: ${item.name}`}
              aria-pressed={item.checked}
              onClick={() => toggleChecked(item.id)}
              className={`check-box ${item.checked ? 'checked' : ''}`}
            >
              {item.checked && <Check size={16} className="text-white" />}
            </button>
            <span className={`notebook-name flex-1 min-w-0 break-words ${item.checked ? 'line-through text-ink-muted' : 'text-ink'}`}>{item.name}</span>
            <span className="text-ink-secondary text-sm font-mono max-w-[42%] text-right">{formatPurchaseQuantity(item)}</span>
          </div>
        ))}
        {items.length > 4 && (
          <p className="text-xs text-center text-ink-muted py-3 border-t border-surface-300">
            i {items.length - 4} productes més
          </p>
        )}
      </div>

      <div className="mt-5">
        <Link
          href="/list"
          className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
        >
          Preparar la compra
          <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}
