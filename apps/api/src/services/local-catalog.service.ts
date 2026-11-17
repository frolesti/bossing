import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

const archive = z.object({ chains: z.record(z.object({ observations: z.array(z.tuple([
  z.string(), z.string(), z.string(), z.number(), z.number(), z.string(), z.string(), z.string().url(),
])) })) });

const basicNames: Record<string, string[]> = {
  milk: ['llet', 'leche', 'llet semidesnatada', 'leche semidesnatada'],
  rice: ['arros', 'arroz', 'arros rodo', 'arroz redondo'],
  eggs: ['ous', 'huevos', 'ous m', 'huevos m'],
  flour: ['farina', 'harina', 'farina de blat', 'harina de trigo'],
  sugar: ['sucre', 'azucar', 'sucre blanc', 'azucar blanco'],
  salt: ['sal', 'sal fina'],
  'olive-oil': ['oli oliva', 'oli d oliva', 'oli d oliva verge extra', 'aceite de oliva', 'aceite de oliva virgen extra'],
  'sunflower-oil': ['oli de gira-sol', 'oli de girasol', 'aceite de girasol'],
  pasta: ['macarrons', 'macarrones'],
  lentils: ['llenties', 'llenties cuites', 'lentejas', 'lentejas cocidas'],
  chickpeas: ['cigrons', 'cigrons cuits', 'garbanzos', 'garbanzos cocidos'],
  tomato: ['tomaquet triturat', 'tomate triturado'],
  oats: ['civada', 'flocs de civada', 'avena', 'copos de avena'],
  bread: ['pa', 'pan', 'pa de motlle', 'pan de molde'],
  yogurt: ['iogurt', 'iogurt natural', 'yogur', 'yogur natural'],
};

export function getLocalBasicFoodId(term: string): string | undefined {
  const normalized = term.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/['\u2019]/g, ' ').replace(/\s+/g, ' ').trim();
  return Object.entries(basicNames).find(([, names]) => names.includes(normalized))?.[0];
}

export function getLocalCatalogReferences(chain: string): { foodId: string; productId: string; name: string; sourceUrl: string }[] {
  if (!['bonarea', 'condis', 'sorli'].includes(chain)) return [];
  const catalog = archive.parse(JSON.parse(readFileSync(resolve(__dirname, '../../data/catalan-observations-2026-11-10.json'), 'utf8')));
  return (catalog.chains[chain]?.observations || []).map(([foodId, productId, name, , , , , sourceUrl]) => ({ foodId, productId, name, sourceUrl }));
}