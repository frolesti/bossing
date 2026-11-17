import type { describe as describeTest, it as itTest } from 'node:test';
import assert from 'node:assert/strict';
import { getLocalBasicFoodId, getLocalCatalogReferences } from './local-catalog.service.js';

declare const describe: typeof describeTest;
declare const it: typeof itTest;

describe('Local-chain product discovery references', () => {
  it('exposes fifteen exact detail references per chain, never archived prices or availability', () => {
    for (const chain of ['bonarea', 'condis', 'sorli']) {
      const references = getLocalCatalogReferences(chain);
      assert.equal(references.length, 15);
      assert.equal(new Set(references.map(reference => reference.productId)).size, 15);
      for (const reference of references) {
        assert.deepEqual(Object.keys(reference).sort(), ['foodId', 'name', 'productId', 'sourceUrl']);
        assert.ok(reference.productId.startsWith(`${chain}-`));
        assert.equal(new URL(reference.sourceUrl).protocol, 'https:');
      }
    }
    assert.deepEqual(getLocalCatalogReferences('unregistered'), []);
  });
  it('resolves known Catalan and Spanish basic names without an external translator or unsafe variants', () => {
    for (const [term, foodId] of [['Llet', 'milk'], ['leche', 'milk'], ['OUS M', 'eggs'], ['pa de motlle', 'bread'],
      ["Oli d'oliva verge extra", 'olive-oil'], ['Arr\u00f2s', 'rice']]) assert.equal(getLocalBasicFoodId(term), foodId);
    for (const term of ['leche sin lactosa', 'pa integral', 'yogur azucarado', 'aigua Viladrau']) assert.equal(getLocalBasicFoodId(term), undefined);
  });
});