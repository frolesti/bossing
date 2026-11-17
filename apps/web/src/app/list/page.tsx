'use client';

import { useState, useEffect, useLayoutEffect, useRef, Suspense } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Plus,
  Minus,
  Trash2,
  Search,
  ShoppingCart,
  ShoppingBag,
  MapPin,
  RefreshCw,
  Check,
  ChevronRight,
  X,
  ArrowBigLeft,
  Loader2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { PRODUCT_CATEGORIES, getInternalCategoryChildren, searchInternalCatalog, purchaseUnitOptions,
  purchaseDisplayUnit, purchaseUnitFactor, purchaseQuantityStep, formatPurchaseQuantity, type ProductDefinition } from '@/lib/products';
import { CatalogIcon } from '@/components/search/CatalogIcon';
import { useProgressState, useShoppingProgress } from '@/context/ShoppingProgressContext';
import { useShoppingList } from '@/context/ShoppingListContext';
import { useShoppingArea } from '@/context/ShoppingAreaContext';
import { ShoppingAreaControls, StoreSelection } from '@/components/map/ShoppingAreaControls';
import { createShoppingPlan, type PriceComparison } from '@/lib/shopping-plan';

// Types
interface CategoryDefinition {
    id: string;
    name: string;
    icon: string;
    color: string;
}

const steps = [
  { id: 'list', label: 'Llista', title: 'Llista de la compra' },
  { id: 'stores', label: 'Botigues', title: 'Compara supermercats' },
  { id: 'comparison', label: 'Preus', title: 'Comparació de preus' },
  { id: 'plan', label: 'Compra', title: 'Compra per supermercat' },
] as const;
type ShoppingStep = typeof steps[number]['id'];

function ShoppingListContent() {

  const { items, storageLoaded, addItem: contextAddItem, updateQuantity, setQuantity, updatePreferences, toggleChecked, removeItem, clearList } = useShoppingList();
  const { progress, setProgress, ready, isComparing, setIsComparing, comparisonRequest } = useShoppingProgress();
  const area = useShoppingArea();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const step = steps.find(candidate => candidate.id === searchParams.get('step')) || steps[0];
  const stepIndex = steps.findIndex(candidate => candidate.id === step.id);
  const goToStep = (next: ShoppingStep) => {
    setProgress(previous => ({ ...previous, scrollPositions: { ...previous.scrollPositions, [step.id]: window.scrollY } }));
    setShowSuggestions(false);
    const parameters = new URLSearchParams(searchParams.toString());
    if (next === 'list') parameters.delete('step');
    else parameters.set('step', next);
    router.push(`${pathname}${parameters.size ? `?${parameters}` : ''}`);
  };
  
  const [newItemName, setNewItemName] = useProgressState('newItemName');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [visibleSearchCount, setVisibleSearchCount] = useState(60);
  


  // Stack per gestionar l'historial de navegació per categories (Deep navigation)
  const [categoryHistory, setCategoryHistory] = useProgressState('categoryHistory');
  const selectedCategory = categoryHistory[categoryHistory.length - 1] || null;
  
  // Estats per dades dinàmiques (inicialitzats amb dades locals per si falla l'API)
  const productCategories = PRODUCT_CATEGORIES;
  const isLoadingSuggestions = false;

  // Nou estat per a resultats de cerca en viu
  const searchResults: ProductDefinition[] = searchInternalCatalog(newItemName);
  const isSearching = false;
  
  // Nou estat per a productes de categoria (dynamic fetch)
  const categoryItems: ProductDefinition[] = selectedCategory ? getInternalCategoryChildren(selectedCategory)
    .map(entry => entry.isGroup ? { ...entry, category: entry.id, unit: 'u' } : entry) : [];
  const isLoadingCategory = false;

  // Refs per gestionar l'scroll en la navegació
  const dropdownRef = useRef<HTMLDivElement>(null);
  const scrollPositions = useRef<Record<number, number>>({});

  // Restore scroll position when navigating back
  useLayoutEffect(() => {
    if (dropdownRef.current && !isLoadingCategory) {
        // If we have a stored position for this level, restore it
        if (scrollPositions.current[categoryHistory.length] !== undefined) {
             // Use requestAnimationFrame to ensure rendering is complete
             const scrollPos = scrollPositions.current[categoryHistory.length];
             requestAnimationFrame(() => {
                if(dropdownRef.current) dropdownRef.current.scrollTop = scrollPos;
             });
        } else {
            // Otherwise (new level), scroll to top
            dropdownRef.current.scrollTop = 0;
        }
    }
  }, [categoryHistory, isLoadingCategory]);

  const [comparisons, setComparisons] = useProgressState('comparisons');
  const [showComparison, setShowComparison] = useProgressState('showComparison');
  const [expandedSupermarkets, setExpandedSupermarkets] = useProgressState('expandedSupermarkets');
  const [comparisonError, setComparisonError] = useProgressState('comparisonError');
  const [assignments, setAssignments] = useProgressState('assignments');
  const comparisonScope = JSON.stringify({ location: area.location, radius: area.radiusMeters,
    stores: area.includedStores.map(store => store.id).sort(), postalCode: area.postalCode,
    items: items.map(item => ({ id: item.id, name: item.name, quantity: item.quantity, unit: item.unit,
      productId: item.productId, catalogProductId: item.catalogProductId, matchMode: item.matchMode, quantityMode: item.quantityMode })) });
  useEffect(() => {
    if (!ready || !storageLoaded || !area.mapsReady || !area.location || area.isSearching || area.isResolvingAddress) return;
    if (!progress.comparisonScope || progress.comparisonScope === comparisonScope) return;
    comparisonRequest.current++;
    setComparisons([]);
    setShowComparison(false);
    setIsComparing(false);
    setComparisonError(null);
    setAssignments({});
    setProgress(previous => ({ ...previous, comparisonScope: null }));
  }, [comparisonScope, ready, storageLoaded, area.mapsReady, area.isSearching, area.isResolvingAddress, progress.comparisonScope]);

  useEffect(() => {
    if (!ready) return;
    const href = `${pathname}${searchParams.size ? `?${searchParams}` : ''}`;
    setProgress(previous => previous.lastListHref === href ? previous : { ...previous, lastListHref: href });
  }, [pathname, searchParams, ready]);

  useLayoutEffect(() => {
    if (!ready || !storageLoaded) return;
    let restored = false;
    let currentScroll = progress.scrollPositions[step.id] || 0;
    const restore = () => {
      if (restored) return;
      window.scrollTo({ top: currentScroll, behavior: 'instant' as ScrollBehavior });
      restored = document.documentElement.scrollHeight - window.innerHeight >= currentScroll - 2;
    };
    const frame = requestAnimationFrame(restore);
    const observer = new ResizeObserver(restore);
    observer.observe(document.body);
    const interrupt = () => { restored = true; currentScroll = window.scrollY; };
    const remember = () => { if (restored) currentScroll = window.scrollY; };
    const save = () => setProgress(previous => ({ ...previous,
      scrollPositions: { ...previous.scrollPositions, [step.id]: currentScroll } }));
    window.addEventListener('scroll', remember, { passive: true });
    window.addEventListener('wheel', interrupt, { passive: true });
    window.addEventListener('touchstart', interrupt, { passive: true });
    window.addEventListener('pagehide', save);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('scroll', remember);
      window.removeEventListener('wheel', interrupt);
      window.removeEventListener('touchstart', interrupt);
      window.removeEventListener('pagehide', save);
      save();
    };
  }, [step.id, ready, storageLoaded]);

  const toggleSupermarketExpansion = (name: string) => {
    setExpandedSupermarkets(prev => 
      prev.includes(name) 
        ? prev.filter(s => s !== name) 
        : [...prev, name]
    );
  };

  // Filtrar suggeriments
  const suggestions = newItemName
    ? searchResults.slice(0, visibleSearchCount)
    : selectedCategory
      ? categoryItems
      : [];

  // Afegir un nou ítem (Wrapper del context)
  const addItem = (itemToAdd?: ProductDefinition) => {
    const product = itemToAdd || searchResults.find(candidate =>
      candidate.name.localeCompare(newItemName.trim(), 'ca', { sensitivity: 'base' }) === 0);
    if (!product?.id || !product.id.startsWith('bossing:')) return;

    contextAddItem({
      name: product.name,
      quantity: product.defaultQuantity || 1,
      unit: product.unit,
      catalogProductId: product.id,
      matchMode: 'generic',
      quantityMode: product.quantityMode || 'amount',
    });

    setNewItemName('');
    // Mantenim les suggerències obertes (o les reobrim) per permetre afegir múltiples ítems ràpidament
    setShowSuggestions(true);
    // Reiniciem l'historial en afegir un item
    setCategoryHistory([]);
  };

  // Comparar preus
  const compareprices = async () => {
    if (!uncheckedItems.length || !area.location || !area.includedStores.length || area.isSearching || area.isLocating || area.isResolvingAddress) return;
    const requestId = ++comparisonRequest.current;
    setProgress(previous => ({ ...previous, comparisonScope }));
    
    setIsComparing(true);
    setComparisons([]);
    setComparisonError(null);
    setAssignments({});
    goToStep('comparison');
    
    try {
        const payload = {
            items: uncheckedItems.map(i => ({ name: i.name, quantity: i.quantity, unit: i.unit, productId: i.productId, catalogProductId: i.catalogProductId,
              matchMode: i.matchMode || 'generic', quantityMode: i.quantityMode || 'amount' })),
            postalCode: area.postalCode,
            stores: area.includedStores,
            maxRadius: area.radiusMeters / 1000,
            location: { lat: area.location.lat, lng: area.location.lng },
            prioritize: 'price'
        };
        
        const res = await fetch('http://localhost:3001/api/optimize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (requestId !== comparisonRequest.current) return;
        if (res.ok) {
            const data = await res.json();
            if (requestId !== comparisonRequest.current) return;
            if (data.meta?.historyStatus === 'unavailable') {
              setComparisonError('Comparació disponible, però no s’ha pogut guardar l’històric de preus.');
            }
            
            const mappedComparisons: PriceComparison[] = data.routes.map((route: any) => ({
              storeId: route.stops[0].supermarket.id,
              address: route.stops[0].supermarket.address,
              distance: route.totalDistance,
                supermarket: route.stops[0].supermarket.name,
                total: route.totalCost,
                subtotal: route.subtotal,
                comparable: route.comparable === true,
                status: route.status,
                items: route.stops[0].items.map((item: any, idx: number) => ({
                    itemId: uncheckedItems[idx].id,
                    productId: item.productId,
                    productName: item.name,
                    price: item.price,
                    quantity: item.quantity || 1,
                    lineTotal: item.lineTotal || (item.price * (item.quantity || 1)),
                    found: item.found !== false && item.price > 0 && !item.name.includes('(No disponible)'),
                    brand: item.brand,
                    image: item.image,
                    pricePerUnit: item.pricePerUnit,
                    unit: item.unit,
                    size: item.size,
                    reason: item.reason,
                    requestedQuantity: item.requestedQuantity,
                    requestedUnit: item.requestedUnit,
                    purchasedQuantity: item.purchasedQuantity,
                    packageSize: item.packageSize,
                    source: item.source,
                    scrapedAt: item.scrapedAt,
                    candidateCount: item.candidateCount,
                    compatibleCount: item.compatibleCount,
                    alternatives: item.alternatives,
                }))
            }));
            
            // Sort by total price
            mappedComparisons.sort((a, b) => {
              if (a.comparable !== b.comparable) return a.comparable ? -1 : 1;
              return a.comparable && b.comparable ? a.total! - b.total! : 0;
            });
            
            setComparisons(mappedComparisons);
            setShowComparison(true);
          } else {
            setComparisonError('No s’ha pogut comparar la llista amb els establiments seleccionats.');
        }
    } catch (e) {
        console.error('Error durant la comparació:', e);
          if (requestId === comparisonRequest.current) setComparisonError('No es pot connectar amb el comparador.');
    } finally {
          if (requestId === comparisonRequest.current) setIsComparing(false);
    }
  };

  const getSupermarketColor = (name: string) => {
    switch (name.toLowerCase()) {
      case 'mercadona':
        return 'bg-green-600';
      case 'consum':
        return 'bg-orange-500';
      case 'carrefour':
        return 'bg-blue-600';
      case 'dia':
        return 'bg-red-500';
      case 'bonpreu':
        return 'bg-orange-600';
      case 'ametller origen':
        return 'bg-amber-600';
      case 'caprabo':
        return 'bg-emerald-600';
      case 'la sirena':
        return 'bg-cyan-600';
      case 'plusfresc':
        return 'bg-purple-600';
      case 'condis':
        return 'bg-yellow-600';
      case 'eroski':
        return 'bg-red-600';
      default:
        return 'bg-gray-500';
    }
  };

  const getSupermarketDisplayName = (name: string) => {
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  const uncheckedItems = items.filter((item) => !item.checked);
  const checkedItems = items.filter((item) => item.checked);
  const plan = createShoppingPlan(comparisons, assignments);
  const selectAlternative = (storeId: string, itemId: string, productId: string) => {
    setComparisons(previous => previous.map(comparison => {
      if (comparison.storeId !== storeId) return comparison;
      const updatedItems = comparison.items.map(item => {
        const alternative = item.itemId === itemId ? item.alternatives?.find(candidate => candidate.productId === productId) : undefined;
        return alternative ? { ...item, ...alternative, productName: alternative.name } : item;
      });
      return { ...comparison, items: updatedItems, total: null, comparable: false,
        subtotal: Math.round(updatedItems.reduce((sum, item) => sum + (item.found ? item.lineTotal : 0), 0) * 100) / 100 };
    }));
  };

  if (!ready || !storageLoaded) return <div role="status" className="p-6"><Loader2 className="w-5 h-5 animate-spin" aria-label="Recuperant la llista" /></div>;

  return (
    <div className="app-page pb-24">
      {/* Header */}
      <header className="page-header px-5 pt-4 pb-7 sm:px-10">
        <div className="border-b border-brand-600/25 pb-3 font-bold text-lg">bossing</div>
        <div className="flex items-center justify-between gap-4 pt-6">
          <div>
            <p className="eyebrow mb-2">La llibreta de la nevera</p>
            <h1 className="font-heading text-4xl sm:text-5xl tracking-tight">{step.title}</h1>
            {step.id === 'list' && <p className="text-sm text-brand-700 mt-3">Que no es quedi res per apuntar.</p>}
          </div>
          <ShoppingBag className="hidden sm:block w-14 h-14 shrink-0 -rotate-6" strokeWidth={1} aria-hidden="true" />
        </div>
      </header>

      <main className="px-4 py-6 space-y-6">
        <nav aria-label="Progrés de la compra">
          <ol className="grid grid-cols-4 border-b border-surface-300">
            {steps.map((candidate, index) => <li key={candidate.id} aria-current={candidate.id === step.id ? 'step' : undefined}
              className={`min-w-0 border-b-2 pb-3 text-center text-xs break-words ${candidate.id === step.id ? 'border-brand-600 font-semibold text-brand-600' : 'border-transparent text-ink-muted'}`}>
              <span className="block font-mono mb-1">{String(index + 1).padStart(2, '0')}</span>{candidate.label}
            </li>)}
          </ol>
        </nav>
        {stepIndex > 0 && <button type="button" onClick={() => goToStep(steps[stepIndex - 1].id)}
          className="inline-flex items-center gap-2 min-h-[44px] text-sm text-brand-600">
          <ArrowLeft className="w-4 h-4" />{steps[stepIndex - 1].label}
        </button>}
        {step.id === 'list' && <>
        <div className="flex items-center justify-between gap-2">
          <p className="eyebrow text-ink-secondary">01 / Apunta el que falta</p>
          <span className="text-xs text-ink-muted">La teva llista, al dia</span>
        </div>
        {/* Afegir nou ítem */}
        <div className="flex gap-2 relative z-20">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-muted" />
            <input
              type="text"
              aria-label="Què necessites comprar?"
              value={newItemName}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              onChange={(e) => {
                  setNewItemName(e.target.value);
                  setVisibleSearchCount(60);
                  setShowSuggestions(true);
              }}
              onKeyPress={(e) => e.key === 'Enter' && addItem()}
              placeholder="Què necessites comprar?"
              className="input pl-10"
              autoComplete="off"
            />
            
            {/* Suggeriments desplegables */}
            {showSuggestions && (
                <div 
                  ref={dropdownRef}
                  className="absolute top-full left-0 right-0 mt-2 bg-[#fffdf6] rounded-sm shadow-lg border border-surface-300 max-h-[350px] overflow-y-auto z-50"
                  onMouseDown={(e) => e.preventDefault()}
                >
                    {newItemName ? (
                        // MODO CERCA
                        <div className="p-2 grid grid-cols-1 gap-1">
                            {!isSearching && suggestions.length > 0 ? (
                                suggestions.map((product) => (
                                    <button
                                        key={product.id}
                                        onClick={() => addItem(product)}
                                        className="flex items-center gap-3 w-full p-2.5 hover:bg-surface-50 rounded-lg transition-colors text-left"
                                    >
                                        <CatalogIcon {...product} />
                                        <div className="flex-1">
                                            <p className="font-semibold text-ink">{product.name}</p>
                                          <p className="text-xs text-ink-secondary">{formatPurchaseQuantity({ ...product, quantity: product.defaultQuantity || 1 })}</p>
                                        </div>
                                        <Plus className="w-4 h-4 text-brand-600" />
                                    </button>
                                ))
                            ) : !isSearching ? (
                                <div className="p-4 text-center text-ink-muted text-sm">
                                    No s&apos;han trobat productes al catàleg.
                                </div>
                            ) : null}
                            {searchResults.length > suggestions.length && <button type="button"
                              onClick={() => setVisibleSearchCount(count => count + 60)}
                              className="flex items-center justify-center gap-2 min-h-[44px] text-sm text-brand-600">
                              <Plus className="w-4 h-4" />Mostra&apos;n més ({suggestions.length} de {searchResults.length})
                            </button>}
                        </div>
                    ) : selectedCategory ? (
                        // MODO ITEMS DE CATEGORIA
                        <div className="p-2">
                             <button 
                                onClick={() => setCategoryHistory(prev => prev.slice(0, -1))}
                                className="flex items-center gap-2 w-full p-2.5 text-ink-secondary hover:text-brand-600 hover:bg-surface-100 rounded-lg mb-2 transition-colors font-semibold border-b border-surface-200"
                             >
                                <ArrowBigLeft className="w-5 h-5" />
                                Tornar enrere
                             </button>
                             
                             {isLoadingCategory ? (
                                <div className="flex justify-center p-8">
                                    <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
                                </div>
                             ) : (
                                <div className="grid grid-cols-1 gap-1">
                                    {suggestions.map((product) => (
                                        <button
                                            key={product.id}
                                            onClick={() => {
                                                if (product.isGroup && product.id) {
                                                    if (dropdownRef.current) {
                                                        scrollPositions.current[categoryHistory.length] = dropdownRef.current.scrollTop;
                                                    }
                                                    delete scrollPositions.current[categoryHistory.length + 1];
                                                    
                                                    setCategoryHistory(prev => [...prev, product.id!]);
                                                } else {
                                                    addItem(product);
                                                }
                                            }}
                                            className="flex items-center gap-3 w-full p-2.5 hover:bg-surface-50 rounded-lg transition-colors text-left"
                                        >
                                            <CatalogIcon {...product} />
                                            <div className="flex-1">
                                                <p className="font-semibold text-ink">{product.name}</p>
                                              {!product.isGroup && <p className="text-xs text-ink-secondary">{formatPurchaseQuantity({ ...product, quantity: product.defaultQuantity || 1 })}</p>}
                                            </div>
                                            {product.isGroup ? (
                                                <ChevronRight className="w-4 h-4 text-ink-muted" />
                                            ) : (
                                                <Plus className="w-4 h-4 text-brand-600" />
                                            )}
                                        </button>
                                    ))}
                                    {suggestions.length === 0 && (
                                        <div className="text-center p-4 text-ink-muted">
                                            No s&apos;han trobat productes en aquesta categoria.
                                        </div>
                                    )}
                                </div>
                             )}
                        </div>
                    ) : (
                        // MODO CATEGORIES
                        <div className="p-3">
                            {isLoadingSuggestions ? (
                                <div className="flex justify-center p-4">
                                    <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
                                </div>
                            ) : (
                                <>
                                    <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2 px-1">
                                        Categories
                                    </h3>
                                    <div className="grid grid-cols-2 gap-2">
                                        {productCategories.map((cat) => (
                                            <button
                                                key={cat.id}
                                                onClick={() => {
                                                    if (dropdownRef.current) {
                                                        scrollPositions.current[0] = dropdownRef.current.scrollTop;
                                                    }
                                                    Object.keys(scrollPositions.current).forEach(key => {
                                                        if (parseInt(key) > 0) delete scrollPositions.current[parseInt(key)];
                                                    });
                                                    
                                                    setCategoryHistory([cat.id]);
                                                }}
                                                className="flex flex-col items-center justify-center p-3 rounded-md gap-2 border border-surface-300 bg-white min-h-[88px]"
                                            >
                                                <CatalogIcon iconUrl={cat.iconUrl} iconPosition={cat.iconPosition} />
                                                <span className="text-xs font-semibold text-ink">{cat.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}
          </div>
          <button
            onClick={() => addItem()}
            aria-label="Afegir producte"
            disabled={!searchResults.some(product => product.name.localeCompare(newItemName.trim(), 'ca', { sensitivity: 'base' }) === 0)}
            className="btn-primary px-4"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {uncheckedItems.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="font-heading text-2xl text-ink">Per comprar</h2>
              <span className="eyebrow text-ink-secondary">{uncheckedItems.length} pendents</span>
            </div>
            <div className="notebook">
              {uncheckedItems.map((item) => (
                <div key={item.id} className="notebook-row">
                  <button
                    onClick={() => toggleChecked(item.id)}
                    aria-label={`Marcar com a comprat: ${item.name}`}
                    aria-pressed={false}
                    className="check-box"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="notebook-name text-ink break-words">{item.name}</p>
                    <p className="text-sm text-ink-secondary">{formatPurchaseQuantity(item)}</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {purchaseUnitOptions(item.unit, item.quantityMode, item.name).length > 1 ?
                      <select aria-label={`Unitat de compra: ${item.name}`} className="max-w-full min-h-[36px] bg-transparent text-xs border-b border-surface-300"
                        value={purchaseDisplayUnit(item)}
                        onChange={event => updatePreferences(item.id, { displayUnit: event.target.value })}>
                        {purchaseUnitOptions(item.unit, item.quantityMode, item.name).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select> : null}
                      {!item.catalogProductId && <select aria-label={`Coincidència: ${item.name}`} className="max-w-full min-h-[36px] bg-transparent text-xs border-b border-surface-300"
                        value={item.matchMode || 'generic'} onChange={event => updatePreferences(item.id, { matchMode: event.target.value as 'generic' | 'exact' })}>
                        <option value="generic">Qualsevol marca</option><option value="exact" disabled={!item.productId}>Producte exacte</option>
                      </select>}
                    </div>
                  </div>
                  <div className="flex items-center shrink-0">
                    <button
                      onClick={() => updateQuantity(item.id, -purchaseQuantityStep(item))}
                      aria-label={`Reduir quantitat: ${item.name}`}
                      disabled={item.quantity <= purchaseQuantityStep(item)}
                      className="w-8 min-h-[44px] flex items-center justify-center hover:bg-surface-200 rounded-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Minus className="w-4 h-4 text-ink-secondary" />
                    </button>
                    <input type="number" inputMode="decimal" aria-label={`Quantitat: ${item.name}`}
                      key={`${item.id}:${item.quantity}:${purchaseDisplayUnit(item)}`}
                      min={(item.quantityMode === 'packages' || item.unit === 'u' ? 1 : 0.001) / purchaseUnitFactor(purchaseDisplayUnit(item))}
                      step={purchaseQuantityStep(item) / purchaseUnitFactor(purchaseDisplayUnit(item))}
                      defaultValue={Math.round(item.quantity / purchaseUnitFactor(purchaseDisplayUnit(item)) * 1000) / 1000}
                      onBlur={event => {
                        const quantity = Math.round(Number(event.target.value) * purchaseUnitFactor(purchaseDisplayUnit(item)) * 1000) / 1000;
                        if (quantity > 0 && (!(item.quantityMode === 'packages' || item.unit === 'u') || Number.isInteger(quantity))) setQuantity(item.id, quantity);
                        else event.target.value = String(Math.round(item.quantity / purchaseUnitFactor(purchaseDisplayUnit(item)) * 1000) / 1000);
                      }}
                      onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }}
                      className="w-14 min-w-0 min-h-[44px] bg-transparent text-center font-mono text-sm border-b border-surface-300" />
                    <button
                      onClick={() => updateQuantity(item.id, purchaseQuantityStep(item))}
                      aria-label={`Augmentar quantitat: ${item.name}`}
                      className="w-8 min-h-[44px] flex items-center justify-center hover:bg-surface-200 rounded-sm transition-colors"
                    >
                      <Plus className="w-4 h-4 text-ink-secondary" />
                    </button>
                  </div>
                  <button
                    onClick={() => removeItem(item.id)}
                    aria-label={`Eliminar producte: ${item.name}`}
                    className="min-h-[44px] px-1.5 text-ink-muted hover:text-danger-600 hover:bg-danger-50 rounded-sm transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {checkedItems.length > 0 && (
          <div className="space-y-2">
            <h2 className="font-heading text-2xl text-ink-secondary">Comprats ({checkedItems.length})</h2>
            <div className="notebook">
              {checkedItems.map((item) => (
                <div key={item.id} className="notebook-row">
                  <button
                    onClick={() => toggleChecked(item.id)}
                    aria-label={`Marcar com a pendent: ${item.name}`}
                    aria-pressed={true}
                    className="check-box checked"
                  >
                    <Check className="w-4 h-4 text-white" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="notebook-name break-words line-through text-ink-muted">{item.name}</p>
                    <p className="text-sm text-ink-muted">{formatPurchaseQuantity(item)}</p>
                  </div>
                  <button
                    onClick={() => removeItem(item.id)}
                    aria-label={`Eliminar producte: ${item.name}`}
                    className="min-h-[44px] px-2 text-ink-muted hover:text-danger-600 hover:bg-danger-50 rounded-sm transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {items.length === 0 && (
          <div className="notebook text-center px-10 py-12">
            <ShoppingBag className="w-10 h-10 text-brand-600 mx-auto mb-4" strokeWidth={1.25} />
            <p className="font-heading text-3xl text-ink">Un full per estrenar.</p>
            <p className="text-sm text-ink-secondary mt-3">
              Què falta a casa? Apunta el primer producte al cercador.
            </p>
          </div>
        )}

        <div className="border-t border-surface-300 pt-5 flex justify-end">
          <button type="button" onClick={() => goToStep('stores')} disabled={!uncheckedItems.length}
            className="btn-primary gap-2 min-h-[48px]">
            Compara supermercats<ChevronRight className="w-4 h-4" />
          </button>
        </div>
        </>}

        {step.id === 'stores' && <>
          <ShoppingAreaControls />
          <StoreSelection compact />
          <div className="sticky bottom-20 z-10 bg-surface-50 border-t border-surface-300 py-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-secondary">{uncheckedItems.length} productes pendents</p>
            <button
              onClick={compareprices}
              disabled={isComparing || !uncheckedItems.length || !area.location || !area.includedStores.length || area.isSearching || area.isLocating || area.isResolvingAddress}
              className="btn-primary gap-2 text-sm px-3 min-h-[48px]"
            >
              {isComparing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <ShoppingCart className="w-4 h-4" />
              )}
              <span>{isComparing ? 'Comparant...' : 'Comparar preus'}</span>
            </button>
          </div>
        </>}

        {step.id === 'comparison' && <>
        {isComparing && <p role="status" className="flex items-center gap-3 py-8 text-ink-secondary"><Loader2 className="w-5 h-5 animate-spin" />Consultant els preus dels supermercats seleccionats...</p>}
        {comparisonError && <p role="alert" className="text-sm text-danger-500">{comparisonError}</p>}
        {!isComparing && !showComparison && <button type="button" onClick={() => goToStep('stores')} className="btn-primary gap-2">
          <ArrowLeft className="w-4 h-4" />Revisar supermercats
        </button>}

        {/* Comparació de preus */}
        {showComparison && comparisons.length > 0 && (
          <div className="overflow-hidden border-y border-surface-300">
            <div className="p-4 border-b border-surface-200">
              <h2 className="font-heading text-2xl text-ink">Comparació de preus</h2>
              <p className="text-sm text-ink-secondary">
                Preus del cataleg en linia per als establiments seleccionats
              </p>
            </div>

            <div className="divide-y divide-surface-200">
              {comparisons.map((comparison, index) => (
                <div key={comparison.storeId} className="flex flex-col">
                  {/* Header de la targeta de supermercat */}
                  <button type="button" aria-expanded={expandedSupermarkets.includes(comparison.storeId)} aria-label={`Productes a ${comparison.supermarket}`}
                    onClick={() => toggleSupermarketExpansion(comparison.storeId)}
                    className={`p-4 text-left w-full ${index === 0 && comparison.comparable ? 'bg-success-50' : 'hover:bg-surface-100'} cursor-pointer transition-colors`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold ${getSupermarketColor(
                          comparison.supermarket
                        )}`}
                      >
                        {comparison.supermarket[0].toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-ink">
                            {getSupermarketDisplayName(comparison.supermarket)}
                          </p>
                          {index === 0 && comparison.comparable && comparisons.some(result => result.comparable && result.total! > comparison.total!) && (
                            <span className="badge badge-green">
                              Millor preu
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-ink-secondary">
                          {comparison.items.filter((i) => i.found).length} de{' '}
                          {comparison.items.length} productes trobats
                          <span className="block text-xs break-words">{comparison.address} · {comparison.distance.toFixed(2)} km</span>
                          {!comparison.comparable && (
                            <span className="block text-xs">
                              {comparison.status === 'source_error' ? comparison.items.some(item => item.found) ? 'Lectura parcial de la font' : 'Error de la font'
                                : comparison.status === 'incomplete' ? 'Cistella incompleta' : 'Equivalència pendent de validar'}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="text-right flex items-center gap-3">
                        <div>
                            <span className="price-tag text-lg">
                              {(comparison.total ?? comparison.subtotal).toFixed(2)} €
                            </span>
                            {!comparison.comparable && <p className="text-xs text-ink-muted">Subtotal no comparable</p>}
                            {index > 0 && comparison.comparable && comparisons[0]?.comparable && (
                              <p className="text-xs text-danger-400 mt-1">
                                +
                                {(comparison.total! - comparisons[0].total!).toFixed(2)}{' '}
                                €
                              </p>
                            )}
                        </div>
                        {expandedSupermarkets.includes(comparison.storeId) ? (
                           <ChevronUp className="w-5 h-5 text-ink-muted" />
                        ) : (
                           <ChevronDown className="w-5 h-5 text-ink-muted" />
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Desglossament de productes */}
                  {expandedSupermarkets.includes(comparison.storeId) && (
                    <div className="bg-surface-100 px-4 pb-4 pt-2 border-t border-surface-200 animate-in slide-in-from-top-2 duration-200">
                        <div className="space-y-3 mt-2">
                             {/* Productes trobats */}
                             {comparison.items.filter(i => i.found).length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-ink-secondary uppercase tracking-wider">Disponibles</p>
                                    {comparison.items.filter(i => i.found).map((item, idx) => (
                                        <div key={`found-${idx}`} className="flex gap-3 text-sm bg-white p-2 rounded-lg border border-surface-300 items-start">
                                            {item.image && (
                                                <img src={item.image} alt={item.productName} className="w-12 h-12 object-contain bg-white rounded-lg border border-surface-300 flex-shrink-0" />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start gap-2">
                                                    <span className="text-ink font-semibold line-clamp-2 leading-tight">{item.productName}</span>
                                                    <div className="text-right flex-shrink-0">
                                                        <span className="price-tag text-base">{item.lineTotal.toFixed(2)} €</span>
                                                        {item.quantity > 1 && (
                                                            <p className="text-xs text-ink-muted whitespace-nowrap">{item.quantity} × {item.price.toFixed(2)} €</p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-xs text-ink-secondary mt-1 flex flex-wrap gap-x-2">
                                                    {item.packageSize && <span>{item.quantity} × {item.packageSize.amount} {item.packageSize.unit}</span>}
                                                    {item.source?.warehouse.startsWith('postal:') && <span>Assortiment {item.source.warehouse.slice(7)}</span>}
                                                    {item.purchasedQuantity !== undefined && item.requestedQuantity !== undefined && item.purchasedQuantity > item.requestedQuantity && (
                                                      <span>Compra: {item.purchasedQuantity} {item.requestedUnit}; demanat: {item.requestedQuantity} {item.requestedUnit}</span>
                                                    )}
                                                    {item.pricePerUnit && (
                                                        <span className="text-ink-muted">({item.pricePerUnit.toFixed(2)} €/{item.unit})</span>
                                                    )}
                                                </div>
                                                {item.alternatives && item.alternatives.length > 0 && <label className="block text-xs text-ink-secondary mt-2">
                                                  {item.compatibleCount} opcions compatibles consultades
                                                  <select aria-label={`Producte a ${comparison.supermarket}: ${items.find(original => original.id === item.itemId)?.name || item.productName}`}
                                                    value={item.productId} onChange={event => selectAlternative(comparison.storeId, item.itemId, event.target.value)}
                                                    className="input mt-1 w-full min-w-0 text-xs">
                                                    {item.alternatives.map(alternative => <option key={alternative.productId} value={alternative.productId}>
                                                      {alternative.name} · {alternative.pricePerUnit.toFixed(2)} €/{alternative.unit} · {alternative.lineTotal.toFixed(2)} €
                                                    </option>)}
                                                  </select>
                                                </label>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                             )}

                             {/* Productes no trobats */}
                             {comparison.items.filter(i => !i.found).length > 0 && (
                                <div className="space-y-2 pt-2">
                                    <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Sense coincidència verificable</p>
                                    {comparison.items.filter(i => !i.found).map((item, idx) => (
                                        <div key={`missing-${idx}`} className="flex justify-between items-center text-sm p-2 rounded-lg border border-surface-300 opacity-60">
                                            <span className="text-ink-secondary">{item.productName.replace(' (No disponible)', '')}</span>
                                            <span className="text-xs text-right text-ink-secondary">
                                              {item.reason === 'source_error' ? 'Error de la font'
                                                : item.reason === 'format' ? 'Unitat o envàs incompatible'
                                                : item.reason === 'identity' ? 'El producte exacte és d’una altra cadena'
                                                : 'Sense variant compatible'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                             )}
                        </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {showComparison && comparisons.length > 0 && <div className="flex justify-end border-t border-surface-300 pt-5">
          <button type="button" onClick={() => goToStep('plan')} className="btn-primary gap-2 min-h-[48px]">
            <ShoppingBag className="w-4 h-4" />Preparar la compra<ChevronRight className="w-4 h-4" />
          </button>
        </div>}
        </>}

        {step.id === 'plan' && <>
          {!comparisons.length && <button type="button" onClick={() => goToStep('stores')} className="btn-primary gap-2">
            <ArrowLeft className="w-4 h-4" />Triar supermercats
          </button>}
          {plan.groups.map(group => <section key={group.store.storeId} aria-label={`Compra a ${group.store.supermarket}`}
            className="border-t border-surface-300 pt-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><h2 className="font-heading text-2xl break-words">{group.store.supermarket}</h2>
                <p className="text-xs text-ink-secondary break-words">{group.store.address}</p></div>
              <span className="shrink-0 font-mono text-lg">{group.subtotal.toFixed(2)} €</span>
            </div>
            <ul className="divide-y divide-surface-200">
              {group.items.map(item => {
                const original = items.find(candidate => candidate.id === item.itemId);
                const choices = comparisons.filter(comparison => comparison.items.some(candidate => candidate.itemId === item.itemId && candidate.found));
                return <li key={item.itemId} className="py-4 space-y-3">
                  <label className="flex items-start gap-3">
                    <input type="checkbox" checked={original?.checked || false} onChange={() => toggleChecked(item.itemId)}
                      aria-label={`Comprat: ${original?.name || item.productName}`} className="mt-1 h-5 w-5 shrink-0 accent-brand-600" />
                    <span className={`min-w-0 flex-1 ${original?.checked ? 'line-through text-ink-muted' : ''}`}>
                      <span className="block font-semibold break-words">{original?.name || item.productName}</span>
                      <span className="block text-sm text-ink-secondary break-words">{item.productName}</span>
                      <span className="block text-xs text-ink-secondary">{item.quantity} envasos{item.packageSize ? ` de ${item.packageSize.amount} ${item.packageSize.unit}` : ''}</span>
                      {item.source?.warehouse.startsWith('postal:') && <span className="block text-xs text-ink-secondary">Assortiment {item.source.warehouse.slice(7)}</span>}
                    </span>
                    <span className="shrink-0 font-mono text-sm">{item.lineTotal.toFixed(2)} €</span>
                  </label>
                  <label className="block text-xs text-ink-secondary">Supermercat per a {original?.name || item.productName}
                    <select className="input mt-1 w-full min-w-0 text-sm" value={group.store.storeId}
                      onChange={event => setAssignments(previous => ({ ...previous, [item.itemId]: event.target.value }))}>
                      {choices.map(choice => <option key={choice.storeId} value={choice.storeId}>
                        {choice.supermarket} · {choice.address} · {choice.items.find(candidate => candidate.itemId === item.itemId)!.lineTotal.toFixed(2)} €
                      </option>)}
                    </select>
                  </label>
                </li>;
              })}
            </ul>
            <a className="inline-flex items-center gap-2 min-h-[44px] text-sm text-brand-600 underline" target="_blank" rel="noopener noreferrer"
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(group.store.address)}&destination_place_id=${encodeURIComponent(group.store.storeId)}`}>
              <MapPin className="w-4 h-4" />Com arribar
            </a>
          </section>)}
          {plan.groups.length > 0 && <p className="text-xs text-ink-secondary">Preus observats del catàleg en línia. Imports per envàs, no preus de caixa certificats.</p>}
          {plan.missing.length > 0 && <section aria-label="Productes sense assignar" className="border-t border-surface-300 pt-4 space-y-3">
            <h2 className="font-heading text-2xl">Sense assignar</h2>
            <ul className="space-y-2">{plan.missing.map(item => <li key={item.itemId} className="text-sm break-words">
              {items.find(candidate => candidate.id === item.itemId)?.name || item.productName.replace(' (No disponible)', '')}
              <span className="block text-xs text-ink-secondary">Sense preu verificat als supermercats seleccionats</span>
            </li>)}</ul>
            <button type="button" onClick={() => goToStep('list')} className="inline-flex items-center gap-2 min-h-[44px] text-sm text-brand-600">
              <ArrowLeft className="w-4 h-4" />Revisar la llista
            </button>
          </section>}
        </>}

      </main>
    </div>
  );
}

export default function ShoppingListPage() {
  return (
    <Suspense
      fallback={
        <div className="app-page flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-brand-600 mx-auto mb-3" />
            <p className="font-heading text-xl text-ink-secondary">Carregant llista...</p>
          </div>
        </div>
      }
    >
      <ShoppingListContent />
    </Suspense>
  );
}
