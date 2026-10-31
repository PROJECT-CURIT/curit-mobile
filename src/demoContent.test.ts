import { describe, expect, it } from 'vitest';
import { demoCollaboration, demoProposalCollaboration, demoQrProducts } from './demoContent';

describe('demo QR catalog', () => {
  it('keeps every presentation product independently purchasable without an API response', () => {
    expect(demoQrProducts).toHaveLength(3);
    expect(new Set(demoQrProducts.map(item => item.token)).size).toBe(3);
    expect(demoQrProducts.every(item => item.price > 0 && item.stock > 0 && item.qrUrl?.includes(encodeURIComponent(item.token)))).toBe(true);
  });

  it('keeps a navigable collaboration for both presentation roles', () => {
    expect(demoCollaboration('creator').counterpartName).toBe('아늑한 서울');
    expect(demoCollaboration('store').counterpartName).toBe('김서연');
    expect(demoCollaboration('store').status).toBe('active');
  });

  it('skips self-approval when a creator starts a proposal', () => {
    expect(demoProposalCollaboration('creator').status).toBe('approved');
    expect(demoProposalCollaboration('store').status).toBe('proposed');
    expect(demoProposalCollaboration('creator').id).toBe('demo-proposal');
  });
});
