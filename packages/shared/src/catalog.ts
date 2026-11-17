import { catalogSnapshot } from './data/mercadona-catalog.js';

export const INTERNAL_CATALOG_VERSION = 2;

export interface CatalogCategory {
  readonly id: string;
  readonly name: string;
  readonly parentId?: string;
  readonly icon: string;
  readonly color: string;
  readonly iconUrl?: string;
  readonly iconPosition?: string;
  readonly imageUrl?: string;
}

export interface CatalogProduct {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly unit: 'l' | 'kg' | 'u';
  readonly quantityMode: 'amount' | 'packages';
  readonly defaultQuantity: number;
  readonly icon: string;
  readonly aliases: readonly string[];
  readonly categoryIds?: readonly string[];
  readonly imageUrl?: string;
  readonly iconUrl?: string;
  readonly iconPosition?: string;
}

export interface CatalogSourceSnapshot {
  schemaVersion: number;
  capturedAt: string;
  source: { provider: string; url: string; language: string; warehouse: string;
    pricingIncluded: boolean; availabilityIncluded: boolean; assets: string };
  coverage: { rootCategories: number; requestedBranches: number; completedBranches: number;
    sourceProducts: number; importedProducts: number; rejected: readonly unknown[] };
  categories: readonly Omit<CatalogCategory, 'icon' | 'color'>[];
  products: readonly (Omit<CatalogProduct, 'icon'> & { sourceReferences: readonly { productId: string; name: string; url: string }[] })[];
}

export const INTERNAL_CATALOG_IMPORT = Object.freeze({ capturedAt: catalogSnapshot.capturedAt,
  source: Object.freeze(catalogSnapshot.source), coverage: Object.freeze(catalogSnapshot.coverage) });

const categoryRows: [string, string, string, string?][] = [
  ['dairy', 'Lactis i ous', '\u{1F95B}'],
  ['milk', 'Llet', '\u{1F95B}', 'dairy'], ['yogurt', 'Iogurts i postres', '\u{1F963}', 'dairy'],
  ['cheese-eggs', 'Formatges, mantega i ous', '\u{1F9C0}', 'dairy'],
  ['fresh', 'Fruita i verdura', '\u{1F966}'],
  ['fruit', 'Fruita', '\u{1F34E}', 'fresh'], ['vegetables', 'Verdures i hortalisses', '\u{1F955}', 'fresh'],
  ['meat-fish', 'Carn i peix', '\u{1F41F}'],
  ['meat', 'Carn i aus', '\u{1F357}', 'meat-fish'], ['fish', 'Peix i marisc', '\u{1F41F}', 'meat-fish'],
  ['pantry', 'Rebost', '\u{1F96B}'],
  ['grains', 'Arr\u00f2s, pasta i llegums', '\u{1F35A}', 'pantry'],
  ['cooking', 'Oli, conserves i ingredients', '\u{1F96B}', 'pantry'],
  ['breakfast', 'Esmorzar i berenar', '\u{1F963}', 'pantry'],
  ['bakery', 'Pa i forn', '\u{1F956}'], ['drinks', 'Aigua i begudes', '\u{1F4A7}'],
  ['frozen', 'Congelats', '\u{2744}'], ['household', 'Neteja i llar', '\u{1F9F9}'],
  ['hygiene', 'Higiene personal', '\u{1F9F4}'], ['baby', 'Nadons', '\u{1F37C}'],
  ['pets', 'Mascotes', '\u{1F43E}'],
];

const legacyIcons: Record<string, number> = { dairy: 6, milk: 6, yogurt: 11, 'cheese-eggs': 4,
  fresh: 1, fruit: 1, vegetables: 1, 'meat-fish': 2, meat: 3, fish: 2, pantry: 14,
  grains: 13, cooking: 12, breakfast: 7, bakery: 5, drinks: 18, frozen: 17, household: 26, hygiene: 20, baby: 24, pets: 25 };

export const INTERNAL_CATALOG_CATEGORIES: readonly CatalogCategory[] = Object.freeze([
  ...catalogSnapshot.categories.map(category => Object.freeze({ ...category, icon: '', color: 'bg-green-100 text-green-700' })),
  Object.freeze({ id: 'bossing-category:basics', name: 'B\u00e0sics de Bossing', icon: '', color: 'bg-green-100 text-green-700' }),
  ...categoryRows.map(([id, name, icon, parentId]) => {
    const original = catalogSnapshot.categories.find(category => category.id === `bossing-category:import-${legacyIcons[id]}`);
    return Object.freeze({ id: `bossing-category:${id}`, name, icon, color: 'bg-green-100 text-green-700',
      iconUrl: original?.iconUrl, iconPosition: original?.iconPosition,
      parentId: parentId ? `bossing-category:${parentId}` : 'bossing-category:basics' });
  }),
]);

type ProductRow = [id: string, name: string, category: string, unit: CatalogProduct['unit'], aliases?: string, packages?: boolean, quantity?: number];
const productRows: ProductRow[] = [
  ['milk', 'Llet', 'milk', 'l', 'leche'],
  ['milk-whole', 'Llet sencera', 'milk', 'l', 'leche entera'],
  ['milk-semi', 'Llet semidesnatada', 'milk', 'l', 'leche semidesnatada'],
  ['milk-skimmed', 'Llet desnatada', 'milk', 'l', 'leche desnatada'],
  ['milk-lactose-free', 'Llet sense lactosa', 'milk', 'l', 'leche sin lactosa'],
  ['oat-drink', 'Beguda de civada', 'milk', 'l', 'bebida de avena'],
  ['soy-drink', 'Beguda de soja', 'milk', 'l', 'bebida de soja'],
  ['yogurt', 'Iogurt natural', 'yogurt', 'kg', 'yogur natural yogurt', true],
  ['yogurt-sweetened', 'Iogurt natural ensucrat', 'yogurt', 'kg', 'yogur natural azucarado', true],
  ['yogurt-greek', 'Iogurt grec natural', 'yogurt', 'kg', 'yogur griego natural', true],
  ['cream', 'Nata per cuinar', 'yogurt', 'l', 'nata para cocinar'],
  ['eggs', 'Ous', 'cheese-eggs', 'u', 'huevos huevo ou', false, 12],
  ['eggs-m', 'Ous M', 'cheese-eggs', 'u', 'huevos medianos m', false, 12],
  ['eggs-l', 'Ous L', 'cheese-eggs', 'u', 'huevos grandes l', false, 12],
  ['butter', 'Mantega', 'cheese-eggs', 'kg', 'mantequilla'],
  ['fresh-cheese', 'Formatge fresc', 'cheese-eggs', 'kg', 'queso fresco'],
  ['sliced-cheese', 'Formatge en llesques', 'cheese-eggs', 'kg', 'queso lonchas'],
  ['grated-cheese', 'Formatge ratllat', 'cheese-eggs', 'kg', 'queso rallado'],
  ['apples', 'Pomes', 'fruit', 'kg', 'poma manzanas manzana'],
  ['bananas', 'Pl\u00e0tans', 'fruit', 'kg', 'platan platano platanos bananas'],
  ['oranges', 'Taronges', 'fruit', 'kg', 'taronja naranja naranjas'],
  ['lemons', 'Llimones', 'fruit', 'kg', 'llimona limon limones'],
  ['pears', 'Peres', 'fruit', 'kg', 'pera peras'],
  ['strawberries', 'Maduixes', 'fruit', 'kg', 'maduixa fresa fresas'],
  ['grapes', 'Ra\u00efm', 'fruit', 'kg', 'uva uvas'],
  ['avocados', 'Alvocats', 'fruit', 'kg', 'alvocat aguacate aguacates'],
  ['potatoes', 'Patates', 'vegetables', 'kg', 'patata patatas'],
  ['onions', 'Cebes', 'vegetables', 'kg', 'ceba cebolla cebollas'],
  ['carrots', 'Pastanagues', 'vegetables', 'kg', 'pastanaga zanahoria zanahorias'],
  ['tomatoes', 'Tom\u00e0quets', 'vegetables', 'kg', 'tomaquet tomate tomates'],
  ['lettuce', 'Enciam', 'vegetables', 'u', 'lechuga'],
  ['courgettes', 'Carbassons', 'vegetables', 'kg', 'carbasso calabacin calabacines'],
  ['peppers', 'Pebrots vermells', 'vegetables', 'kg', 'pebrot vermell pimiento rojo'],
  ['broccoli', 'Br\u00f2quil', 'vegetables', 'kg', 'brocoli broccoli'],
  ['mushrooms', 'Xampinyons', 'vegetables', 'kg', 'xampinyo champinon champinones'],
  ['chicken-breast', 'Pit de pollastre', 'meat', 'kg', 'pechuga de pollo'],
  ['chicken-thighs', 'Cuixes de pollastre', 'meat', 'kg', 'muslos de pollo'],
  ['pork-loin', 'Llom de porc', 'meat', 'kg', 'lomo de cerdo'],
  ['minced-beef', 'Carn picada de vedella', 'meat', 'kg', 'carne picada de ternera'],
  ['cooked-ham', 'Pernil cuit', 'meat', 'kg', 'jamon cocido'],
  ['turkey-breast', 'Pit de gall dindi', 'meat', 'kg', 'pechuga de pavo'],
  ['salmon', 'Salm\u00f3', 'fish', 'kg', 'salmon'], ['hake', 'Llu\u00e7', 'fish', 'kg', 'merluza'],
  ['cod', 'Bacall\u00e0', 'fish', 'kg', 'bacalao'], ['prawns', 'Gambes', 'fish', 'kg', 'gamba gambas'],
  ['rice', 'Arr\u00f2s', 'grains', 'kg', 'arroz'], ['rice-round', 'Arr\u00f2s rod\u00f3', 'grains', 'kg', 'arroz redondo'],
  ['rice-brown', 'Arr\u00f2s integral', 'grains', 'kg', 'arroz integral'],
  ['rice-basmati', 'Arr\u00f2s basmati', 'grains', 'kg', 'arroz basmati'],
  ['macaroni', 'Macarrons', 'grains', 'kg', 'macarrones pasta'],
  ['spaghetti', 'Espaguetis', 'grains', 'kg', 'espagueti espaguetis spaghetti pasta'],
  ['lentils-cooked', 'Llenties cuites', 'grains', 'kg', 'lentejas cocidas'],
  ['chickpeas-cooked', 'Cigrons cuits', 'grains', 'kg', 'garbanzos cocidos'],
  ['beans-cooked', 'Mongetes blanques cuites', 'grains', 'kg', 'alubias blancas cocidas'],
  ['lentils-dried', 'Llenties seques', 'grains', 'kg', 'lentejas secas'],
  ['chickpeas-dried', 'Cigrons secs', 'grains', 'kg', 'garbanzos secos'],
  ['olive-oil', 'Oli d\u2019oliva', 'cooking', 'l', 'aceite de oliva'],
  ['olive-oil-extra', 'Oli d\u2019oliva verge extra', 'cooking', 'l', 'aceite de oliva virgen extra'],
  ['sunflower-oil', 'Oli de gira-sol', 'cooking', 'l', 'aceite de girasol'],
  ['flour', 'Farina de blat', 'cooking', 'kg', 'harina de trigo'],
  ['sugar', 'Sucre blanc', 'cooking', 'kg', 'azucar blanco'], ['salt', 'Sal fina', 'cooking', 'kg', 'sal fina'],
  ['tomato-crushed', 'Tom\u00e0quet triturat', 'cooking', 'kg', 'tomate triturado'],
  ['tomato-fried', 'Tom\u00e0quet fregit', 'cooking', 'kg', 'tomate frito'],
  ['tuna-tinned', 'Tonyina en oli d\u2019oliva', 'cooking', 'kg', 'atun en aceite de oliva'],
  ['vinegar', 'Vinagre de vi', 'cooking', 'l', 'vinagre de vino'],
  ['stock-chicken', 'Brou de pollastre', 'cooking', 'l', 'caldo de pollo'],
  ['oats', 'Flocs de civada', 'breakfast', 'kg', 'copos de avena'],
  ['coffee', 'Caf\u00e8 molt', 'breakfast', 'kg', 'cafe molido'],
  ['tea', 'Te negre', 'breakfast', 'kg', 'te negro'], ['cocoa', 'Cacau en pols', 'breakfast', 'kg', 'cacao en polvo'],
  ['biscuits', 'Galetes Maria', 'breakfast', 'kg', 'galletas maria'],
  ['jam', 'Melmelada de maduixa', 'breakfast', 'kg', 'mermelada de fresa'],
  ['honey', 'Mel', 'breakfast', 'kg', 'miel'],
  ['bread', 'Pa', 'bakery', 'u', 'pan', true],
  ['bread-sliced', 'Pa de motlle', 'bakery', 'u', 'pan de molde', true],
  ['bread-wholemeal', 'Pa de motlle integral', 'bakery', 'u', 'pan de molde integral', true],
  ['baguette', 'Barra de pa', 'bakery', 'u', 'barra de pan baguette', true],
  ['water', 'Aigua mineral', 'drinks', 'l', 'agua mineral'],
  ['water-sparkling', 'Aigua amb gas', 'drinks', 'l', 'agua con gas'],
  ['orange-juice', 'Suc de taronja', 'drinks', 'l', 'zumo de naranja'],
  ['cola', 'Refresc de cola', 'drinks', 'l', 'refresco de cola'],
  ['beer', 'Cervesa', 'drinks', 'l', 'cerveza'], ['wine-red', 'Vi negre', 'drinks', 'l', 'vino tinto'],
  ['peas-frozen', 'P\u00e8sols congelats', 'frozen', 'kg', 'guisantes congelados'],
  ['spinach-frozen', 'Espinacs congelats', 'frozen', 'kg', 'espinacas congeladas'],
  ['chips-frozen', 'Patates fregides congelades', 'frozen', 'kg', 'patatas fritas congeladas'],
  ['ice-cream', 'Gelat de vainilla', 'frozen', 'l', 'helado de vainilla'],
  ['laundry-liquid', 'Detergent l\u00edquid per a roba', 'household', 'l', 'detergente liquido ropa'],
  ['fabric-softener', 'Suavitzant per a roba', 'household', 'l', 'suavizante ropa'],
  ['dish-soap', 'Rentavaixelles a m\u00e0', 'household', 'l', 'lavavajillas a mano'],
  ['bleach', 'Lleixiu', 'household', 'l', 'lejia'],
  ['toilet-paper', 'Paper higi\u00e8nic', 'household', 'u', 'papel higienico', true],
  ['kitchen-paper', 'Paper de cuina', 'household', 'u', 'papel de cocina', true],
  ['bin-bags', 'Bosses d\u2019escombraries', 'household', 'u', 'bolsas de basura', true],
  ['shampoo', 'Xamp\u00fa', 'hygiene', 'l', 'champu'], ['shower-gel', 'Gel de dutxa', 'hygiene', 'l', 'gel de ducha'],
  ['toothpaste', 'Pasta de dents', 'hygiene', 'u', 'pasta dental dentifrico', true],
  ['hand-soap', 'Sab\u00f3 de mans', 'hygiene', 'l', 'jabon de manos'],
  ['nappies', 'Bolquers', 'baby', 'u', 'bolquer panal panales', true],
  ['baby-wipes', 'Tovalloletes per a nadons', 'baby', 'u', 'toallitas bebe', true],
  ['cat-food', 'Pinso per a gats', 'pets', 'kg', 'pienso gatos'],
  ['dog-food', 'Pinso per a gossos', 'pets', 'kg', 'pienso perros'],
  ['cat-litter', 'Sorra per a gats', 'pets', 'kg', 'arena gatos'],
];

const basicProducts: CatalogProduct[] = productRows.map(
  ([id, name, category, unit, aliases = '', packages = false, quantity = 1]) => Object.freeze({
    id: `bossing:${id}`, name, category: `bossing-category:${category}`, unit,
    quantityMode: packages ? 'packages' as const : 'amount' as const, defaultQuantity: quantity,
    icon: INTERNAL_CATALOG_CATEGORIES.find(candidate => candidate.id === `bossing-category:${category}`)!.icon,
    aliases: Object.freeze(aliases ? [aliases] : []),
  }));

const productKey = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const combinedProducts = new Map<string, CatalogProduct>(basicProducts.map(product => [product.id, product]));
for (const imported of catalogSnapshot.products) {
  const existing = basicProducts.find(product => productKey(product.name) === productKey(imported.name));
  const category = INTERNAL_CATALOG_CATEGORIES.find(candidate => candidate.id === imported.category);
  const previous = combinedProducts.get(existing?.id || imported.id);
  combinedProducts.set(existing?.id || imported.id, Object.freeze({
    id: existing?.id || imported.id, name: existing?.name || imported.name,
    unit: existing?.unit || imported.unit, quantityMode: existing?.quantityMode || imported.quantityMode,
    defaultQuantity: existing?.defaultQuantity || imported.defaultQuantity,
    category: imported.category, categoryIds: Object.freeze([...new Set([...(previous?.categoryIds || []), ...(imported.categoryIds || [imported.category]), ...(existing ? [existing.category] : [])])]),
    icon: '', iconUrl: category?.iconUrl, iconPosition: category?.iconPosition, imageUrl: imported.imageUrl,
    aliases: Object.freeze([...new Set([...(previous?.aliases || []), ...imported.aliases])]),
  }));
}
export const INTERNAL_CATALOG_PRODUCTS: readonly CatalogProduct[] = Object.freeze([...combinedProducts.values()]);

function searchWords(value: string): string[] {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .match(/[a-z0-9]+/g)?.filter(word => !['de', 'd', 'del', 'la', 'el', 'per', 'a', 'amb', 'con'].includes(word)) || [];
}

export function searchInternalCatalog(query: string): CatalogProduct[] {
  const requested = searchWords(query);
  if (!requested.length) return [];
  return INTERNAL_CATALOG_PRODUCTS.filter(product => {
    const candidates = searchWords([product.name, ...product.aliases].join(' '));
    return requested.every(token => candidates.some(candidate => candidate === token || token.length > 2 && candidate.startsWith(token)));
  }).sort((first, second) => Number(productKey(second.name) === productKey(query)) - Number(productKey(first.name) === productKey(query)));
}

export function getInternalProduct(id: string): CatalogProduct | undefined {
  return INTERNAL_CATALOG_PRODUCTS.find(product => product.id === id);
}

export function getInternalCategoryChildren(id: string) {
  const categories = INTERNAL_CATALOG_CATEGORIES.filter(category => category.parentId === id);
  return categories.length ? categories.map(category => ({ ...category, isGroup: true as const }))
    : INTERNAL_CATALOG_PRODUCTS.filter(product => product.category === id || product.categoryIds?.includes(id)).map(product => ({ ...product, isGroup: false as const }));
}