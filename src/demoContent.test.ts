import { describe, expect, it } from 'vitest';
import { demoQrProducts } from './demoContent';

describe('demo QR catalog', () => {
  it('keeps every presentation product independently purchasable without an API response', () => {
    expect(demoQrProducts).toHaveLength(3);
    expect(new Set(demoQrProducts.map(item => item.token)).size).toBe(3);
    expect(demoQrProducts.every(item => item.price > 0 && item.stock > 0 && item.qrUrl?.includes(encodeURIComponent(item.token)))).toBe(true);
  });
});
