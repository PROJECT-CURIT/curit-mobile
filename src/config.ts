const trimSlash = (value: string) => value.replace(/\/+$/, '');

export const config = {
  apiUrl: trimSlash(process.env.EXPO_PUBLIC_CURIT_API_URL ?? 'http://localhost:4100'),
  qrWebUrl: trimSlash(process.env.EXPO_PUBLIC_CURIT_QR_WEB_URL ?? 'http://localhost:5173'),
  supabaseUrl: trimSlash(process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''),
  supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  demoMode:
    process.env.EXPO_PUBLIC_DEMO_MODE === 'true' ||
    !(process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
};

export function buildQrWebUrl(token: string, baseUrl = config.qrWebUrl) {
  return `${trimSlash(baseUrl)}/q/${encodeURIComponent(token)}`;
}

export function buildQrApiUrl(token: string, baseUrl = config.apiUrl) {
  return `${trimSlash(baseUrl)}/api/v1/qr/${encodeURIComponent(token)}`;
}
