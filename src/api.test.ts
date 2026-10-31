import { describe, expect, it } from 'vitest';
import { normalizeQrProduct } from './api';

describe('QR product normalization', () => {
  it('keeps the product token connected to its QR purchase page', () => {
    const product = normalizeQrProduct('demo-mug-white-gray', {
      saleStatus: 'active',
      product: {
        artworkId: '0-0',
        name: '머그컵',
        artist: '김서연',
        price: 35000,
        stock: 12,
        pickupMode: 'immediate',
      },
    });

    expect(product.qrUrl).toMatch(/\?qr=demo-mug-white-gray$/);
  });
});
