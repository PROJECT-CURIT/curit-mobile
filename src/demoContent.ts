import type { CreatorProfileData } from './fullPlatform';
import type { StoreOnboarding } from './platform';
import { buildQrWebUrl } from './config';
import type { QrProduct } from './types';

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
  introduction: '우드톤 가구와 따뜻한 조명이 있는 30석 규모의 개인 카페입니다.',
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
