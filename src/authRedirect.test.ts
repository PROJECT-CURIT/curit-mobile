import { describe, expect, it } from 'vitest';
import { AUTH_REDIRECT_URL, authRedirectFromRoute, authRedirectUrl, parseAuthRedirect } from './authRedirect';

describe('Supabase auth deep-link parser', () => {
  it('uses the registered CURI:T callback URL', () => {
    expect(AUTH_REDIRECT_URL).toBe('curit://auth/callback');
    expect(authRedirectUrl()).toBe(AUTH_REDIRECT_URL);
    expect(authRedirectUrl('recovery')).toBe(`${AUTH_REDIRECT_URL}?flow=recovery`);
  });

  it('reads PKCE codes from a callback query', () => {
    expect(parseAuthRedirect('curit://auth/callback?code=pkce-code').code).toBe('pkce-code');
  });

  it('reads implicit tokens from a callback hash', () => {
    const parsed = parseAuthRedirect('curit://auth/callback#access_token=access&refresh_token=refresh&type=recovery');
    expect(parsed.accessToken).toBe('access');
    expect(parsed.refreshToken).toBe('refresh');
    expect(parsed.type).toBe('recovery');
  });

  it('keeps the recovery intent on PKCE callbacks', () => {
    const parsed = parseAuthRedirect('curit://auth/callback?flow=recovery&code=pkce-code');
    expect(parsed.code).toBe('pkce-code');
    expect(parsed.type).toBe('recovery');
  });

  it('keeps Expo Router callback fragments when flow is in the query', () => {
    const url = authRedirectFromRoute({ flow: 'recovery', '#': 'access_token=access&refresh_token=refresh' });
    expect(parseAuthRedirect(url ?? '')).toMatchObject({ type: 'recovery', accessToken: 'access', refreshToken: 'refresh' });
  });

  it('does not let route metadata shadow the initial link with credentials', () => {
    expect(authRedirectFromRoute({ flow: 'recovery' })).toBeNull();
    expect(authRedirectFromRoute({ access_token: 'incomplete' })).toBeNull();
  });

  it('decodes provider errors', () => {
    expect(parseAuthRedirect('curit://auth/callback?error_description=Link%20expired').error).toBe('Link expired');
  });
});
