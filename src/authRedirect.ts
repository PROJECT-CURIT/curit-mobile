export const AUTH_REDIRECT_URL = 'curit://auth/callback';
export const AUTH_CALLBACK_PATH = '/auth/callback';

export type AuthRedirectPayload = {
  code: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  type: string | null;
  error: string | null;
};

export function authRedirectUrl(flow?: 'signup' | 'recovery') {
  if (typeof window !== 'undefined' && window.location?.origin) {
    const url = new URL(AUTH_CALLBACK_PATH, window.location.origin);
    if (flow) url.searchParams.set('flow', flow);
    return url.href;
  }
  return flow ? `${AUTH_REDIRECT_URL}?flow=${flow}` : AUTH_REDIRECT_URL;
}

function decoded(value: string | null) {
  if (!value) return null;
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value;
  }
}

export function parseAuthRedirect(url: string): AuthRedirectPayload {
  const parsed = new URL(url);
  const query = new URLSearchParams(parsed.search);
  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''));
  const get = (key: string) => query.get(key) ?? hash.get(key);

  return {
    code: get('code'),
    accessToken: get('access_token'),
    refreshToken: get('refresh_token'),
    type: get('type') ?? get('flow'),
    error: decoded(get('error_description') ?? get('error')),
  };
}
