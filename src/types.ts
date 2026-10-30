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

export type MatchTargetType = 'project' | 'store';

export interface MatchRecommendation {
  targetId: string;
  targetType: MatchTargetType;
  title: string;
  subtitle: string;
  description: string;
  score: number;
  reasons: string[];
  tags: string[];
  imageUrl?: string;
  priceRange?: string;
  collaborationId?: string;
  collaborationStatus?: CollaborationStatus;
}

export interface CuratorMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  recommendations: MatchRecommendation[];
  actions: string[];
  createdAt: string;
}

export type CollaborationStatus = 'proposed' | 'negotiating' | 'approved' | 'active' | 'completed' | 'cancelled';

export interface CollaborationSummary {
  id: string;
  projectId: string;
  storeId: string;
  creatorId: string;
  projectTitle: string;
  storeName: string;
  creatorName: string;
  counterpartName: string;
  status: CollaborationStatus;
  startsOn: string | null;
  endsOn: string | null;
  creatorShare: number;
  storeShare: number;
  platformShare: number;
  terms: Record<string, unknown>;
  updatedAt: string;
}

export interface CollaborationMessage {
  id: string;
  collaborationId: string;
  senderId: string;
  content: string;
  createdAt: string;
}

export interface CollaborationItem {
  projectItemId: string;
  name: string;
  imageUrl: string;
  price: number;
  stock: number;
  quantity: number;
  creatorConfirmed: boolean;
}
