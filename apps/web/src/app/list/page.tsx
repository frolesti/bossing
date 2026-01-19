'use client';

import { useState, useEffect, useLayoutEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Minus,
  Trash2,
  Search,
  ShoppingCart,
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
import { COMMON_PRODUCTS, PRODUCT_CATEGORIES, type ProductDefinition } from '@/lib/products';
import { useShoppingList } from '@/context/ShoppingListContext';

// Types
interface CategoryDefinition {
    id: string;
    name: string;
    icon: string;
    color: string;
}

interface PriceComparison {
  supermarket: string;
  total: number;
  items: {
    itemId: string;
    productName: string;
    price: number;
    found: boolean;
    // New detailed fields
    brand?: string;
    image?: string;
    pricePerUnit?: number;
    unit?: string;
    size?: number;
  }[];
}

// MOCK_PRICES Removed. We will fetch from API.
const MOCK_PRICES: Record<string, Record<string, { price: number; name: string }>> = {};

function ShoppingListContent() {
  const searchParams = useSearchParams();
  const supermarketId = searchParams.get('supermarket');

  const { items, addItem: contextAddItem, updateQuantity, toggleChecked, removeItem, clearList } = useShoppingList();
  
  const [newItemName, setNewItemName] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  


  // Stack per gestionar l'historial de navegació per categories (Deep navigation)
  const [categoryHistory, setCategoryHistory] = useState<string[]>([]);
  const selectedCategory = categoryHistory[categoryHistory.length - 1] || null;
  
  // Estats per dades dinàmiques (inicialitzats amb dades locals per si falla l'API)
  const [commonProducts, setCommonProducts] = useState<ProductDefinition[]>(COMMON_PRODUCTS);
  const [productCategories, setProductCategories] = useState<CategoryDefinition[]>(PRODUCT_CATEGORIES as CategoryDefinition[]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  // Nou estat per a resultats de cerca en viu
  const [searchResults, setSearchResults] = useState<ProductDefinition[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Nou estat per a productes de categoria (dynamic fetch)
  const [categoryItems, setCategoryItems] = useState<ProductDefinition[]>([]);
  const [isLoadingCategory, setIsLoadingCategory] = useState(false);

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

  // Efecte per carregar productes quan es selecciona una categoria
  useEffect(() => {
    if (!selectedCategory) {
        setCategoryItems([]);
        return;
    }

    const fetchCategoryGenerics = async () => {
        setIsLoadingCategory(true);
        try {
            // Canviem a l'endpoint de generics (options) en lloc de productes concrets
            const res = await fetch(`http://localhost:3001/api/products/categories/${selectedCategory}/generics`);
            if (res.ok) {
                const data = await res.json();
                // Mapejar al format visual que espera el component
                const mappedDefs: ProductDefinition[] = data.map((g: any) => ({
                   id: g.id, // Guardem l'ID real per si es un grup
                   name: g.name,
                   category: 'general', // Podriem passar la categoria pare
                   unit: 'u', // Unitat per defecte
                   icon: g.icon || '📦',
                   imageUrl: g.image,
                   isGroup: g.isGroup
                }));
                setCategoryItems(mappedDefs);
            }
        } catch (error) {
            console.error('Error fetching category generics:', error);
        } finally {
            setIsLoadingCategory(false);
        }
    };

    fetchCategoryGenerics();
  }, [selectedCategory]);

  // Efecte per cercar a l'API quan l'usuari escriu
  useEffect(() => {
    if (!newItemName || newItemName.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`http://localhost:3001/api/products/search?q=${encodeURIComponent(newItemName)}`);
        if (res.ok) {
          const pagedData = await res.json();
          // Mapejar resultats al format visual
          const mapped: ProductDefinition[] = pagedData.data.map((item: any) => ({
            name: item.name,
            category: item.category || 'pantry',
            unit: item.unit || 'u',
            icon: item.icon || '🔍',
            imageUrl: item.imageUrl
          }));
          setSearchResults(mapped);
        }
      } catch (e) {
        console.error('API search error:', e);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [newItemName]);

  // Carregar suggeriments de l'API (Millora progressiva)
  useEffect(() => {
    const fetchSuggestions = async () => {
        // No mostrem loader si ja tenim dades locals (per evitar flickering)
        if (commonProducts.length === 0) setIsLoadingSuggestions(true);
        
        try {
            // Intentem obtenir ubicació per personalitzar (opcional)
            let query = '';
            if (navigator.geolocation) {
                try {
                    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 });
                    });
                    query = `?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`;
                } catch (e) {
                    console.log('Location access denied or timeout for suggestions');
                }
            }

            // Fetch a l'API
            // Nota: Assumim que l'API està al mateix host o configurada via proxy/env
            // En dev: http://localhost:3001
            const res = await fetch(`http://localhost:3001/api/products/suggestions${query}`);
            if (res.ok) {
                const data = await res.json();
                setCommonProducts(data.products);
                setProductCategories(data.categories);
            }
        } catch (error) {
            console.error('Error fetching suggestions:', error);
            // Fallback dades buides o hardcoded si calgués
        } finally {
            setIsLoadingSuggestions(false);
        }
    };

    fetchSuggestions();
  }, []);

  const [comparisons, setComparisons] = useState<PriceComparison[]>([]);
  const [isComparing, setIsComparing] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [expandedSupermarkets, setExpandedSupermarkets] = useState<string[]>([]);

  const toggleSupermarketExpansion = (name: string) => {
    setExpandedSupermarkets(prev => 
      prev.includes(name) 
        ? prev.filter(s => s !== name) 
        : [...prev, name]
    );
  };

  // Filtrar suggeriments
  const suggestions = newItemName
    ? (searchResults.length > 0 ? searchResults : [])
    : selectedCategory
      ? categoryItems
      : [];

  // Afegir un nou ítem (Wrapper del context)
  const addItem = (itemToAdd?: { name: string, unit: string }) => {
    const name = itemToAdd ? itemToAdd.name : newItemName.trim();
    if (!name) return;

    const unit = itemToAdd ? itemToAdd.unit : 'u';

    contextAddItem({
      name,
      quantity: 1,
      unit,
    });

    setNewItemName('');
    // Mantenim les suggerències obertes (o les reobrim) per permetre afegir múltiples ítems ràpidament
    setShowSuggestions(true);
    // Reiniciem l'historial en afegir un item
    setCategoryHistory([]);
  };

  // Comparar preus
  const compareprices = async () => {
    if (items.length === 0) return;
    
    setIsComparing(true);
    setComparisons([]); 
    
    try {
        const payload = {
            items: items.map(i => ({ name: i.name, quantity: i.quantity })),
            location: { lat: 41.3851, lng: 2.1734 }, 
            prioritize: 'price'
        };
        
        const res = await fetch('http://localhost:3001/api/optimize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (res.ok) {
            const data = await res.json();
            
            const mappedComparisons: PriceComparison[] = data.routes.map((route: any) => ({
                supermarket: route.stops[0].supermarket.name,
                total: route.totalCost,
                items: route.stops[0].items.map((item: any, idx: number) => ({
                    itemId: `api-${idx}`, 
                    productName: item.name,
                    price: item.price,
                    found: item.price > 0 && !item.name.includes('(No disponible)'),
                    brand: item.brand,
                    image: item.image,
                    pricePerUnit: item.pricePerUnit,
                    unit: item.unit,
                    size: item.size
                }))
            }));
            
            // Sort by total price
            mappedComparisons.sort((a, b) => a.total - b.total);
            
            setComparisons(mappedComparisons);
            setShowComparison(true);
        }
    } catch (e) {
        console.error('Error durant la comparació:', e);
    } finally {
        setIsComparing(false);
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
      default:
        return 'bg-gray-500';
    }
  };

  const getSupermarketDisplayName = (name: string) => {
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  const uncheckedItems = items.filter((item) => !item.checked);
  const checkedItems = items.filter((item) => item.checked);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold text-gray-900">Llista de la compra</h1>
          </div>
          <Link
            href="/map"
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <MapPin className="w-5 h-5 text-green-600" />
          </Link>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Afegir nou ítem */}
        <div className="flex gap-2 relative z-20">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={newItemName}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              onChange={(e) => {
                  setNewItemName(e.target.value);
                  setShowSuggestions(true);
              }}
              onKeyPress={(e) => e.key === 'Enter' && addItem()}
              placeholder="Què necessites comprar?"
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none shadow-sm"
              autoComplete="off"
            />
            
            {/* Suggeriments desplegables */}
            {showSuggestions && (
                <div 
                  ref={dropdownRef}
                  className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 max-h-[350px] overflow-y-auto z-50 animate-in fade-in slide-in-from-top-2 duration-200"
                  onMouseDown={(e) => e.preventDefault()} // Evitar que es perdi el focus del input al clicar
                >
                    {newItemName ? (
                        // MODO CERCA
                        <div className="p-2 grid grid-cols-1 gap-1">
                            {isSearching && (
                                <div className="p-3 flex items-center justify-center text-sm text-gray-500 gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Cercant a Mercadona...
                                </div>
                            )}
                            {!isSearching && suggestions.length > 0 ? (
                                suggestions.map((product) => (
                                    <button
                                        key={product.name}
                                        onClick={() => addItem(product)}
                                        className="flex items-center gap-3 w-full p-2.5 hover:bg-green-50 rounded-lg transition-colors text-left"
                                    >
                                        {product.imageUrl ? (
                                            <img src={product.imageUrl} alt={product.name} className="w-10 h-10 object-contain rounded-md bg-white border border-gray-100" />
                                        ) : (
                                            <span className="text-xl">{product.icon}</span>
                                        )}
                                        <div className="flex-1">
                                            <p className="font-medium text-gray-800">{product.name}</p>
                                            {product.category && <p className="text-xs text-gray-400 capitalize">{product.category}</p>}
                                        </div>
                                        <Plus className="w-4 h-4 text-green-600" />
                                    </button>
                                ))
                            ) : !isSearching ? (
                                <div className="p-4 text-center text-gray-400 text-sm">
                                    No s'han trobat productes. Prem Enter per afegir "{newItemName}".
                                </div>
                            ) : null}
                        </div>
                    ) : selectedCategory ? (
                        // MODO ITEMS DE CATEGORIA
                        <div className="p-2">
                             <button 
                                onClick={() => setCategoryHistory(prev => prev.slice(0, -1))}
                                className="flex items-center gap-2 w-full p-2.5 text-gray-500 hover:text-green-600 hover:bg-gray-50 rounded-lg mb-2 transition-colors font-medium border-b border-gray-50"
                             >
                                <ArrowBigLeft className="w-5 h-5" />
                                Tornar enrere
                             </button>
                             
                             {isLoadingCategory ? (
                                <div className="flex justify-center p-8">
                                    <Loader2 className="w-8 h-8 animate-spin text-green-600" />
                                </div>
                             ) : (
                                <div className="grid grid-cols-1 gap-1">
                                    {suggestions.map((product) => (
                                        <button
                                            key={product.name}
                                            onClick={() => {
                                                if (product.isGroup && product.id) {
                                                    // Si és un grup (L2), naveguem dins d'ell en lloc d'afegir-lo (Push to history)
                                                    if (dropdownRef.current) {
                                                        scrollPositions.current[categoryHistory.length] = dropdownRef.current.scrollTop;
                                                    }
                                                    // Esborrar posicions de nivells més profunds per evitar "zombie scrolls"
                                                    delete scrollPositions.current[categoryHistory.length + 1];
                                                    
                                                    setCategoryHistory(prev => [...prev, product.id!]);
                                                } else {
                                                    addItem(product);
                                                }
                                            }}
                                            className="flex items-center gap-3 w-full p-2.5 hover:bg-green-50 rounded-lg transition-colors text-left"
                                        >
                                            {product.imageUrl ? (
                                              <img src={product.imageUrl} alt={product.name} className="w-10 h-10 object-contain rounded-md bg-white border border-gray-100" />
                                            ) : (
                                              <span className="text-xl">{product.icon}</span>
                                            )}
                                            <div className="flex-1">
                                                <p className="font-medium text-gray-800">{product.name}</p>
                                                {/* Text verd eliminat a petició d'usuari */}
                                            </div>
                                            {product.isGroup ? (
                                                <ChevronRight className="w-4 h-4 text-gray-400" />
                                            ) : (
                                                <Plus className="w-4 h-4 text-green-600" />
                                            )}
                                        </button>
                                    ))}
                                    {suggestions.length === 0 && (
                                        <div className="text-center p-4 text-gray-400">
                                            No s'han trobat productes en aquesta categoria.
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
                                    <Loader2 className="w-6 h-6 animate-spin text-green-600" />
                                </div>
                            ) : (
                                <>
                                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
                                        Categories {commonProducts.length > 20 && '(Amb productes locals)'}
                                    </h3>
                                    <div className="grid grid-cols-2 gap-2">
                                        {productCategories.map((cat) => (
                                            <button
                                                key={cat.id}
                                                onClick={() => {
                                                    if (dropdownRef.current) {
                                                        scrollPositions.current[0] = dropdownRef.current.scrollTop;
                                                    }
                                                    // Esborrar posicions persistents anteriors de nivells profunds
                                                    Object.keys(scrollPositions.current).forEach(key => {
                                                        if (parseInt(key) > 0) delete scrollPositions.current[parseInt(key)];
                                                    });
                                                    
                                                    setCategoryHistory([cat.id]);
                                                }}
                                                className={`flex flex-col items-center justify-center p-3 rounded-xl gap-2 transition-all hover:scale-[1.02] active:scale-95 ${cat.color}`}
                                            >
                                                <span className="text-2xl">{cat.icon}</span>
                                                <span className="text-xs font-bold">{cat.name}</span>
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
            disabled={!newItemName.trim()}
            className="px-4 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Resum */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                {items.length} productes · {checkedItems.length} completats
              </p>
            </div>
            <button
              onClick={compareprices}
              disabled={isComparing || items.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {isComparing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <ShoppingCart className="w-4 h-4" />
              )}
              <span>{isComparing ? 'Comparant...' : 'Comparar preus'}</span>
            </button>
          </div>
        </div>

        {/* Comparació de preus */}
        {showComparison && comparisons.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h2 className="font-semibold text-lg">Comparació de preus</h2>
              <p className="text-sm text-gray-500">
                Preus estimats per la teva llista
              </p>
            </div>

            <div className="divide-y divide-gray-100">
              {comparisons.map((comparison, index) => (
                <div key={comparison.supermarket} className="flex flex-col">
                  {/* Header de la targeta de supermercat */}
                  <div
                    onClick={() => toggleSupermarketExpansion(comparison.supermarket)}
                    className={`p-4 ${index === 0 ? 'bg-green-50' : 'hover:bg-gray-50'} cursor-pointer transition-colors`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${getSupermarketColor(
                          comparison.supermarket
                        )}`}
                      >
                        {comparison.supermarket[0].toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">
                            {getSupermarketDisplayName(comparison.supermarket)}
                          </p>
                          {index === 0 && (
                            <span className="px-2 py-0.5 bg-green-600 text-white text-xs rounded-full">
                              Millor preu
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">
                          {comparison.items.filter((i) => i.found).length} de{' '}
                          {items.length} productes trobats
                        </p>
                      </div>
                      <div className="text-right flex items-center gap-3">
                        <div>
                            <p className="text-lg font-bold text-green-600">
                              {comparison.total.toFixed(2)} €
                            </p>
                            {index > 0 && comparisons[0] && (
                              <p className="text-xs text-gray-500">
                                +
                                {(comparison.total - comparisons[0].total).toFixed(2)}{' '}
                                €
                              </p>
                            )}
                        </div>
                        {expandedSupermarkets.includes(comparison.supermarket) ? (
                           <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                           <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Desglossament de productes */}
                  {expandedSupermarkets.includes(comparison.supermarket) && (
                    <div className="bg-gray-50 px-4 pb-4 pt-2 border-t border-gray-100 animate-in slide-in-from-top-2 duration-200">
                        <div className="space-y-3 mt-2">
                             {/* Productes trobats */}
                             {comparison.items.filter(i => i.found).length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Disponibles</p>
                                    {comparison.items.filter(i => i.found).map((item, idx) => (
                                        <div key={`found-${idx}`} className="flex gap-3 text-sm bg-white p-2 rounded-lg border border-gray-100 items-start">
                                            {item.image && (
                                                <img src={item.image} alt={item.productName} className="w-12 h-12 object-contain bg-white rounded-md border border-gray-100 flex-shrink-0" />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start gap-2">
                                                    <span className="text-gray-800 font-medium line-clamp-2 leading-tight">{item.productName}</span>
                                                    <span className="font-bold text-green-700 whitespace-nowrap">{item.price.toFixed(2)} €</span>
                                                </div>
                                                <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-x-2">
                                                    {item.brand && <span className="font-semibold text-gray-600">{item.brand}</span>}
                                                    {item.size && item.unit && <span>{item.size} {item.unit}</span>}
                                                    {item.pricePerUnit && <span className="text-gray-400">({item.pricePerUnit.toFixed(2)} €/{item.unit})</span>}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                             )}

                             {/* Productes no trobats */}
                             {comparison.items.filter(i => !i.found).length > 0 && (
                                <div className="space-y-2 pt-2">
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">No disponibles</p>
                                    {comparison.items.filter(i => !i.found).map((item, idx) => (
                                        <div key={`missing-${idx}`} className="flex justify-between items-center text-sm p-2 rounded-lg border border-dashed border-gray-300 opacity-60">
                                            <span className="text-gray-500 italic">{item.productName.replace(' (No disponible)', '')}</span>
                                            <span className="text-xs bg-gray-200 px-2 py-1 rounded text-gray-500">No trobat</span>
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

        {/* Llista de productes pendents */}
        {uncheckedItems.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-gray-500">
              Per comprar ({uncheckedItems.length})
            </h2>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden divide-y divide-gray-100">
              {uncheckedItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-4 hover:bg-gray-50"
                >
                  <button
                    onClick={() => toggleChecked(item.id)}
                    className="w-6 h-6 rounded-full border-2 border-gray-300 hover:border-green-500 transition-colors flex items-center justify-center"
                  >
                    {item.checked && <Check className="w-4 h-4 text-green-600" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.name}</p>
                    <p className="text-sm text-gray-500">
                      {item.quantity} {item.unit}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-8 text-center font-medium">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Productes comprats */}
        {checkedItems.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-gray-500">
              Comprats ({checkedItems.length})
            </h2>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden divide-y divide-gray-100">
              {checkedItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-4 opacity-60"
                >
                  <button
                    onClick={() => toggleChecked(item.id)}
                    className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center"
                  >
                    <Check className="w-4 h-4 text-white" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate line-through">
                      {item.name}
                    </p>
                  </div>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Estat buit */}
        {items.length === 0 && (
          <div className="text-center py-12">
            <ShoppingCart className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">La llista està buida</p>
            <p className="text-sm text-gray-400 mt-1">
              Afegeix productes per començar a comparar preus
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

export default function ShoppingListPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
        </div>
      }
    >
      <ShoppingListContent />
    </Suspense>
  );
}
