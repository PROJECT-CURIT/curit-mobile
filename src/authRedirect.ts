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

export function authRedirectFromRoute(params: Record<string, string | string[]>) {
  const url = new URL(AUTH_REDIRECT_URL);
  for (const key of ['code', 'flow', 'type', 'error', 'error_description', 'access_token', 'refresh_token']) {
    const raw = params[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value) url.searchParams.set(key, value);
  }
  const fragment = params['#'];
  const hash = Array.isArray(fragment) ? fragment[0] : fragment;
  if (hash) url.hash = hash;
  const payload = parseAuthRedirect(url.href);
  return payload.code || (payload.accessToken && payload.refreshToken) || payload.error ? url.href : null;
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
