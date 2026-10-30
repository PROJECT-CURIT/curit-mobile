import { buildQrApiUrl, config } from './config';
import type { QrProduct } from './types';

type JsonRecord = Record<string, unknown>;

const asNumber = (value: unknown, fallback = 0) =>
  typeof value === 'number' ? value : typeof value === 'string' ? Number(value) || fallback : fallback;

export function normalizeQrProduct(token: string, payload: JsonRecord): QrProduct {
  const product = (payload.product && typeof payload.product === 'object' ? payload.product : payload) as JsonRecord;
  const inventory = (payload.inventory && typeof payload.inventory === 'object' ? payload.inventory : {}) as JsonRecord;
  return {
    token,
    productId: String(product.artworkId ?? product.id ?? product.productId ?? token),
    name: String(product.name ?? product.title ?? '이름 없는 상품'),
    price: asNumber(product.price ?? product.salePrice),
    stock: asNumber(inventory.available ?? product.stock ?? product.quantity),
    status: String(payload.saleStatus ?? product.status ?? inventory.status ?? 'ACTIVE').toUpperCase() as QrProduct['status'],
    pickupMode: String(product.pickupMode ?? product.fulfillmentType ?? '매장 즉시 수령'),
    imageUrl: typeof product.image === 'string' ? product.image : typeof product.imageUrl === 'string' ? product.imageUrl : undefined,
    artistName: typeof product.artist === 'string' ? product.artist : typeof product.artistName === 'string' ? product.artistName : undefined,
  };
}

export async function fetchQrProduct(token: string, signal?: AbortSignal) {
  const response = await fetch(buildQrApiUrl(token), {
    signal,
    headers: config.supabaseAnonKey
      ? {
          apikey: config.supabaseAnonKey,
          Authorization: `Bearer ${config.supabaseAnonKey}`,
        }
      : undefined,
  });
  if (!response.ok) throw new Error(`QR 상품 조회 실패 (${response.status})`);
  return normalizeQrProduct(token, (await response.json()) as JsonRecord);
}
