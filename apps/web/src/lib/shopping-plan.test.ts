import type { describe as describeTest, it as itTest } from 'node:test';
import assert from 'node:assert/strict';
import { createShoppingPlan, type PriceComparison } from './shopping-plan.js';

declare const describe: typeof describeTest;
declare const it: typeof itTest;

const first: PriceComparison = { storeId: 'branch-one', supermarket: 'Condis', address: 'First street', distance: 0.1,
  total: null, subtotal: 4, comparable: false, status: 'unverified', items: [
    { itemId: 'milk', productName: 'Milk', price: 2, quantity: 1, lineTotal: 2, found: true },
    { itemId: 'eggs', productName: 'Eggs', price: 2, quantity: 1, lineTotal: 2, found: true },
    { itemId: 'bread', productName: 'Bread', price: 0, quantity: 1, lineTotal: 0, found: false },
  ] };
const second: PriceComparison = { ...first, storeId: 'branch-two', supermarket: 'Sorli', items: first.items.map(item =>
  item.itemId === 'milk' ? { ...item, price: 1, lineTotal: 1 } : { ...item }) };

describe('Shopping lists grouped by actual store', () => {
  it('assigns each requested line only once using the lowest observed line amount', () => {
    const plan = createShoppingPlan([first, second]);
    assert.deepEqual(plan.groups.map(group => [group.store.storeId, group.items.map(item => item.itemId), group.subtotal]),
      [['branch-two', ['milk'], 1], ['branch-one', ['eggs'], 2]]);
    assert.deepEqual(plan.missing.map(item => item.itemId), ['bread']);
  });
  it('honors manual assignments to individual branches', () => {
    const plan = createShoppingPlan([first, second], { milk: 'branch-one', eggs: 'branch-two' });
    assert.deepEqual(plan.groups.map(group => [group.store.storeId, group.items[0].itemId]), [['branch-one', 'milk'], ['branch-two', 'eggs']]);
  });
  it('never silently assigns unavailable products, invalid prices or a removed branch', () => {
    const invalid = { ...second, items: second.items.map(item => ({ ...item, lineTotal: NaN })) };
    assert.equal(createShoppingPlan([invalid]).groups.length, 0);
    assert.equal(createShoppingPlan([first], { milk: 'removed' }).missing.some(item => item.itemId === 'milk'), true);
    assert.deepEqual(createShoppingPlan([]), { groups: [], missing: [] });
  });
});