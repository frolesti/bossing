import type { describe as describeTest, it as itTest } from 'node:test';
import assert from 'node:assert/strict';
import { INTERNAL_CATALOG_CATEGORIES, INTERNAL_CATALOG_PRODUCTS, INTERNAL_CATALOG_IMPORT, getInternalCategoryChildren,
  getInternalProduct, searchInternalCatalog } from './catalog.js';

declare const describe: typeof describeTest;
declare const it: typeof itTest;

describe('Independent internal product catalog', () => {
  it('uses unique immutable internal identities without commercial observations', () => {
    assert.equal(new Set(INTERNAL_CATALOG_PRODUCTS.map(product => product.id)).size, INTERNAL_CATALOG_PRODUCTS.length);
    assert(Object.isFrozen(INTERNAL_CATALOG_PRODUCTS));
    for (const product of INTERNAL_CATALOG_PRODUCTS) {
      assert(product.id.startsWith('bossing:'));
      assert(Object.isFrozen(product));
      assert(Object.isFrozen(product.aliases));
      assert(INTERNAL_CATALOG_CATEGORIES.some(category => category.id === product.category));
      for (const field of ['price', 'available', 'supermarket', 'packageSize', 'source']) assert(!(field in product));
    }
  });
  it('searches Catalan, Spanish, accents and prefixes without network access', () => {
    assert(searchInternalCatalog('ous').some(product => product.id === 'bossing:eggs'));
    assert(searchInternalCatalog('huevos').some(product => product.id === 'bossing:eggs'));
    assert(searchInternalCatalog('arros').some(product => product.id === 'bossing:rice'));
    assert.equal(searchInternalCatalog('llet desnatada')[0].id, 'bossing:milk-skimmed');
    assert(searchInternalCatalog('iog').some(product => product.id === 'bossing:yogurt'));
    assert(!searchInternalCatalog('pa').some(product => product.id === 'bossing:toothpaste'));
    assert.deepEqual(searchInternalCatalog('not-a-catalog-product'), []);
    assert.deepEqual(searchInternalCatalog(''), []);
  });
  it('browses owned categories down to owned products and rejects unknown references', () => {
    assert(getInternalCategoryChildren('bossing-category:dairy').every(entry => entry.isGroup));
    assert(getInternalCategoryChildren('bossing-category:milk').every(entry => !entry.isGroup));
    assert.deepEqual(getInternalCategoryChildren('123'), []);
    assert.equal(getInternalProduct('mercadona-1'), undefined);
    assert.equal(getInternalProduct('bossing:milk-skimmed')?.unit, 'l');
  });
  it('retains the complete captured hierarchy and all original root icon references', () => {
    assert.equal(INTERNAL_CATALOG_IMPORT.coverage.rootCategories, 26);
    assert.equal(INTERNAL_CATALOG_IMPORT.coverage.completedBranches, INTERNAL_CATALOG_IMPORT.coverage.requestedBranches);
    assert.equal(INTERNAL_CATALOG_IMPORT.coverage.completedBranches, 152);
    assert.equal(INTERNAL_CATALOG_IMPORT.coverage.sourceProducts, 4655);
    assert(INTERNAL_CATALOG_PRODUCTS.length >= 4000);
    assert.deepEqual(INTERNAL_CATALOG_IMPORT.coverage.rejected, []);
    const roots = INTERNAL_CATALOG_CATEGORIES.filter(category => !category.parentId && category.id !== 'bossing-category:basics');
    assert.equal(roots.length, 26);
    for (const root of roots) {
      assert(root.iconUrl?.startsWith('https://tienda.mercadona.es/'));
      assert(root.iconPosition);
    }
    for (const category of INTERNAL_CATALOG_CATEGORIES) {
      if (category.parentId) assert(INTERNAL_CATALOG_CATEGORIES.some(parent => parent.id === category.parentId));
    }
  });
});