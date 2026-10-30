import type { ArtProject } from './types';

export const images = {
  pottery: require('../assets/images/pottery.jpg'),
  bowls: require('../assets/images/bowls.jpg'),
  linen: require('../assets/images/linen.jpg'),
  print: require('../assets/images/print.jpg'),
  pouch: require('../assets/images/pouch.jpg'),
  cafe: require('../assets/images/cafe.jpg'),
  bookstore: require('../assets/images/bookstore.jpg'),
  showroom: require('../assets/images/showroom.jpg'),
  lounge: require('../assets/images/lounge.jpg'),
} as const;

export const projects: ArtProject[] = [
  {
    id: 'p-01', title: '흙의 기억', artist: '김서연', region: '서울·경기', status: '전시·판매 중',
    tags: ['우드톤', '미니멀', '자연'], priceRange: '28,000~150,000원', image: images.pottery, match: 91,
  },
  {
    id: 'p-02', title: '새벽의 형태', artist: '이하늘', region: '서울 전역', status: '매칭 완료',
    tags: ['모노크롬', '모던', '감각적'], priceRange: '18,000~45,000원', image: images.print, match: 88,
  },
  {
    id: 'p-03', title: '고요한 초록', artist: '박수아', region: '서울·인천', status: '모집 중',
    tags: ['식물', '패브릭', '포근함'], priceRange: '18,000~45,000원', image: images.pouch,
  },
  {
    id: 'p-04', title: '점토의 온도', artist: '정다은', region: '서울', status: '모집 중',
    tags: ['테라코타', '핸드메이드', '온기'], priceRange: '35,000~180,000원', image: images.bowls,
  },
];

export const stores = [
  { name: '아늑한 서울', area: '성수동', mood: '우드톤 · 30석', image: images.cafe, match: 94 },
  { name: '성수 독립서점', area: '성수동', mood: '조용함 · 전시벽', image: images.bookstore, match: 89 },
  { name: '리프 쇼룸', area: '연남동', mood: '밝음 · 2개 구역', image: images.showroom, match: 86 },
];

export const qrTokens = ['demo-mug-white-gray', 'demo-bowl-set-2026', 'demo-dessert-plate'] as const;
