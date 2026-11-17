import axios from 'axios';
import { calculatePurchaseLine, summarizeBasket, type PurchaseLine } from '@bossing/shared';
import { MercadonaScraper } from '../sources/mercadona.js';

function ok(label: string, value: string | number): void {
  console.log(`OK   ${label}: ${value}`);
}

function fail(label: string, details: string): never {
  throw new Error(`FAIL ${label}: ${details}`);
}

async function run(): Promise<void> {
  const startedAt = Date.now();
  console.log('--- Mercadona exact reference basket ---');
  const scraper = new MercadonaScraper();
  const postalCode = '08001';
  const warehouse = await scraper.setPostalCode(postalCode);
  ok('context', `${postalCode} / ${warehouse} / ${new Date().toISOString()}`);
  const items = [
    { productId: 'merc-10382', name: 'Leche semidesnatada Hacendado', quantity: 2, unit: 'l', packageAmount: 1 },
    { productId: 'merc-5044', name: 'Arroz redondo Hacendado', quantity: 2, unit: 'kg', packageAmount: 1 },
    { productId: 'merc-31505', name: 'Huevos medianos M', quantity: 12, unit: 'ud', packageAmount: 12 },
  ];
  let officialCents = 0;
  const lines: PurchaseLine[] = [];
  for (const item of items) {
    const quote = await scraper.getProductPrice(item.productId);
    const { data: official } = await axios.get(quote.source!.url, {
      params: { lang: 'es', wh: warehouse }, timeout: 15_000,
    });
    if (official.id !== item.productId.slice(5) || official.display_name !== item.name ||
      quote.name !== item.name || quote.packageSize?.amount !== item.packageAmount ||
      quote.packageSize.unit !== item.unit || quote.source?.warehouse !== warehouse) {
      fail(item.productId, 'identity, location or format changed; review the reference basket');
    }
    const line = calculatePurchaseLine(item, quote);
    if (!line.found) fail(item.productId, line.reason);
    const directLineCents = Math.round(Number(official.price_instructions.unit_price) * 100) *
      Math.ceil(item.quantity / item.packageAmount);
    if (line.lineTotalCents !== directLineCents) fail(item.productId, 'official and Bossing line totals differ');
    officialCents += directLineCents;
    lines.push(line);
    ok(item.productId, `${line.packageCount} x ${item.packageAmount} ${item.unit}: ${line.lineTotal.toFixed(2)} EUR`);
  }
  const summary = summarizeBasket(lines, true);
  if (!summary.comparable || summary.totalCost !== officialCents / 100) fail('basket', 'total mismatch');
  ok('Bossing / official REST total', `${summary.totalCost!.toFixed(2)} EUR`);
  const expectedArg = process.argv.find(arg => arg.startsWith('--expected-total-cents='));
  if (expectedArg) {
    const expected = Number(expectedArg.split('=')[1]);
    if (!Number.isSafeInteger(expected) || expected <= 0 || expected !== officialCents) {
      fail('storefront contrast', `observed ${expected} cents; Bossing ${officialCents} cents`);
    }
    ok('independently observed storefront total', `${expected} cents`);
  } else {
    console.log('NOT VERIFIED: storefront total; supply --expected-total-cents after checking the official cart');
  }
  const apiArg = process.argv.find(arg => arg.startsWith('--api-url='));
  if (apiArg) {
    const apiUrl = apiArg.slice('--api-url='.length);
    const { data } = await axios.post(`${apiUrl}/api/optimize`, {
      items, postalCode, supermarketIds: ['mercadona'], location: { lat: 41.3851, lng: 2.1734 },
    }, { timeout: 60_000 });
    const route = data.routes?.[0];
    if (!route?.comparable || route.totalCost !== summary.totalCost || route.foundCount !== items.length) {
      fail('HTTP optimizer', JSON.stringify(route));
    }
    ok('HTTP optimizer total', `${route.totalCost.toFixed(2)} EUR`);
    const center = { lat: 41.3851, lng: 2.1734 };
    const selectedStore = {
      id: 'selection-test-branch', chain: 'mercadona', name: 'Mercadona',
      address: 'HTTP selection test fixture', lat: center.lat + 0.001, lng: center.lng,
    };
    const selectedRequest = { items, postalCode, location: center, maxRadius: 0.25, stores: [selectedStore] };
    const { data: selected } = await axios.post(`${apiUrl}/api/optimize`, selectedRequest, { timeout: 60_000 });
    if (selected.routes?.length !== 1 || selected.meta?.scraperCount !== 1 ||
      selected.routes[0].stops[0].supermarket.id !== selectedStore.id ||
      selected.routes[0].stops[0].supermarket.address !== selectedStore.address ||
      selected.routes[0].totalDistance <= 0 || selected.routes[0].totalDistance > 0.25 ||
      selected.routes[0].pricingScope !== 'online-catalog') {
      fail('establishment selection', JSON.stringify(selected));
    }
    ok('establishment selection', 'one selected branch, actual distance, one chain source');
    if (selected.meta?.historyStatus !== 'scheduled') fail('history mode', 'comparisons must not create unscheduled observations');
    const { data: history } = await axios.get(`${apiUrl}/api/history`, { params: { days: 30 } });
    for (const item of items) {
      const observed = history.series.find((series: any) => series.productId === `catalog:mercadona:${item.productId}`);
      if (!observed?.points.length || observed.warehouse !== warehouse ||
        !observed.points.every((point: any) => Number.isFinite(point.price) && point.price > 0 && !Number.isNaN(Date.parse(point.at)))) {
        fail('history reading', `missing verified observations for ${item.productId}`);
      }
    }
    ok('price history', 'scheduled observations available; comparisons do not add history points');
    for (const radius of [0.049, 2.001]) {
      const response = await axios.post(`${apiUrl}/api/optimize`, { ...selectedRequest, maxRadius: radius },
        { validateStatus: () => true });
      if (response.status !== 400) fail('radius limits', `accepted ${radius} km`);
    }
    for (const radius of [0.05, 2]) {
      const response = await axios.post(`${apiUrl}/api/optimize/preview`, { ...selectedRequest, maxRadius: radius },
        { validateStatus: () => true });
      if (response.status !== 200) fail('radius limits', `rejected ${radius} km`);
    }
    ok('radius limits', '50 m and 2 km accepted; values outside the range rejected');
    const invalidSelections = [
      { label: 'empty selection', stores: [] },
      { label: 'duplicate branch', stores: [selectedStore, selectedStore] },
      { label: 'outside 250m radius', stores: [{ ...selectedStore, lat: center.lat + 0.01 }] },
    ];
    for (const testCase of invalidSelections) {
      const response = await axios.post(`${apiUrl}/api/optimize`, { ...selectedRequest, stores: testCase.stores },
        { timeout: 15_000, validateStatus: () => true });
      if (response.status !== 400) fail(testCase.label, `expected HTTP 400, got ${response.status}`);
      ok(testCase.label, 'rejected before comparison');
    }
    const cases = [
      { label: 'incompatible format', postalCode,
        items: items.map((item, index) => index === 0 ? { ...item, unit: 'kg' } : item) },
      { label: 'product source error', postalCode,
        items: items.map((item, index) => index === 0 ? { ...item, productId: 'merc-999999999' } : item) },
      { label: 'unconfirmed location', postalCode: undefined, items },
    ];
    for (const testCase of cases) {
      const { data: negative } = await axios.post(`${apiUrl}/api/optimize`, {
        items: testCase.items, postalCode: testCase.postalCode,
        supermarketIds: ['mercadona'], location: { lat: 41.3851, lng: 2.1734 },
      }, { timeout: 60_000 });
      const rejected = negative.routes?.[0];
      if (!rejected || rejected.comparable || rejected.totalCost !== null || rejected.estimatedSavings !== 0) {
        fail(testCase.label, 'an unverifiable basket was presented as comparable');
      }
      if (testCase.label === 'product source error' && rejected.status !== 'source_error') {
        fail(testCase.label, 'source failure was hidden as no matches');
      }
      ok(testCase.label, `${rejected.status}; no comparable total or savings`);
    }
  }
  if (process.argv.includes('--catalog')) {
    const catalog = await scraper.loadFullCatalog();
    for (const item of items) {
      if (!catalog.some(product => product.productId === item.productId)) fail('catalog', `missing ${item.productId}`);
    }
    if (new Set(catalog.map(product => product.productId)).size !== catalog.length) fail('catalog', 'duplicate IDs');
    ok('complete REST catalog', catalog.length);
  }
  console.log(`PASS reference basket checks in ${Date.now() - startedAt} ms`);
}

run().catch(err => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(msg);
  process.exitCode = 1;
});
