export type Role = 'creator' | 'store';
export type TabKey = 'home' | 'discover' | 'chat' | 'management' | 'my';

export interface Session {
  userId: string;
  role: Role;
  displayName: string;
  email: string;
  demo?: boolean;
}

export interface ArtProject {
  id: string;
  title: string;
  artist: string;
  region: string;
  status: '모집 중' | '전시·판매 중' | '매칭 완료';
  tags: string[];
  priceRange: string;
  image: number;
  match?: number;
}

export interface QrProduct {
  id?: string;
  token: string;
  productId: string;
  collaborationId?: string;
  name: string;
  price: number;
  stock: number;
  status: 'ACTIVE' | 'PAUSED' | 'SOLD_OUT';
  pickupMode: string;
  imageUrl?: string;
  artistName?: string;
  qrUrl?: string;
  issuable?: boolean;
}
