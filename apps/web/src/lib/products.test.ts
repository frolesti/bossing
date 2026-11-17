import type { describe as describeTest, it as itTest } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePurchaseQuantity, purchaseUnitOptions, formatPurchaseQuantity, purchaseDisplayUnit, purchaseQuantityStep } from './products.js';

declare const describe: typeof describeTest;
declare const it: typeof itTest;

describe('Purchase units', () => {
  it('only offers the relevant physical measure and packages', () => {
    assert.deepEqual(purchaseUnitOptions('L').map(option => option.value), ['l', 'ml']);
    assert.deepEqual(purchaseUnitOptions('g').map(option => option.value), ['kg', 'g']);
    assert.deepEqual(purchaseUnitOptions('u', 'packages'), [{ value: 'packages', label: 'Envasos' }]);
    assert.deepEqual(purchaseUnitOptions('ud'), [{ value: 'u', label: 'Unitats' }]);
  });
  it('preserves physical quantities when simplifying old measures', () => {
    assert.deepEqual(normalizePurchaseQuantity(500, 'g'), { quantity: 0.5, unit: 'kg' });
    assert.deepEqual(normalizePurchaseQuantity(250, 'ml'), { quantity: 0.25, unit: 'l' });
    assert.deepEqual(normalizePurchaseQuantity(75, 'cl'), { quantity: 0.75, unit: 'l' });
    assert.deepEqual(normalizePurchaseQuantity(12, 'ud'), { quantity: 12, unit: 'u' });
    assert.deepEqual(normalizePurchaseQuantity(2, 'L'), { quantity: 2, unit: 'l' });
    assert.deepEqual(normalizePurchaseQuantity(1, 'dc'), { quantity: 12, unit: 'u' });
    assert.deepEqual(normalizePurchaseQuantity(2, 'dotzenes'), { quantity: 24, unit: 'u' });
  });
  it('does not convert a package count into a volume or weight', () => {
    assert.deepEqual(normalizePurchaseQuantity(3, 'ml', 'packages'), { quantity: 3, unit: 'l' });
    assert.deepEqual(purchaseUnitOptions('u').map(option => option.value), ['u']);
    assert.deepEqual(purchaseUnitOptions('l', 'packages').map(option => option.value), ['packages']);
  });
  it('changes the display measure without changing the underlying demand', () => {
    const eggs = { name: 'Ous M', quantity: 12, unit: 'u' };
    assert.deepEqual(purchaseUnitOptions('u', 'amount', 'Ous M').map(option => option.value), ['u', 'dc']);
    assert.equal(purchaseDisplayUnit(eggs), 'dc');
    assert.equal(formatPurchaseQuantity(eggs), '1 dotzena (12 unitats)');
    assert.equal(formatPurchaseQuantity({ ...eggs, displayUnit: 'u' }), '12 unitats');
    assert.equal(formatPurchaseQuantity({ name: 'Farina', quantity: 0.5, unit: 'kg', displayUnit: 'g' }), '500 g');
    assert.equal(purchaseQuantityStep({ ...eggs, displayUnit: 'u' }), 1);
    assert.equal(purchaseQuantityStep(eggs), 12);
  });
});