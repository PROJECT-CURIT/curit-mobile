import { buildFieldSaleUrl, buildQrWebAssetUrl } from './config';
import type { QrProduct } from './types';

const catalogUrl = buildQrWebAssetUrl('field-sale/catalog.json');
const productIds = ['kendama', 'dango-keyring', 'octopus-keyring', 'poetry-postcards'] as const;

type FieldProductId = typeof productIds[number];
type FieldCatalogEntry = { name: string; image: string; price: number; quantity: number | null; status: QrProduct['status'] };
type FieldCatalog = { version: number; products: Partial<Record<FieldProductId, FieldCatalogEntry>> };

const fallbackCatalog: FieldCatalog = {
  version: 1,
  products: {
    kendama: { name: '켄다마', image: 'kendama.png', price: 8000, quantity: null, status: 'PAUSED' },
    'dango-keyring': { name: '고양이 당고 키링', image: 'dango-keyring.png', price: 5000, quantity: null, status: 'PAUSED' },
    'octopus-keyring': { name: '양면 문어 키링', image: 'octopus-keyring-photo.jpg', price: 2000, quantity: 8, status: 'PAUSED' },
    'poetry-postcards': { name: '나태주 시 엽서', image: 'poetry-postcards-photo.jpg', price: 1000, quantity: 6, status: 'PAUSED' },
  },
};

function safeEntry(id: FieldProductId, value: unknown): FieldCatalogEntry {
  if (!value || typeof value !== 'object') throw new Error('등록 상품 정보를 확인할 수 없습니다.');
  const row = value as Record<string, unknown>;
  const name = typeof row.name === 'string' ? row.name.trim() : '';
  const image = typeof row.image === 'string' ? row.image.trim() : '';
  const price = Number(row.price);
  const quantity = row.quantity === null ? null : Number(row.quantity);
  const status = row.status;
  if (!name || name.length > 100 || !/^[\w.-]+\.(?:png|jpe?g|webp)$/i.test(image)) throw new Error('등록 상품의 이름 또는 이미지를 확인할 수 없습니다.');
  if (!Number.isSafeInteger(price) || price < 1) throw new Error('등록 상품의 판매가를 확인할 수 없습니다.');
  if (quantity !== null && (!Number.isSafeInteger(quantity) || quantity < 0)) throw new Error('등록 상품의 재고 정보를 확인할 수 없습니다.');
  if (status !== 'ACTIVE' && status !== 'PAUSED' && status !== 'SOLD_OUT') throw new Error('등록 상품의 판매 상태를 확인할 수 없습니다.');
  if (quantity === 0 && status !== 'SOLD_OUT') throw new Error('품절 상품의 상태가 일치하지 않습니다.');
  return { name, image, price, quantity, status };
}

function toProduct(id: FieldProductId, entry: FieldCatalogEntry): QrProduct {
  return {
    id: `field-sale:${id}`,
    token: id,
    productId: id,
    name: entry.name,
    price: entry.price,
    stock: entry.quantity ?? 0,
    inventoryTracked: entry.quantity !== null,
    status: entry.status,
    pickupMode: 'immediate',
    imageUrl: buildQrWebAssetUrl(`field-sale/${entry.image}`),
    artistName: undefined,
    qrUrl: buildFieldSaleUrl(id),
    source: 'field-sale',
  };
}

export function isFieldSaleProductId(value: string) {
  return (productIds as readonly string[]).includes(value);
}

export async function loadFieldSaleProducts(): Promise<{ items: QrProduct[]; warning: string }> {
  try {
    const response = await fetch(catalogUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error(`상품 카탈로그 요청 실패 (${response.status})`);
    const data = await response.json() as FieldCatalog;
    const items = productIds.flatMap(id => {
      const raw = data?.products?.[id];
      return raw ? [toProduct(id, safeEntry(id, raw))] : [];
    });
    if (data?.version !== 1 || items.length !== productIds.length) throw new Error('상품 카탈로그가 완전하지 않습니다.');
    return { items, warning: '' };
  } catch {
    const items = productIds.map(id => toProduct(id, safeEntry(id, fallbackCatalog.products[id])));
    return { items, warning: '최신 상품 정보를 불러오지 못해 저장된 상품 정보를 표시하고 있습니다.' };
  }
}

export async function loadFieldSaleProduct(productId: string): Promise<QrProduct | null> {
  if (!isFieldSaleProductId(productId)) return null;
  const { items } = await loadFieldSaleProducts();
  return items.find(item => item.productId === productId) ?? null;
}
