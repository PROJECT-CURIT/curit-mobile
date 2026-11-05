import type { CreatorProfileData, SocialComment, SocialPost } from './fullPlatform';
import type { StoreOnboarding } from './platform';
import type { CollaborationSummary, Role } from './types';

export function demoCollaboration(role: Role): CollaborationSummary {
  return {
    id: 'demo-collaboration',
    projectId: 'demo-project-paper',
    storeId: 'demo-store',
    creatorId: 'demo-creator-seonmun',
    projectTitle: '종이 위의 산책',
    storeName: '아늑한 서울',
    creatorName: '최선문',
    counterpartName: role === 'creator' ? '아늑한 서울' : '최선문',
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
    projectId: 'demo-project-blue',
    creatorId: 'demo-creator-haereum',
    projectTitle: '파란 식탁',
    creatorName: '김해름',
    counterpartName: role === 'creator' ? '성수 독립서점' : '김해름',
    storeId: 'demo-store-book',
    storeName: '성수 독립서점',
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
    projectId: 'demo-project-glass',
    creatorId: 'demo-creator-ayeong',
    projectTitle: '유리 정원의 오후',
    creatorName: '권아영',
    counterpartName: role === 'creator' ? '리프 쇼룸' : '권아영',
    storeId: 'demo-store-leaf',
    storeName: '리프 쇼룸',
    status: role === 'creator' ? 'proposed' : 'approved',
    startsOn: '2026-11-07',
    endsOn: '2027-02-05',
    terms: {
      initiatedBy,
      message: role === 'creator'
        ? '리프 쇼룸이 작품 구성과 전시 조건을 확인해 달라고 요청했습니다.'
        : '권아영 작가가 추천 결과를 확인하고 매장에 협업을 제안했습니다.',
    },
  };
}

export function demoCollaborationList(role: Role): CollaborationSummary[] {
  const completed: CollaborationSummary = {
    ...demoCollaboration(role),
    id: 'demo-completed',
    projectId: 'demo-project-earth',
    creatorId: 'demo-creator-soyeon',
    projectTitle: '흙의 기억',
    creatorName: '김서연',
    counterpartName: role === 'creator' ? '오후의 기록' : '김서연',
    storeId: 'demo-store-afternoon',
    storeName: '오후의 기록',
    status: 'completed',
    startsOn: '2026-07-01',
    endsOn: '2026-09-30',
    terms: { message: '전시 종료 후 판매대금 정산까지 완료되었습니다.' },
    updatedAt: '2026-10-03T07:30:00.000Z',
  };
  return [
    { ...demoIncomingCollaboration(role), updatedAt: '2026-11-02T02:20:00.000Z' },
    { ...demoProposalCollaboration(role), updatedAt: '2026-11-01T08:40:00.000Z' },
    { ...demoCollaboration(role), updatedAt: '2026-10-31T05:10:00.000Z' },
    completed,
  ];
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

export const demoSocialComments: Record<string, SocialComment[]> = {
  'demo-post-glass': [
    { id: 'demo-comment-glass-1', postId: 'demo-post-glass', userId: 'demo-user-seonmun', displayName: '최선문', avatarUrl: '', content: '패브릭 색감이 매장 초록 식물과 잘 어울릴 것 같아요.', createdAt: '2026-11-01T09:18:00.000Z' },
    { id: 'demo-comment-glass-2', postId: 'demo-post-glass', userId: 'demo-user-haereum', displayName: '김해름', avatarUrl: '', content: '연남 전시는 언제부터 볼 수 있나요?', createdAt: '2026-11-01T10:05:00.000Z' },
    { id: 'demo-comment-glass-3', postId: 'demo-post-glass', userId: 'demo-user-sua', displayName: '박수아', avatarUrl: '', content: '창가에 두면 오후 빛이 예쁘게 들겠어요.', createdAt: '2026-11-01T11:42:00.000Z' },
  ],
  'demo-post-paper': [
    { id: 'demo-comment-paper-1', postId: 'demo-post-paper', userId: 'demo-user-ayeong', displayName: '권아영', avatarUrl: '', content: '커피 기다리면서 천천히 둘러보기 좋은 전시네요.', createdAt: '2026-10-31T13:02:00.000Z' },
    { id: 'demo-comment-paper-2', postId: 'demo-post-paper', userId: 'demo-user-haereum', displayName: '김해름', avatarUrl: '', content: '작품 옆 QR로 엽서도 볼 수 있나요?', createdAt: '2026-10-31T13:28:00.000Z' },
  ],
  'demo-post-blue': [
    { id: 'demo-comment-blue-1', postId: 'demo-post-blue', userId: 'demo-user-ayeong', displayName: '권아영', avatarUrl: '', content: '유약의 푸른색이 참 차분해 보여요.', createdAt: '2026-10-29T05:11:00.000Z' },
    { id: 'demo-comment-blue-2', postId: 'demo-post-blue', userId: 'demo-user-seonmun', displayName: '최선문', avatarUrl: '', content: '서점 식탁에 놓인 모습도 궁금합니다.', createdAt: '2026-10-29T06:25:00.000Z' },
  ],
  'demo-post-linen': [
    { id: 'demo-comment-linen-1', postId: 'demo-post-linen', userId: 'demo-user-ayeong', displayName: '권아영', avatarUrl: '', content: '아이보리 톤 선반과 잘 어울리겠어요.', createdAt: '2026-10-27T08:04:00.000Z' },
  ],
};

export const demoSocialPosts: SocialPost[] = [
  {
    id: 'demo-post-glass', creatorId: 'demo-creator-ayeong', creatorName: '권아영', handle: 'ayeong.green', avatarUrl: '',
    content: '연남동 쇼룸 전시를 준비하고 있어요. 빛과 식물에서 가져온 색을 작은 패브릭 소품에 담았습니다.', imageUrl: '',
    likes: 128, comments: demoSocialComments['demo-post-glass']?.length ?? 0, liked: false, followed: true, own: false, createdAt: '2026-11-01T09:00:00.000Z',
  },
  {
    id: 'demo-post-paper', creatorId: 'demo-creator-seonmun', creatorName: '최선문', handle: 'moon.archive', avatarUrl: '',
    content: '종이 위의 산책 시리즈가 성수 카페에서 전시를 시작했습니다. 커피를 기다리는 동안 천천히 봐 주세요.', imageUrl: '',
    likes: 96, comments: demoSocialComments['demo-post-paper']?.length ?? 0, liked: true, followed: true, own: false, createdAt: '2026-10-31T12:30:00.000Z',
  },
  {
    id: 'demo-post-blue', creatorId: 'demo-creator-haereum', creatorName: '김해름', handle: 'haereum.blue', avatarUrl: '',
    content: '푸른 유약의 농도를 달리한 작은 볼과 접시를 완성했습니다. 서점과 식탁이 있는 공간을 찾고 있어요.', imageUrl: '',
    likes: 73, comments: demoSocialComments['demo-post-blue']?.length ?? 0, liked: false, followed: false, own: false, createdAt: '2026-10-29T04:20:00.000Z',
  },
  {
    id: 'demo-post-linen', creatorId: 'demo-creator-sua', creatorName: '박수아', handle: 'sua.textile', avatarUrl: '',
    content: '겨울 시즌을 위한 린넨 오브제 샘플이 나왔어요. 밝은 선반과 창가 공간에 잘 어울립니다.', imageUrl: '',
    likes: 52, comments: demoSocialComments['demo-post-linen']?.length ?? 0, liked: false, followed: false, own: false, createdAt: '2026-10-27T07:15:00.000Z',
  },
];

export const demoCreatorProfile: CreatorProfileData = {
  userId: 'demo-creator',
  displayName: '권아영',
  handle: 'ayeong_green',
  avatarPath: '',
  avatarUrl: '',
  headline: '빛과 식물의 색을 담는 패브릭 작가',
  introduction: '일상의 초록과 오후의 빛을 오래 곁에 둘 수 있는 패브릭 소품으로 만듭니다.',
  categories: ['패브릭·섬유', '드로잉'],
  regions: ['서울', '경기'],
  portfolioUrl: 'https://example.com/ayeong-green',
  snsUrl: 'https://instagram.com/ayeong_green',
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
  photoPaths: ['demo-cafe'],
  exhibitionZones: [
    { type: '벽면', widthCm: 180, heightCm: 120 },
    { type: '선반', widthCm: 120, heightCm: 45 },
    { type: '카운터', widthCm: 80, heightCm: 40 },
  ],
  step: 5,
  complete: true,
};
