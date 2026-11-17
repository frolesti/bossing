import type { describe as describeTest, it as itTest } from 'node:test';
import assert from 'node:assert/strict';
import { observationFromQuote } from './price-history.service.js';
import type { ScrapedPrice } from '@bossing/shared';
import { BASIC_FOODS, BASIC_REFERENCES, MERCADONA_BASICS, captureDay } from './basic-foods.js';
import { referenceMatches, captureJobId } from './basic-capture.service.js';

declare const describe: typeof describeTest;
declare const it: typeof itTest;

const quote: ScrapedPrice = {
  productId: 'merc-10382', name: 'Milk', supermarket: 'Mercadona', supermarketId: 'mercadona',
  category: 'dairy', price: 0.83, pricePerUnit: 0.83, unit: 'l', available: true,
  scrapedAt: new Date('2026-01-01T10:00:00Z'), packageSize: { amount: 1, unit: 'l' },
  source: { provider: 'mercadona-rest', warehouse: 'bcn1', url: 'https://tienda.mercadona.es/api/products/10382/' },
};

describe('Price history observations', () => {
  it('pins Veritas details and Plusfresc catalogue API to their verified contexts', () => {
    for (const [chain, productId, provider, warehouse, url] of [
      ['veritas', 'veritas-24059', 'veritas-storefront', 'public-catalog', 'https://www.veritas.es/compra/leche-desnatada-ecologica-veritas-1l-24059'],
      ['plusfresc', 'plusfresc-000428', 'plusfresc-rest', 'centre:12;postal:25001', 'https://wscompra.plusfresc.cat/api/search/languages/ca/llet%20desnatada/products/12'],
    ]) {
      const candidate = { ...quote, productId, supermarketId: chain, source: { provider, warehouse, url } };
      assert.equal(observationFromQuote(candidate)!.productId, `catalog:${chain}:${productId}`);
      for (const invalid of [{ ...candidate, supermarketId: 'mercadona' },
        { ...candidate, source: { ...candidate.source, warehouse: 'unverified' } },
        ...[url + '?store=99', url.replace(new URL(url).hostname, 'example.com'), url + '#offer'].map(url => ({
          ...candidate, source: { ...candidate.source, url },
        }))]) assert.equal(observationFromQuote(invalid), null);
      if (chain === 'veritas') assert.equal(observationFromQuote({ ...candidate,
        source: { ...candidate.source, url: url.replace('24059', '99') } }), null);
      else assert.equal(observationFromQuote({ ...candidate,
        source: { ...candidate.source, url: url.replace('/products/12', '/products/99') } }), null);
    }
  });
  it('accepts Catalan-chain detail sources only with exact identities and commercial contexts', () => {
    for (const [chain, productId, url, warehouse] of [
      ['bonarea', 'bonarea-13_9103', 'https://www.bonarea-online.com/online/producto/leche-semidesnatada/13_9103', 'public-catalog'],
      ['condis', 'condis-704004', 'https://compraonline.condis.es/leche-ato-natura-semidesnatada-1-l/p/704004/es_ES', 'public-catalog'],
      ['sorli', 'sorli-1019', 'https://www.sorliclic.com/ca/p/oli-girasol-1l/1019', 'postal:08338'],
    ]) {
      const candidate = { ...quote, productId, supermarketId: chain,
        source: { provider: `${chain}-storefront`, warehouse, url } };
      assert.equal(observationFromQuote(candidate)!.productId, `catalog:${chain}:${productId}`);
      for (const invalid of [{ ...candidate, supermarketId: 'mercadona' },
        { ...candidate, source: { ...candidate.source, warehouse: 'unverified' } },
        ...[`${url}?session=unverified`, `${url}#offer`, url.replace(new URL(url).hostname, 'example.com'),
          url.replace(productId.slice(chain.length + 1), '999')].map(url => ({ ...candidate, source: { ...candidate.source, url } }))]) {
        assert.equal(observationFromQuote(invalid), null);
      }
      assert.equal(observationFromQuote(candidate, 'local-capture')!.id,
        observationFromQuote({ ...candidate, scrapedAt: new Date('2026-01-01T11:00:00Z') }, 'local-capture')!.id);
      if (chain === 'sorli') {
        assert.notEqual(observationFromQuote(candidate)!.id,
          observationFromQuote({ ...candidate, source: { ...candidate.source, warehouse: 'postal:08001' } })!.id);
        assert.equal(observationFromQuote({ ...candidate, source: { ...candidate.source, warehouse: 'public-catalog' } }), null);
      }
    }
  });
  it('accepts verified storefront detail documents without merging their contexts or identities', () => {
    for (const [chain, productId, url] of [
      ['dia', 'dia-504', 'https://www.dia.es/huevos-leche-y-mantequilla/leche/p/504'],
      ['alcampo', 'alcampo-53549', 'https://www.compraonline.alcampo.es/products/auchan-leche-semidesnatada/53549'],
      ['eroski', 'eroski-18672311', 'https://supermercado.eroski.es/en/productdetail/18672311-leche-semidesnatada-del-pais-vasco-eroski-brik-1-litro/'],
      ['aldi', 'aldi-80500', 'https://www.aldi.es/producto/leche-semidesnatada-80500.html'],
      ['carrefour', 'carrefour-521007071', 'https://www.carrefour.es/supermercado/leche-semidesnatada-carrefour-brik-1-l/R-521007071/p'],
    ]) {
      const candidate = { ...quote, productId, supermarketId: chain,
        source: { provider: `${chain}-storefront`, warehouse: 'public-catalog', url } };
      assert.equal(observationFromQuote(candidate)!.productId, `catalog:${chain}:${productId}`);
      for (const invalid of [{ ...candidate, supermarketId: 'mercadona' },
        { ...candidate, source: { ...candidate.source, warehouse: '08001' } },
        ...[`${url}?session=unverified`, `${url}#offer`, url.replace(new URL(url).hostname, 'example.com'),
          url.replace(productId.split('-')[1], '999')].map(url => ({ ...candidate, source: { ...candidate.source, url } }))]) {
        assert.equal(observationFromQuote(invalid), null);
      }
    }
  });
  it('accepts Bonpreu official product documents without claiming an automatic daily capture', () => {
    const url = 'https://www.compraonline.bonpreuesclat.cat/products/bonpreu-llet-semidesnatada-en-cartr%C3%B3/81178';
    const bonpreu = { ...quote, productId: 'bonpreu-81178', supermarket: 'Bonpreu', supermarketId: 'bonpreu',
      source: { provider: 'bonpreu-storefront', warehouse: 'public-catalog', url } };
    assert.equal(observationFromQuote(bonpreu)!.productId, 'catalog:bonpreu:bonpreu-81178');
    for (const invalid of [{ ...bonpreu, supermarketId: 'mercadona' },
      { ...bonpreu, source: { ...bonpreu.source, warehouse: '08001' } },
      ...[url.replace('/81178', '/81179'), url.replace('www.compraonline.bonpreuesclat.cat', 'example.com'),
        `${url}?session=unverified`, 'https://www.compraonline.bonpreuesclat.cat/api/webproductpagews/v6/product-pages/search']
        .map(url => ({ ...bonpreu, source: { ...bonpreu.source, url } }))]) assert.equal(observationFromQuote(invalid), null);
  });
  it('accepts only Ametller detail observations in the pinned official locale and commercial context', () => {
    const url = 'https://www.ametllerorigen.com/mobify/proxy/api/product/shopper-products/v1/organizations/f_ecom_blzv_prd/products/2390?siteId=ametller&currency=EUR&locale=ca';
    const ametller = { ...quote, productId: 'ametller-2390', supermarket: 'Ametller Origen', supermarketId: 'ametller',
      source: { provider: 'ametller-scapi', warehouse: 'public-catalog', url } };
    assert.equal(observationFromQuote(ametller)!.productId, 'catalog:ametller:ametller-2390');
    for (const invalid of [{ ...ametller, supermarketId: 'consum' },
      { ...ametller, source: { ...ametller.source, warehouse: '08001' } },
      ...[url.replace('locale=ca', 'locale=es'), url.replace('/2390?', '/99?'), url.replace('www.ametllerorigen.com', 'example.com'),
        'https://www.ametllerorigen.com/mobify/proxy/api/search/shopper-search/v1/organizations/f_ecom_blzv_prd/product-search?siteId=ametller&currency=EUR&locale=ca&q=llet']
        .map(url => ({ ...ametller, source: { ...ametller.source, url } }))]) assert.equal(observationFromQuote(invalid), null);
  });
  it('binds Caprabo observations to their exact official detail URL and context', () => {
    const caprabo = { ...quote, productId: 'caprabo-18581678', supermarket: 'Caprabo', supermarketId: 'caprabo',
      source: { provider: 'caprabo-storefront', warehouse: 'public-catalog', url: BASIC_REFERENCES.caprabo[0].sourceUrl! } };
    assert.equal(observationFromQuote(caprabo)!.productId, 'catalog:caprabo:caprabo-18581678');
    assert.notEqual(observationFromQuote(caprabo)!.id, observationFromQuote(quote)!.id);
    assert.equal(observationFromQuote({ ...caprabo, source: { ...caprabo.source, warehouse: '08001' } }), null);
    assert.equal(observationFromQuote({ ...caprabo, source: { ...caprabo.source, url: caprabo.source.url.replace('18581678-', '999-') } }), null);
  });
  it('accepts only Consum references bound to the official API and public catalog context', () => {
    const consum = { ...quote, productId: 'consum-5932', supermarket: 'Consum', supermarketId: 'consum',
      source: { provider: 'consum-rest', warehouse: 'public-catalog', url: 'https://tienda.consum.es/api/rest/V1.0/catalog/product/5932' } };
    assert.equal(observationFromQuote(consum)!.productId, 'catalog:consum:consum-5932');
    assert.notEqual(observationFromQuote(consum)!.id, observationFromQuote(quote)!.id);
    for (const invalid of [{ ...consum, supermarketId: 'mercadona' },
      { ...consum, source: { ...consum.source, warehouse: 'bcn1' } },
      { ...consum, source: { ...consum.source, url: 'https://tienda.consum.es/api/rest/V1.0/catalog/product/999' } },
      { ...consum, source: { ...consum.source, url: 'https://example.com/api/rest/V1.0/catalog/product/5932' } }]) {
      assert.equal(observationFromQuote(invalid), null);
    }
  });
  it('defines fifteen distinct basic foods and uses the Madrid commercial date', () => {
    assert.equal(BASIC_FOODS.length, 15);
    assert.equal(new Set(BASIC_FOODS.map(food => food.id)).size, 15);
    assert.deepEqual([...MERCADONA_BASICS.map(reference => reference.foodId)].sort(), BASIC_FOODS.map(food => food.id).sort());
    assert.equal(new Set(MERCADONA_BASICS.map(reference => reference.productId)).size, 15);
    for (const references of Object.values(BASIC_REFERENCES)) {
      const expected = references === BASIC_REFERENCES.ametller ? BASIC_FOODS.filter(food => food.id !== 'bread') : BASIC_FOODS;
      assert.deepEqual(references.map(reference => reference.foodId).sort(), expected.map(food => food.id).sort());
      assert.equal(new Set(references.map(reference => reference.productId)).size, expected.length);
    }
    assert.equal(captureDay(new Date('2026-11-09T23:30:00Z')), '2026-11-10');
    assert.equal(captureDay(new Date('2026-07-09T22:30:00Z')), '2026-07-10');
  });
  it('keeps the original source timestamp and deduplicates repeat reads', () => {
    const observation = observationFromQuote(quote)!;
    assert.equal(observation.recordedAt.toISOString(), '2026-01-01T10:00:00.000Z');
    assert.equal(observation.id, observationFromQuote({ ...quote })!.id);
    assert.equal(observation.price, 0.83);
  });

  it('deduplicates retries of a daily capture without merging different days', () => {
    const later = { ...quote, scrapedAt: new Date('2026-01-01T11:00:00Z') };
    assert.equal(observationFromQuote(quote, 'day-one')!.id, observationFromQuote(later, 'day-one')!.id);
    assert.notEqual(observationFromQuote(quote, 'day-one')!.id, observationFromQuote(later, 'day-two')!.id);
    assert.notEqual(observationFromQuote(quote)!.id, observationFromQuote(later)!.id);
  });

  it('pins product identity, name and packaging without silent substitution', () => {
    const reference = MERCADONA_BASICS[0];
    const pinned = { ...quote, name: reference.name };
    assert.equal(referenceMatches(reference, pinned), true);
    assert.equal(referenceMatches(reference, { ...pinned, productId: 'merc-5044' }), false);
    assert.equal(referenceMatches(reference, { ...pinned, name: 'Different milk' }), false);
    assert.equal(referenceMatches(reference, { ...pinned, packageSize: { amount: 6, unit: 'l' } }), false);
    assert.notEqual(captureJobId('2026-01-01', '08001'), captureJobId('2026-01-02', '08001'));
    assert.notEqual(captureJobId('2026-01-01', '08001'), captureJobId('2026-01-01', '43001'));
  });

  it('separates warehouses, package sizes and observation times', () => {
    const id = observationFromQuote(quote)!.id;
    assert.notEqual(observationFromQuote({ ...quote, source: { ...quote.source!, warehouse: 'mad1' } })!.id, id);
    assert.notEqual(observationFromQuote({ ...quote, packageSize: { amount: 6, unit: 'l' } })!.id, id);
    assert.notEqual(observationFromQuote({ ...quote, scrapedAt: new Date('2026-01-02T10:00:00Z') })!.id, id);
  });

  it('rejects unverified, unavailable and invalid-price observations', () => {
    for (const invalid of [{ ...quote, source: undefined }, { ...quote, available: false },
      { ...quote, price: NaN }, { ...quote, packageSize: undefined },
      { ...quote, source: { ...quote.source!, url: 'https://example.com' } },
      { ...quote, scrapedAt: new Date('invalid') }]) assert.equal(observationFromQuote(invalid), null);
  });
});