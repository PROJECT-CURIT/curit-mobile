import { describe, expect, it } from 'vitest';
import { buildCommerceApiUrl, buildQrApiUrl, buildQrWebUrl } from './config';

describe('QR URL builders', () => {
  it('builds a stable product web URL and removes trailing slash', () => {
    expect(buildQrWebUrl('demo-dessert-plate', 'https://qr.curit.kr/')).toBe(
      'https://qr.curit.kr/?qr=demo-dessert-plate',
    );
  });

  it('encodes opaque tokens before API lookup', () => {
    expect(buildQrApiUrl('a/b c', 'https://api.curit.kr')).toBe(
      'https://api.curit.kr/api/v1/qr/a%2Fb%20c',
    );
  });

  it('pins Supabase Edge Function calls to the Seoul region', () => {
    expect(
      buildCommerceApiUrl(
        '/health',
        'https://example.supabase.co/functions/v1/commerce',
      ),
    ).toBe(
      'https://example.supabase.co/functions/v1/commerce/health?forceFunctionRegion=ap-northeast-2',
    );
  });
});
