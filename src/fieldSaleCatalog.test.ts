import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadFieldSaleProduct, loadFieldSaleProducts } from './fieldSaleCatalog';

const catalog = {
  version: 2,
  products: {
    kendama: { name: '켄다마', image: 'kendama.png', price: 8000, quantity: null, status: 'PAUSED' },
    'dango-keyring': { name: '고양이 당고 키링', image: 'dango-keyring.png', price: 5000, quantity: null, status: 'PAUSED' },
    'octopus-keyring': { name: '양면 문어 키링', image: 'octopus-keyring-photo.jpg', price: 2000, quantity: 8, status: 'PAUSED' },
    'poetry-postcards': { name: '나태주 시 엽서', image: 'poetry-postcards-photo.jpg', price: 1000, quantity: 6, status: 'PAUSED' },
  },
};

afterEach(() => vi.unstubAllGlobals());

describe('registered field-sale catalog', () => {
  it('maps each live QR page to the matching item name, price, image, stock and buy URL', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(catalog), { status: 200 })));
    const result = await loadFieldSaleProducts();
    expect(result.warning).toBe('');
    expect(result.items.map(item => item.name)).toEqual(['켄다마', '고양이 당고 키링', '양면 문어 키링', '나태주 시 엽서']);
    expect(result.items.map(item => item.price)).toEqual([8000, 5000, 2000, 1000]);
    expect(result.items.map(item => item.imageUrl)).toEqual([
      'http://localhost:5173/field-sale/kendama.png',
      'http://localhost:5173/field-sale/dango-keyring.png',
      'http://localhost:5173/field-sale/octopus-keyring-photo.jpg',
      'http://localhost:5173/field-sale/poetry-postcards-photo.jpg',
    ]);
    expect(result.items.map(item => item.qrUrl)).toEqual([
      'http://localhost:5173/?buy=kendama',
      'http://localhost:5173/?buy=dango-keyring',
      'http://localhost:5173/?buy=octopus-keyring',
      'http://localhost:5173/?buy=poetry-postcards',
    ]);
    expect(result.items[0]?.inventoryTracked).toBe(false);
    expect(result.items[2]?.stock).toBe(8);
    expect(result.items.every(item => item.status === 'PAUSED')).toBe(true);
  });

  it('uses the known catalog with a visible freshness warning when the published catalog is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const result = await loadFieldSaleProducts();
    expect(result.items).toHaveLength(6);
    expect(result.warning).toMatch(/최신 상품 정보를 불러오지 못해/);
  });

  it('links the new field products to their own published QR pages', async () => {
    const latest = {
      ...catalog,
      products: {
        ...catalog.products,
        'jjukkumi-keyring': { name: '쭈꾸미 키링', image: 'jjukkumi-keyring-photo.jpg', price: 2000, quantity: 1, status: 'ACTIVE' },
        'tea-coaster': { name: '티코스터', image: 'tea-coaster-photo.jpg', price: 3000, quantity: 2, status: 'ACTIVE' },
      },
    };
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(latest))));
    expect((await loadFieldSaleProducts()).items).toHaveLength(6);
    expect(await loadFieldSaleProduct('jjukkumi-keyring')).toMatchObject({
      name: '쭈꾸미 키링', stock: 1, status: 'ACTIVE', qrUrl: 'http://localhost:5173/?buy=jjukkumi-keyring',
    });
    expect(await loadFieldSaleProduct('tea-coaster')).toMatchObject({
      name: '티코스터', stock: 2, status: 'ACTIVE', qrUrl: 'http://localhost:5173/?buy=tea-coaster',
    });
  });
});
