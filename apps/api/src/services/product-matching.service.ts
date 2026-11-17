import type { ScrapedPrice } from '@bossing/shared';

const aliases: Record<string, string> = {
  leche: 'llet', desnatada: 'desnatada', desnatado: 'desnatada', descremada: 'desnatada',
  semidesnatado: 'semidesnatada', entera: 'sencera', entero: 'sencera',
  arroz: 'arros', huevos: 'ous', huevo: 'ous', harina: 'farina', trigo: 'blat',
  azucar: 'sucre', blanco: 'blanc', blanca: 'blanc', aceite: 'oli', girasol: 'girasol',
  macarron: 'macarrons', macarrones: 'macarrons',
  lenteja: 'llenties', lentejas: 'llenties', garbanzo: 'cigrons', garbanzos: 'cigrons',
  cocido: 'cuits', cocida: 'cuits', cocidos: 'cuits', cocidas: 'cuits', cuites: 'cuits',
  poma: 'pomes', manzana: 'pomes', manzanas: 'pomes',
  tortita: 'coquetes', tortitas: 'coquetes', coqueta: 'coquetes',
  pienso: 'pinso', perros: 'gos', perro: 'gos', gossos: 'gos', gatos: 'gat', gats: 'gat',
  tomate: 'tomaquet', triturado: 'triturat', avena: 'civada', copos: 'flocs',
  pan: 'pa', molde: 'motlle', yogur: 'iogurt', yogurt: 'iogurt', agua: 'aigua',
  redondo: 'rodo', virgen: 'verge', ecologico: 'ecologic', ecologica: 'ecologic',
  ecologics: 'ecologic', ecologicas: 'ecologic', organica: 'ecologic',
  duro: 'dur', duros: 'dur', durs: 'dur', codorniz: 'guatlla',
  rallado: 'ratllat', tostado: 'torrat', tostada: 'torrat', calci: 'calcio',
  proteinas: 'proteina', proteines: 'proteina',
  sin: 'sense', integral: 'integral', azucarado: 'ensucrat', azucarada: 'ensucrat',
  polvo: 'pols', condensada: 'condensada', bebida: 'beguda', vegetal: 'vegetal',
};
const stopWords = new Set(['de', 'del', 'd', 'la', 'el', 'els', 'les', 'con', 'amb', 'en']);
const families = new Set(['llet', 'arros', 'ous', 'farina', 'sucre', 'sal', 'oli', 'macarrons',
  'llenties', 'cigrons', 'tomaquet', 'civada', 'pa', 'iogurt', 'aigua']);
const productHeads = new Set([...families, 'coquetes', 'pinso', 'aliment', 'alimento', 'menjar',
  'galetes', 'galletas', 'beguda', 'bebida', 'xocolata', 'chocolate', 'croquetes', 'croquetas',
  'sopa', 'crema', 'snack', 'snacks', 'barreta', 'barrita', 'amanida', 'ensalada']);
const special = ['lactosa', 'pols', 'condensada', 'vegetal', 'ensucrat', 'integral', 'crosta', 'guatlla', 'dur',
  'ratllat', 'torrat', 'calcio', 'omega', 'proteina', 'infantil'];

function words(value: string): string[] {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/gira[ -]sol/g, 'girasol').replace(/\bsemi[\s-]+desnatad[ao]\b/g, 'semidesnatada')
    .match(/[a-z]+/g)?.map(word => aliases[word] || word) || [];
}

export function productSearchQuery(query: string, language: 'ca' | 'es'): string {
  const spanish: Record<string, string> = { llet: 'leche', sencera: 'entera', arros: 'arroz', rodo: 'redondo',
    ous: 'huevos', farina: 'harina', blat: 'trigo', sucre: 'azucar', oli: 'aceite', verge: 'virgen',
    macarrons: 'macarrones', llenties: 'lentejas', cigrons: 'garbanzos', cuits: 'cocidos',
    tomaquet: 'tomate', triturat: 'triturado', civada: 'avena', flocs: 'copos', pa: 'pan', motlle: 'molde',
    iogurt: 'yogur', aigua: 'agua', sense: 'sin', pols: 'polvo', ecologic: 'ecologico' };
  return words(query).map(token => language === 'es' ? spanish[token] || token : token).join(' ');
}

export function genericProductQuery(name: string): string {
  const tokens = words(name);
  const family = tokens.find(token => productHeads.has(token));
  if (!family || !families.has(family)) return name.trim();
  const attributes: Record<string, string[]> = {
    llet: ['desnatada', 'semidesnatada', 'sencera', 'sense', 'lactosa', 'pols', 'condensada', 'fresca', 'ecologic'],
    arros: ['integral', 'rodo', 'largo', 'llarg', 'basmati'],
    ous: ['m', 'l', 'xl', 'ecologics', 'camperos'], farina: ['blat', 'integral'],
    oli: ['oliva', 'girasol', 'verge', 'extra'], pa: ['motlle', 'integral', 'sense', 'crosta'],
    iogurt: ['natural', 'ensucrat', 'sense', 'lactosa'],
    llenties: ['cuits'], cigrons: ['cuits'], tomaquet: ['triturat'], civada: ['flocs'],
  };
  return [family, ...new Set(tokens.filter(token => [...(attributes[family] || []), ...special].includes(token)))].join(' ');
}

export function compatibleProduct(query: string, name: string): boolean {
  const requested = words(query).filter(token => !stopWords.has(token));
  const candidate = words(name);
  if (!requested.length || !requested.every(token => candidate.includes(token))) return false;
  const family = requested.find(token => families.has(token));
  if (family && candidate.find(token => productHeads.has(token)) !== family) return false;
  if (candidate.some(token => ['gos', 'gat', 'mascota', 'mascotas'].includes(token)) &&
    !requested.some(token => ['gos', 'gat', 'mascota', 'mascotas'].includes(token))) return false;
  if (special.some(token => candidate.includes(token) && !requested.includes(token))) return false;
  if (candidate.some(token => ['sarten', 'plastic', 'plastico', 'ponedora', 'galletas', 'galetes'].includes(token)) &&
    !requested.some(token => ['sarten', 'plastic', 'plastico', 'ponedora', 'galletas', 'galetes'].includes(token))) return false;
  if (requested.includes('llet') && candidate.some(token => ['batut', 'batido', 'preparat', 'preparado', 'crema', 'chocolate', 'xocolata'].includes(token))) return false;
  return true;
}

export function cheapestCompatibleProduct(query: string, products: ScrapedPrice[]): ScrapedPrice | undefined {
  return products.filter(product => compatibleProduct(query, product.name) && product.available &&
    Number.isFinite(product.price) && product.price > 0 && product.packageSize &&
    Number.isFinite(product.packageSize.amount) && product.packageSize.amount > 0)
    .sort((first, second) => first.price / first.packageSize!.amount - second.price / second.packageSize!.amount ||
      first.price - second.price || first.productId.localeCompare(second.productId))[0];
}