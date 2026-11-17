import { afterEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { BonareaScraper, discoverBonareaProducts, normalizeBonareaProduct } from './bonarea.js';

afterEach(() => { vi.restoreAllMocks(); });

const url = 'https://www.bonarea-online.com/online/producto/leche-semidesnatada/13_9103';
const html = `<div class="detail detail-page"><div class="content-title"><h1 class="title">Leche semidesnatada</h1><div class="subtitle">1,5 l</div></div>
<div class="content-price"><span class="h2 bold">1,67 \u20ac/u</span><span class="price-kl">(1,11 \u20ac/l)</span></div>
<input id="articleId0" value="13*9103"><a id="lnkArticleBeforeBuy0" onclick="modifArticleCart(0,'13*9103','1')" style="display:">Comprar</a></div>`;

describe('bonArea official product HTML', () => {
  const card = `<a class="article-link" data-identifier="13*9103" data-friendly="${url}"><div class="text"><p>Leche semidesnatada</p></div></a>`;
  it('discovers exact detail links across brands without using listing prices or duplicate cards', () => {
    const second = card.replaceAll('13*9103', '13*9056').replaceAll('13_9103', '13_9056').replace('semidesnatada</p>', 'desnatada Marca</p>');
    expect(discoverBonareaProducts(card + card + second + '<span>0,01 EUR</span>', 'leche')).toHaveLength(2);
    expect(discoverBonareaProducts(card + second, 'leche desnatada')).toEqual([{ productId: 'bonarea-13_9056', sourceUrl: url.replace('13_9103', '13_9056') }]);
    expect(() => discoverBonareaProducts(card.replace('13*9103', '13*99'), 'leche')).toThrow('identity');
    expect(() => discoverBonareaProducts(card.replace('www.bonarea-online.com', 'example.com'), 'leche')).toThrow();
  });
  it('reads discovered details as the sole price source and propagates network failures', async () => {
    const scraper = new BonareaScraper();
    const search = vi.spyOn(axios, 'get').mockResolvedValueOnce({ data: card });
    const detail = vi.spyOn(scraper, 'getProductPrice').mockResolvedValue(normalizeBonareaProduct(html, url));
    expect(await scraper.searchProducts('leche')).toHaveLength(1);
    expect(search).toHaveBeenCalledWith('https://www.bonarea-online.com/es/shop/find?searchWords=leche', expect.anything());
    expect(detail).toHaveBeenCalledWith('bonarea-13_9103', url);
    search.mockRejectedValueOnce(new Error('Source offline'));
    await expect(scraper.searchProducts('leche')).rejects.toThrow('Source offline');
  });
  it('filters incompatible discovery cards before reading prices and preserves valid partial results on a network failure', async () => {
    const second = card.replaceAll('13*9103', '13*9056').replaceAll('13_9103', '13_9056').replace('semidesnatada</p>', 'desnatada</p>');
    expect(discoverBonareaProducts(card + second, 'leche', name => !name.includes('semidesnatada'))).toHaveLength(1);
    vi.spyOn(axios, 'get').mockResolvedValue({ data: card + second });
    const scraper = new BonareaScraper();
    const quote = normalizeBonareaProduct(html, url);
    vi.spyOn(scraper, 'getProductPrice').mockResolvedValueOnce(quote).mockRejectedValueOnce(new axios.AxiosError('Timeout'));
    await expect(scraper.searchProducts('leche')).rejects.toMatchObject({ partialResults: [quote] });
  });
  it('binds the actual detail price and fixed package to the exact purchase SKU', () => {
    const quote = normalizeBonareaProduct(html, url);
    expect(quote).toMatchObject({ productId: 'bonarea-13_9103', price: 1.67, packageSize: { amount: 1.5, unit: 'l' },
      source: { provider: 'bonarea-storefront', warehouse: 'public-catalog', url } });
    expect(quote.pricePerUnit).toBeCloseTo(1.67 / 1.5);
  });
  it('accepts the observed single-decimal euro prices without accepting extra precision', () => {
    expect(normalizeBonareaProduct(html.replace('1,67', '0,9'), url).price).toBe(0.9);
    expect(() => normalizeBonareaProduct(html.replace('1,67', '0,999'), url)).toThrow();
  });
  it.each([['500 g', 0.5, 'kg'], ['820 g', 0.82, 'kg'], ['12 u.', 12, 'ud'], ['6 l', 6, 'l']])('normalizes explicit packaging %s', (size, amount, unit) => {
    expect(normalizeBonareaProduct(html.replace('1,5 l', size), url).packageSize).toEqual({ amount, unit });
  });
  it('rejects approximate packages, wrong identity, hidden buy controls and non-euro prices', () => {
    for (const invalid of [html.replace('1,5 l', 'aprox. 1,5 l'), html.replace('value="13*9103"', 'value="13*99"'),
      html.replace("'13*9103','1'", "'13*99','1'"), html.replace('style="display:"', 'style="display:none"'),
      html.replace('1,67 \u20ac/u', '1,67 USD/u'), html.replace('1,67 \u20ac/u', '0,00 \u20ac/u'), html + html]) {
      expect(() => normalizeBonareaProduct(invalid, url)).toThrow();
    }
    expect(() => normalizeBonareaProduct(html, url.replace('www.bonarea-online.com', 'example.com'))).toThrow();
    expect(() => normalizeBonareaProduct(html, url + '?context=unknown')).toThrow();
  });
});