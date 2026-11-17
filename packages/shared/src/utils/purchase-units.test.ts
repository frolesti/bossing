import type { describe as describeTest, it as itTest } from 'node:test';
import assert from 'node:assert/strict';
import { calculatePurchaseLine, normalizePurchaseAmount } from './basket.js';
import type { ScrapedPrice } from '../types.js';

declare const describe: typeof describeTest;
declare const it: typeof itTest;

describe('Canonical shopping quantities', () => {
  it('converts real measures without losing counts or stable decimals', () => {
    assert.deepEqual(normalizePurchaseAmount(1, 'dc'), { quantity: 12, unit: 'u' });
    assert.deepEqual(normalizePurchaseAmount(2, 'dotzenes'), { quantity: 24, unit: 'u' });
    assert.deepEqual(normalizePurchaseAmount(820, 'g'), { quantity: 0.82, unit: 'kg' });
    assert.deepEqual(normalizePurchaseAmount(250, 'ml'), { quantity: 0.25, unit: 'l' });
    assert.deepEqual(normalizePurchaseAmount(75, 'cl'), { quantity: 0.75, unit: 'l' });
    assert.equal(normalizePurchaseAmount(1, 'envasos'), undefined);
    assert.equal(normalizePurchaseAmount(1, 'unknown'), undefined);
  });
  it('buys two real six-egg cartons for one dozen, not one egg or twelve cartons', () => {
    const product = { productId: 'actual-eggs', price: 2, available: true, packageSize: { amount: 6, unit: 'u' } } as ScrapedPrice;
    assert.deepEqual(calculatePurchaseLine({ quantity: 1, unit: 'dc' }, product), {
      found: true, packageCount: 2, purchasedQuantity: 1, lineTotalCents: 400, lineTotal: 4,
    });
    assert.deepEqual(calculatePurchaseLine({ quantity: 12, unit: 'u' }, product), {
      found: true, packageCount: 2, purchasedQuantity: 12, lineTotalCents: 400, lineTotal: 4,
    });
  });
});