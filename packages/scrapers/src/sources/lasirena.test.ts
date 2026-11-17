import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import assert from 'node:assert/strict';
import { LaSirenaScraper } from './lasirena.js';

vi.mock('axios', () => ({ default: { get: vi.fn() } }));

describe('La Sirena source failures', () => {
  beforeEach(() => { vi.mocked(axios.get).mockReset(); });

  it('uses the single-package quantity and unconditional official price with provenance', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: [{
      productId: '3139', productName: 'Guisantes Basic',
      'Información complementaria': [JSON.stringify({ desUnidadMedidaEtiq: 'KILOS', cantidadUnidadMedidaEtiq: 0.5 })],
      items: [{ itemId: '3139', measurementUnit: 'un', unitMultiplier: 1,
        sellers: [{ sellerId: '1', commertialOffer: { Price: 1, PriceWithoutDiscount: 2.1, AvailableQuantity: 10 } }] }],
    }] });
    const [quote] = await new LaSirenaScraper().searchProducts('guisantes');
    expect(quote).toMatchObject({ price: 2.1, pricePerUnit: 4.2, available: true,
      packageSize: { amount: 0.5, unit: 'kg' }, source: { provider: 'lasirena-vtex', warehouse: 'public-catalog' } });
  });

  it('propagates HTTP failures instead of reporting an empty successful search', async () => {
    const error = Object.assign(new Error('HTTP 503'), { response: { status: 503 } });
    vi.mocked(axios.get).mockRejectedValue(error);
    await assert.rejects(new LaSirenaScraper().searchProducts('guisantes'), error);
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  it('stops the capture after a blocked request rather than trying more categories', async () => {
    vi.mocked(axios.get).mockRejectedValue(new Error('HTTP 403'));
    await assert.rejects(new LaSirenaScraper().scrapeProducts(), {
      message: 'HTTP 403', partialResults: [],
    });
    expect(axios.get).toHaveBeenCalledTimes(1);
  });
});
