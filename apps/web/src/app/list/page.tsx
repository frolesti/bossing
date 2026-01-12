'use client';

import { useState, useEffect, Suspense } from 'react';
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
  Loader2
} from 'lucide-react';
import { COMMON_PRODUCTS, PRODUCT_CATEGORIES, type ProductDefinition } from '@/lib/products';

// Types
interface CategoryDefinition {
    id: string;
    name: string;
    icon: string;
    color: string;
}

// Tipus
interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  checked: boolean;
  prices?: {
    supermarket: string;
    price: number;
    productName: string;
  }[];
}

interface PriceComparison {
  supermarket: string;
  total: number;
  items: {
    itemId: string;
    productName: string;
    price: number;
    found: boolean;
  }[];
}

// Productes de prova per la llista
const INITIAL_ITEMS: ShoppingItem[] = [
  { id: '1', name: 'Llet sencera', quantity: 2, unit: 'L', checked: false },
  { id: '2', name: 'Pa de motlle', quantity: 1, unit: 'u', checked: false },
  { id: '3', name: 'Ous (dotzena)', quantity: 1, unit: 'u', checked: false },
  { id: '4', name: 'Tomàquets', quantity: 500, unit: 'g', checked: false },
  { id: '5', name: 'Formatge ratllat', quantity: 1, unit: 'u', checked: false },
];

// Preus simulats per supermercat
const MOCK_PRICES: Record<string, Record<string, { price: number; name: string }>> = {
  mercadona: {
    '1': { price: 0.85, name: 'Llet sencera Hacendado 1L' },
    '2': { price: 1.15, name: 'Pa de motlle Hacendado' },
    '3': { price: 2.10, name: 'Ous frescos M Hacendado x12' },
    '4': { price: 1.49, name: 'Tomàquets pera 1kg' },
    '5': { price: 1.75, name: 'Formatge ratllat 4 fromatges 200g' },
  },
  consum: {
    '1': { price: 0.89, name: 'Llet sencera Consum 1L' },
    '2': { price: 1.25, name: 'Pa de motlle Consum' },
    '3': { price: 2.29, name: 'Ous L Consum x12' },
    '4': { price: 1.65, name: 'Tomàquet de penjar 1kg' },
    '5': { price: 1.89, name: 'Formatge ratllat mix 200g' },
  },
  carrefour: {
    '1': { price: 0.79, name: 'Llet sencera Carrefour 1L' },
    '2': { price: 1.09, name: 'Pa de motlle Carrefour' },
    '3': { price: 2.19, name: 'Ous frescos L x12' },
    '4': { price: 1.59, name: 'Tomàquet pera 1kg' },
    '5': { price: 1.69, name: 'Formatge ratllat Carrefour 200g' },
  },
  dia: {
    '1': { price: 0.82, name: 'Llet sencera DIA 1L' },
    '2': { price: 0.99, name: 'Pa de motlle DIA' },
    '3': { price: 1.99, name: 'Ous frescos DIA M x12' },
    '4': { price: 1.39, name: 'Tomàquet madur 1kg' },
    '5': { price: 1.59, name: 'Formatge ratllat DIA 200g' },
  },
};

function ShoppingListContent() {
  const searchParams = useSearchParams();
  const supermarketId = searchParams.get('supermarket');

  const [items, setItems] = useState<ShoppingItem[]>(INITIAL_ITEMS);
  const [newItemName, setNewItemName] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
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

  // Filtrar suggeriments
  const suggestions = newItemName
    ? (searchResults.length > 0 ? searchResults : [])
    : selectedCategory
      ? categoryItems
      : [];

  // Afegir un nou ítem
  const addItem = (itemToAdd?: { name: string, unit: string }) => {
    const name = itemToAdd ? itemToAdd.name : newItemName.trim();
    if (!name) return;

    const unit = itemToAdd ? itemToAdd.unit : 'u';

    const newItem: ShoppingItem = {
      id: Date.now().toString(),
      name: name,
      quantity: 1,
      unit: unit,
      checked: false,
    };

    setItems([...items, newItem]);
    setNewItemName('');
    setShowSuggestions(false);
    setSelectedCategory(null);
  };

  // Actualitzar quantitat
  const updateQuantity = (id: string, delta: number) => {
    setItems(
      items.map((item) =>
        item.id === id
          ? { ...item, quantity: Math.max(1, item.quantity + delta) }
          : item
      )
    );
  };

  // Marcar com a comprat
  const toggleChecked = (id: string) => {
    setItems(
      items.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    );
  };

  // Eliminar ítem
  const removeItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  // Comparar preus
  const compareprices = async () => {
    setIsComparing(true);
    setComparisons([]); 
    
    // Supermercats suportats (identificadors del backend)
    const activeSupermarkets = ['mercadona', 'consum']; 

    // Estructura temporal per acumular resultats
    const supermarketData: Record<string, { total: number; items: any[] }> = {};
    activeSupermarkets.forEach(s => {
        supermarketData[s] = { total: 0, items: [] };
    });

    try {
        // Cerquem cada producte de la llista en paral·lel
        await Promise.all(items.map(async (item) => {
            try {
                // Cridem al endpoint de cerca unificada
                const res = await fetch(`http://localhost:3001/api/products/search?q=${encodeURIComponent(item.name)}&limit=50`);
                
                if (res.ok) {
                    const responseJson = await res.json();
                    const products = responseJson.data || [];

                    // Per a cada supermercat, trobem el millor preu
                    activeSupermarkets.forEach(superId => {
                        // Filtrar productes del supermercat actual
                        const candidates = products.filter((p: any) => 
                            p.supermarketId === superId || p.supermarket.toLowerCase() === superId
                        );
                        
                        // Ordenar per preu (els més barats primer)
                        candidates.sort((a: any, b: any) => a.price - b.price);
                        
                        const bestOption = candidates[0];

                        if (bestOption) {
                             // Calcular cost (preu unitari * quantitat)
                             // NOTA: Caldria normalitzar unitats (kg, l, unitats) de forma robusta
                             const cost = bestOption.price * item.quantity;
                             
                             supermarketData[superId].total += cost;
                             supermarketData[superId].items.push({
                                 itemId: item.id,
                                 productName: bestOption.name,
                                 price: cost,
                                 found: true,
                                 image: bestOption.imageUrl
                             });
                        } else {
                            // Producte no trobat en aquest supermercat
                            supermarketData[superId].items.push({
                                itemId: item.id,
                                productName: item.name,
                                price: 0,
                                found: false
                            });
                        }
                    });
                }
            } catch (err) {
                console.error(`Error cercant preus per ${item.name}:`, err);
            }
        }));

        // Convertim l'objecte a l'array PriceComparison[]
        const results: PriceComparison[] = Object.entries(supermarketData).map(([superId, data]) => ({
            supermarket: superId,
            total: data.total,
            items: data.items
        }));

        // Ordenar del més barat al més car
        results.sort((a, b) => a.total - b.total);

        setComparisons(results);
        setShowComparison(true);

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
                                onClick={() => setSelectedCategory(null)}
                                className="flex items-center gap-2 w-full p-2.5 text-gray-500 hover:text-green-600 hover:bg-gray-50 rounded-lg mb-2 transition-colors font-medium border-b border-gray-50"
                             >
                                <ArrowBigLeft className="w-5 h-5" />
                                Tornar a categories
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
                                                    // Si és un grup (L2), naveguem dins d'ell en lloc d'afegir-lo
                                                    setSelectedCategory(product.id);
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
                                                {product.isGroup && <p className="text-xs text-green-600">Veure opcions...</p>}
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
                                                onClick={() => setSelectedCategory(cat.id)}
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
                <div
                  key={comparison.supermarket}
                  className={`p-4 ${index === 0 ? 'bg-green-50' : ''}`}
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
                    <div className="text-right">
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
                  </div>
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
