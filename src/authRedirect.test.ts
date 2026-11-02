import { describe, expect, it } from 'vitest';
import { AUTH_REDIRECT_URL, parseAuthRedirect } from './authRedirect';

describe('Supabase auth deep-link parser', () => {
  it('uses the registered CURI:T callback URL', () => {
    expect(AUTH_REDIRECT_URL).toBe('curit://auth/callback');
  });

  it('reads PKCE codes from a callback query', () => {
    expect(parseAuthRedirect('curit://auth/callback?code=pkce-code').code).toBe('pkce-code');
  });

  it('reads implicit tokens from a callback hash', () => {
    const parsed = parseAuthRedirect('curit://auth/callback#access_token=access&refresh_token=refresh');
    expect(parsed.accessToken).toBe('access');
    expect(parsed.refreshToken).toBe('refresh');
  });

  it('decodes provider errors', () => {
    expect(parseAuthRedirect('curit://auth/callback?error_description=Link%20expired').error).toBe('Link expired');
  });
});
