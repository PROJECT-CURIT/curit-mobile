const trimSlash = (value: string) => value.replace(/\/+$/, '');

export const config = {
  apiUrl: trimSlash(process.env.EXPO_PUBLIC_CURIT_API_URL ?? 'http://localhost:4100'),
  functionRegion: process.env.EXPO_PUBLIC_SUPABASE_FUNCTION_REGION ?? 'ap-northeast-2',
  qrWebUrl: trimSlash(process.env.EXPO_PUBLIC_CURIT_QR_WEB_URL ?? 'http://localhost:5173'),
  supabaseUrl: trimSlash(process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''),
  supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  demoMode:
    process.env.EXPO_PUBLIC_DEMO_MODE === 'true' ||
    !(process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
};

export function buildQrWebUrl(token: string, baseUrl = config.qrWebUrl) {
  return `${trimSlash(baseUrl)}/?qr=${encodeURIComponent(token)}`;
}

export function buildQrApiUrl(token: string, baseUrl = config.apiUrl) {
  return buildCommerceApiUrl(`/api/v1/qr/${encodeURIComponent(token)}`, baseUrl);
}

export function buildCommerceApiUrl(path: string, baseUrl = config.apiUrl) {
  const target = `${trimSlash(baseUrl)}${path.startsWith('/') ? path : `/${path}`}`;
  if (!baseUrl.includes('.supabase.co') || !config.functionRegion) return target;
  const url = new URL(target);
  url.searchParams.set('forceFunctionRegion', config.functionRegion);
  return url.toString();
}
