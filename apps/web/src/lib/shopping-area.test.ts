import type { describe as describeTest, it as itTest } from 'node:test';
import assert from 'node:assert/strict';
import { detectChain, selectedStores, storesInRadius, type AreaLocation, type NearbyStore } from './shopping-area.js';

declare const describe: typeof describeTest;
declare const it: typeof itTest;

const center: AreaLocation = { lat: 41.1189, lng: 1.2445, source: 'device' };
const stores: NearbyStore[] = [
  { id: 'branch-one', name: 'Mercadona', chain: 'mercadona', address: 'First branch',
    lat: center.lat + 0.001, lng: center.lng, distance: 0 },
  { id: 'branch-two', name: 'Mercadona', chain: 'mercadona', address: 'Second branch',
    lat: center.lat + 0.006, lng: center.lng, distance: 0 },
  { id: 'unsupported', name: 'Local shop', chain: 'local', address: 'Third branch',
    lat: center.lat + 0.002, lng: center.lng, distance: 0 },
];

describe('Shared shopping area', () => {
  it('supports a 50-metre radius without including more distant stores', () => {
    const nearest = { ...stores[0], id: 'nearest', lat: center.lat + 0.0004 };
    assert.deepEqual(storesInRadius(center, [nearest, ...stores], 50).map(store => store.id), ['nearest']);
  });
  it('supports a 250-metre radius using the actual center, not fixed Barcelona coordinates', () => {
    assert.deepEqual(storesInRadius(center, stores, 250).map(store => store.id), ['branch-one', 'unsupported']);
    assert.equal(storesInRadius({ ...center, lat: 40 }, stores, 250).length, 0);
  });

  it('excludes a single branch without discarding the other branch of the chain', () => {
    const nearby = storesInRadius(center, stores, 1000);
    assert.deepEqual(selectedStores(nearby, ['branch-one']).map(store => store.id), ['branch-two']);
    assert.equal(selectedStores(nearby, ['branch-one', 'branch-two']).length, 0);
  });

  it('deduplicates place IDs and sorts by actual distance', () => {
    const nearby = storesInRadius(center, [stores[1], stores[0], stores[1]], 1000);
    assert.deepEqual(nearby.map(store => store.id), ['branch-one', 'branch-two']);
    assert.ok(nearby[0].distance > 0);
    assert.ok(nearby[0].distance < nearby[1].distance);
  });

  it('uses the same chain IDs as the comparison API', () => {
    assert.equal(detectChain('Ametller Origen'), 'ametller');
    assert.equal(detectChain('La Sirena'), 'lasirena');
    assert.equal(detectChain('Esclat'), 'bonpreu');
    assert.equal(detectChain('Fruiteria Diagonal'), 'local');
    assert.equal(detectChain('DIA'), 'dia');
    assert.equal(detectChain('Aparcament Mercadona'), 'local');
  });
  it('recognizes the registered Catalan chains and allows selecting their actual branches', () => {
    for (const [name, chain] of [['bon\u00c0rea', 'bonarea'], ['bon area', 'bonarea'], ['Sorli Discau', 'sorli'], ['Condis Express', 'condis'],
      ['Veritas', 'veritas'], ['Supermercat Veritas Eco', 'veritas'], ['Plus Fresc', 'plusfresc']]) {
      assert.equal(detectChain(name), chain);
      const branch = { ...stores[0], id: chain, name, chain };
      assert.deepEqual(selectedStores([branch], []).map(store => store.id), [chain]);
      assert.deepEqual(selectedStores([branch], [chain]), []);
    }
  });
});