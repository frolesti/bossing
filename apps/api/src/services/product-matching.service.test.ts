import { describe, expect, it } from 'vitest';
import type { ScrapedPrice } from '@bossing/shared';
import { cheapestCompatibleProduct, compatibleProduct, genericProductQuery } from './product-matching.service.js';

const milk = (name: string, price: number, amount = 1): ScrapedPrice => ({
  productId: name, name, price, pricePerUnit: price / amount, unit: 'l',
  packageSize: { amount, unit: 'l' }, available: true, scrapedAt: new Date(),
  supermarket: 'Test', supermarketId: 'test', category: 'Milk',
});

describe('Generic grocery comparison across brands', () => {
  it.each([
    ['Sucre blanc', 'Azúcar Blanco Paquete'],
    ['Macarrons', 'Macarrón Hacendado'],
    ['Llenties cuites', 'Lenteja cocida Hacendado'],
    ['Cigrons cuits', 'Garbanzo cocido'],
    ['Pomes', 'Manzanas Golden'],
  ])('matches bilingual grocery names and inflections: %s', (query, name) => {
    expect(compatibleProduct(query, name)).toBe(true);
  });
  it.each(['Coquetes d’arròs', 'Tortitas de arroz', 'Aliment per a gossos amb arròs',
    'Pienso para perros con arroz', 'Arroz con pollo para perros',
    'Menjar gos amb pollastre, arròs, fruites i verdures júnior'])('does not confuse rice ingredients with rice: %s', name => {
    expect(compatibleProduct('Arròs', name)).toBe(false);
  });
  it('keeps prepared-food requests instead of reducing them to an ingredient', () => {
    expect(genericProductQuery('Coquetes d’arròs')).toBe('Coquetes d’arròs');
    expect(compatibleProduct('Arròs', 'Arroz redondo Hacendado')).toBe(true);
  });
  it('finds the cheapest compatible brand by physical unit, not name length or package sticker price', () => {
    const quotes = [milk('Llet desnatada Marca Curta', 1.4), milk('Llet desnatada Marca Llarga', 1.2),
      milk('Leche desnatada Otra Marca', 1.5, 1.5), milk('Leche semidesnatada', 0.6)];
    expect(cheapestCompatibleProduct('Llet desnatada', quotes)?.name).toBe('Leche desnatada Otra Marca');
  });
  it.each(['Leche semidesnatada', 'Leche entera', 'Leche desnatada sin lactosa',
    'Leche desnatada en polvo', 'Bebida vegetal con leche desnatada', 'Chocolate con leche desnatada'])('rejects a different milk variant: %s', name => {
    expect(compatibleProduct('Llet desnatada', name)).toBe(false);
  });
  it('does not confuse bread and pasta or remove required modifiers', () => {
    expect(compatibleProduct('Pa', 'Pasta macarrones')).toBe(false);
    expect(compatibleProduct('Pa de motlle', 'Pan de molde integral')).toBe(false);
    expect(compatibleProduct('Llet sense lactosa', 'Leche semidesnatada sin lactosa')).toBe(true);
    expect(compatibleProduct('Llet sense lactosa', 'Leche semidesnatada')).toBe(false);
  });
  it('derives a brand-independent request while retaining milk and grocery variants', () => {
    expect(genericProductQuery('Leche desnatada Hacendado brik 1 l')).toBe('llet desnatada');
    expect(genericProductQuery('Leche semidesnatada sin lactosa ATO 1 l')).toBe('llet semidesnatada sense lactosa');
    expect(genericProductQuery('Arroz redondo Hacendado')).toContain('arros');
    expect(genericProductQuery('Aigua Viladrau 1,5 l')).toBe('aigua');
  });
  it('never selects unavailable products or missing fixed packaging', () => {
    expect(cheapestCompatibleProduct('Llet', [{ ...milk('Leche', 0.5), available: false },
      { ...milk('Leche', 0.4), packageSize: undefined }])).toBeUndefined();
  });
  it('does not replace bread with breadcrumbs, eggs with utensils, or plain milk with enriched milk', () => {
    for (const name of ['Pan rallado', 'Pa ratllat', 'Pan tostado']) expect(compatibleProduct('Pa', name)).toBe(false);
    expect(compatibleProduct('Pa', 'Pa tradicional 450g')).toBe(true);
    for (const name of ['Mini sarten para freir huevos', 'Huevos plastico canarios', 'Galletas Dinosaurus huevos']) {
      expect(compatibleProduct('Ous', name)).toBe(false);
    }
    expect(compatibleProduct('Llet desnatada', 'Leche desnatada calcio')).toBe(false);
    expect(compatibleProduct('Llet desnatada', 'Leche desnatada omega 3')).toBe(false);
    expect(compatibleProduct('Pa ratllat', 'Pan rallado')).toBe(true);
  });
});