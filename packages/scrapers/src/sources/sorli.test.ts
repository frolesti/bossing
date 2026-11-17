import { describe, expect, it } from 'vitest';
import { normalizeSorliProduct, normalizeSorliSearch } from './sorli.js';

const url = 'https://www.sorliclic.com/ca/p/oli-girasol-1l/1019';
const html = `<body><p>Est\u00e0s veient l'assortiment de 08338</p><p>99,00 \u20ac</p>
  <div class="informacion-producto-detalle"><div><div>KOIPESOL</div><div>Oli Gira-sol 1l</div><div>2,95 \u20ac / L</div>
  <div>Codi del producte: 1019</div><div class="detalle-precio"><span>3,10</span><div class="d-inline"><p>2,95 \u20ac</p></div></div>
  <div><app-selector-unidades-producto><button class="btn-comprar">COMPRAR</button></app-selector-unidades-producto></div></div></div></body>`;

describe('Sorli official detail HTML', () => {
  it('uses the real search identifiers and brands without adopting listing prices or inventing detail URLs', () => {
    expect(normalizeSorliSearch({ articulos: { currentPage: 1, totalResults: 50, hasNext: true,
      results: [{ idArticulo: 1019, descripcion: 'Oli Gira-sol 1l', marca: { descripcion: 'KOIPESOL' }, pvp: 999 }] } }, 1)).toEqual({
      total: 50, hasNext: true, references: [{ productId: 'sorli-1019', name: 'KOIPESOL Oli Gira-sol 1l', classification: '' }],
    });
  });
  it('retains explicit category evidence for variants absent from the commercial name', () => {
    const result = normalizeSorliSearch({ articulos: { currentPage: 1, totalResults: 1, hasNext: false,
      results: [{ idArticulo: 21467, descripcion: 'Llet Movit Desnatada 1l', marca: { descripcion: 'PASCUAL' },
        categoria: { descripcion: 'Llet Calci Desnatada' } }] } }, 1);
    expect(result.references[0]).toMatchObject({ classification: 'Llet Calci Desnatada', name: 'PASCUAL Llet Movit Desnatada 1l' });
  });
  it('rejects repeated pages, stalled pagination and missing search identities', () => {
    for (const articulos of [{ currentPage: 1, totalResults: 1, hasNext: true, results: [] },
      { currentPage: 2, totalResults: 0, hasNext: false, results: [] },
      { currentPage: 1, totalResults: 1, hasNext: false, results: [{ descripcion: 'Sense codi' }] }]) {
      expect(() => normalizeSorliSearch({ articulos }, 1)).toThrow();
    }
  });
  it('binds the product code, current price, fixed package and actual postal assortment', () => {
    expect(normalizeSorliProduct(html, url)).toMatchObject({ productId: 'sorli-1019', name: 'KOIPESOL Oli Gira-sol 1l', price: 2.95,
      packageSize: { amount: 1, unit: 'l' }, source: { provider: 'sorli-storefront', warehouse: 'postal:08338', url } });
  });
  it.each([['Farina 500gr', 0.5, 'kg'], ['Ous 12u', 12, 'ud'], ['Iogurt 125g Pack 4', 0.5, 'kg'],
    ['Farina De Blat Bossa 1k', 1, 'kg'], ['Ous Picaterra m 12 Unt', 12, 'ud'], ['Iogurt Natural 500g Sense Gluten', 0.5, 'kg'],
    ['Pa Motlle Familiar 700g', 0.7, 'kg']])(
    'normalizes explicit packaging %s', (name, amount, unit) => {
      expect(normalizeSorliProduct(html.replace('Oli Gira-sol 1l', String(name)), url).packageSize).toEqual({ amount, unit });
    });
  it('rejects another product, ambiguous postal context, unavailable purchase, variable packages and invalid currency', () => {
    for (const invalid of [html.replace('Codi del producte: 1019', 'Codi del producte: 1020'),
      html.replace('assortiment de 08338', 'assortiment desconegut'), html.replace('</body>', '<p>assortiment de 08001</p></body>'),
      html.replace('class="btn-comprar"', 'disabled class="btn-comprar"'), html.replace('Oli Gira-sol 1l', 'Oli Gira-sol 1l aprox'),
      html.replace('<p>2,95 \u20ac</p>', '<p>2,95 USD</p>'), html.replace('<p>2,95', '<p>0,00')]) {
      expect(() => normalizeSorliProduct(invalid, url)).toThrow();
    }
    expect(() => normalizeSorliProduct(html, url + '?store=other')).toThrow();
  });
});