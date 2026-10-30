import { describe, expect, it } from 'vitest';
import { buildQrApiUrl, buildQrWebUrl } from './config';

describe('QR URL builders', () => {
  it('builds a stable product web URL and removes trailing slash', () => {
    expect(buildQrWebUrl('demo-dessert-plate', 'https://qr.curit.kr/')).toBe(
      'https://qr.curit.kr/q/demo-dessert-plate',
    );
  });

  it('encodes opaque tokens before API lookup', () => {
    expect(buildQrApiUrl('a/b c', 'https://api.curit.kr')).toBe(
      'https://api.curit.kr/api/v1/qr/a%2Fb%20c',
    );
  });
});
