import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { config } from './config';

const CHUNK_SIZE = 1800;

const secureStorage = {
  async getItem(key: string) {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null;
    const manifest = await SecureStore.getItemAsync(`${key}.parts`);
    if (!manifest) return SecureStore.getItemAsync(key);
    const count = Number(manifest);
    if (!Number.isSafeInteger(count) || count < 1 || count > 32) return null;
    const chunks = await Promise.all(
      Array.from({ length: count }, (_, index) => SecureStore.getItemAsync(`${key}.${index}`)),
    );
    return chunks.every((chunk): chunk is string => chunk !== null) ? chunks.join('') : null;
  },
  async setItem(key: string, value: string) {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.setItem(key, value);
      return;
    }
    const previous = Number(await SecureStore.getItemAsync(`${key}.parts`)) || 0;
    const chunks = value.match(new RegExp(`.{1,${CHUNK_SIZE}}`, 'gs')) ?? [''];
    await Promise.all(chunks.map((chunk, index) => SecureStore.setItemAsync(`${key}.${index}`, chunk)));
    await SecureStore.setItemAsync(`${key}.parts`, String(chunks.length));
    await SecureStore.deleteItemAsync(key);
    await Promise.all(
      Array.from({ length: Math.max(0, previous - chunks.length) }, (_, index) =>
        SecureStore.deleteItemAsync(`${key}.${chunks.length + index}`),
      ),
    );
  },
  async removeItem(key: string) {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.removeItem(key);
      return;
    }
    const count = Number(await SecureStore.getItemAsync(`${key}.parts`)) || 0;
    await Promise.all([
      SecureStore.deleteItemAsync(key),
      SecureStore.deleteItemAsync(`${key}.parts`),
      ...Array.from({ length: count }, (_, index) => SecureStore.deleteItemAsync(`${key}.${index}`)),
    ]);
  },
};

export const isSupabaseConfigured = Boolean(config.supabaseUrl && config.supabasePublishableKey);

let singleton: SupabaseClient | null = null;

export function getSupabase() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase 환경변수가 설정되지 않았습니다. .env의 URL과 Publishable Key를 확인해 주세요.');
  }
  singleton ??= createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: {
      storage: secureStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
    },
  });
  return singleton;
}
