export const AUTH_REDIRECT_URL = 'curit://auth/callback';

export type AuthRedirectPayload = {
  code: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  error: string | null;
};

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
    error: decoded(get('error_description') ?? get('error')),
  };
}
