import { describe, expect, it } from 'vitest';
import { buildCommerceApiUrl, buildFieldSaleUrl, buildQrApiUrl, buildQrWebUrl, localDemoModeAllowed } from './config';

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

  it('builds the existing field-sale page URL rather than a commerce listing URL', () => {
    expect(buildFieldSaleUrl('poetry-postcards', 'https://project-curit.github.io/curit-qr-web/')).toBe(
      'https://project-curit.github.io/curit-qr-web/?buy=poetry-postcards',
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

describe('local-only session access', () => {
  it('allows sample sessions only when backend credentials are absent', () => {
    expect(localDemoModeAllowed('', '')).toBe(true);
    expect(localDemoModeAllowed('https://project.supabase.co', 'public-key')).toBe(false);
    expect(localDemoModeAllowed('https://project.supabase.co', '')).toBe(true);
  });
});
