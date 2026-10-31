import type { CreatorProfileData, SocialPost } from './fullPlatform';
import type { StoreOnboarding } from './platform';
import { buildQrWebUrl } from './config';
import type { CollaborationSummary, QrProduct, Role } from './types';

export function demoCollaboration(role: Role): CollaborationSummary {
  return {
    id: 'demo-collaboration',
    projectId: 'demo-project',
    storeId: 'demo-store',
    creatorId: 'demo-creator',
    projectTitle: '흙의 기억',
    storeName: '아늑한 서울',
    creatorName: '김서연',
    counterpartName: role === 'creator' ? '아늑한 서울' : '김서연',
    status: 'active',
    startsOn: '2026-10-01',
    endsOn: '2026-12-31',
    creatorShare: 80,
    storeShare: 10,
    platformShare: 10,
    terms: { message: '공간 DNA 추천으로 시작한 협업입니다.' },
    updatedAt: new Date().toISOString(),
  };
}

export function demoProposalCollaboration(role: Role): CollaborationSummary {
  return {
    ...demoCollaboration(role),
    id: 'demo-proposal',
    status: role === 'creator' ? 'approved' : 'proposed',
    startsOn: '2026-11-07',
    endsOn: '2027-02-05',
    terms: {
      initiatedBy: role,
      message: role === 'creator'
        ? '크리에이터가 추천 결과를 확인하고 매장에 협업을 제안했습니다.'
        : '매장이 추천 결과를 확인하고 크리에이터에게 협업을 제안했습니다.',
    },
  };
}

export function demoIncomingCollaboration(role: Role): CollaborationSummary {
  const initiatedBy: Role = role === 'creator' ? 'store' : 'creator';
  return {
    ...demoCollaboration(role),
    id: 'demo-incoming',
    status: role === 'creator' ? 'proposed' : 'approved',
    startsOn: '2026-11-07',
    endsOn: '2027-02-05',
    terms: {
      initiatedBy,
      message: role === 'creator'
        ? '아늑한 서울이 작품 구성과 전시 조건을 확인해 달라고 요청했습니다.'
        : '김서연 작가가 추천 결과를 확인하고 매장에 협업을 제안했습니다.',
    },
  };
}

export function nextDemoCollaborationStatus(
  status: CollaborationSummary['status'],
  action: 'accept' | 'confirm' | 'counter' | 'cancel' | 'complete',
  role: Role,
): CollaborationSummary['status'] {
  if (action === 'accept' && role === 'creator' && ['proposed', 'negotiating'].includes(status)) return 'approved';
  if (action === 'confirm' && role === 'store' && status === 'approved') return 'active';
  if (action === 'counter' && ['proposed', 'negotiating', 'approved'].includes(status)) return 'negotiating';
  if (action === 'cancel' && !['completed', 'cancelled'].includes(status)) return 'cancelled';
  if (action === 'complete' && status === 'active') return 'completed';
  return status;
}

export const demoSocialPosts: SocialPost[] = [
  {
    id: 'demo-post-season', creatorId: 'demo-creator-season', creatorName: '김서연', handle: 'soyeon_craft', avatarUrl: '',
    content: '10월 시즌 전시 준비를 마쳤어요. 우드톤 공간에 어울리는 따뜻한 생활 도예 작품을 소개합니다.', imageUrl: '',
    likes: 64, comments: 12, liked: false, followed: true, own: false, createdAt: '2026-10-30T09:00:00.000Z',
  },
  {
    id: 'demo-post-print', creatorId: 'demo-creator-print', creatorName: '이하늘', handle: 'haneul_print', avatarUrl: '',
    content: '도시의 새벽빛을 담은 프린트 시리즈가 새로운 카페 공간에서 전시를 시작합니다.', imageUrl: '',
    likes: 41, comments: 7, liked: false, followed: false, own: false, createdAt: '2026-10-28T12:30:00.000Z',
  },
];

export const demoCreatorProfile: CreatorProfileData = {
  userId: 'demo-creator',
  displayName: '김서연',
  handle: 'soyeon_craft',
  avatarPath: '',
  avatarUrl: '',
  headline: '제주 자연에서 영감을 받은 도예 작가',
  introduction: '흙의 질감과 계절의 색을 일상에서 오래 사용할 수 있는 그릇에 담습니다.',
  categories: ['도예·세라믹', '회화'],
  regions: ['서울', '경기'],
  portfolioUrl: 'https://example.com/soyeon-craft',
  snsUrl: 'https://instagram.com/soyeon_craft',
  dnaMoods: ['내추럴', '우드톤', '미니멀'],
  dnaColors: ['아이보리', '베이지'],
  preferredSpaces: ['카페', '서점'],
  collaborationGoals: ['작품 홍보', '작품 판매'],
  installConditions: '안정적인 선반과 직사광선이 적은 공간을 선호합니다.',
  activityVerified: true,
  onboardingStep: 2,
  onboardingComplete: true,
};

export const demoStoreOnboarding: StoreOnboarding = {
  name: '아늑한 서울',
  category: '카페',
  address: '서울 성동구 성수동',
  introduction: '우드톤 가구와 따뜻한 조명이 있는 30석 개인 카페입니다.',
  targetAudience: '20–30대 직장인, 예술과 공예에 관심 있는 방문객',
  moodTags: ['내추럴', '우드톤', '미니멀'],
  purposeTags: ['분위기 전환', '상품 판매', '지역 크리에이터 소개'],
  monthlyBudgetMin: 200000,
  monthlyBudgetMax: 500000,
  photoPaths: [],
  exhibitionZones: [
    { type: '벽면', widthCm: 180, heightCm: 120 },
    { type: '선반', widthCm: 120, heightCm: 45 },
    { type: '카운터', widthCm: 80, heightCm: 40 },
  ],
  step: 5,
  complete: true,
};

export const demoQrProducts: QrProduct[] = [
  {
    id: 'demo-mug-white-gray',
    token: 'demo-mug-white-gray',
    productId: 'demo-mug-white-gray',
    name: '머그컵 (화이트·그레이)',
    price: 35000,
    stock: 12,
    viewCount: 203,
    status: 'ACTIVE',
    pickupMode: 'immediate',
    artistName: '김서연',
    qrUrl: buildQrWebUrl('demo-mug-white-gray'),
  },
  {
    id: 'demo-bowl-set-2026',
    token: 'demo-bowl-set-2026',
    productId: 'demo-bowl-set-2026',
    name: '볼 세트 (2개)',
    price: 82000,
    stock: 6,
    viewCount: 158,
    status: 'ACTIVE',
    pickupMode: 'immediate',
    artistName: '김서연',
    qrUrl: buildQrWebUrl('demo-bowl-set-2026'),
  },
  {
    id: 'demo-dessert-plate',
    token: 'demo-dessert-plate',
    productId: 'demo-dessert-plate',
    name: '디저트 플레이트',
    price: 55000,
    stock: 8,
    viewCount: 61,
    status: 'ACTIVE',
    pickupMode: 'immediate',
    artistName: '김서연',
    qrUrl: buildQrWebUrl('demo-dessert-plate'),
  },
];
