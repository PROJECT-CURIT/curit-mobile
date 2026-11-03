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
    id: 'demo-project-glass', title: '유리 정원의 오후', artist: '권아영', region: '서울·경기', status: '모집 중',
    tags: ['식물', '파스텔', '포근함'], priceRange: '18,000~48,000원', image: images.pouch, match: 94,
  },
  {
    id: 'demo-project-paper', title: '종이 위의 산책', artist: '최선문', region: '서울 전역', status: '전시·판매 중',
    tags: ['드로잉', '모던', '차분함'], priceRange: '15,000~65,000원', image: images.print, match: 91,
  },
  {
    id: 'demo-project-blue', title: '파란 식탁', artist: '김해름', region: '서울·인천', status: '매칭 완료',
    tags: ['세라믹', '블루', '미니멀'], priceRange: '28,000~120,000원', image: images.bowls, match: 88,
  },
  {
    id: 'demo-project-earth', title: '흙의 기억', artist: '김서연', region: '서울·제주', status: '전시·판매 중',
    tags: ['우드톤', '도예', '자연'], priceRange: '35,000~180,000원', image: images.pottery, match: 86,
  },
  {
    id: 'demo-project-linen', title: '빛이 머무는 선반', artist: '박수아', region: '서울', status: '모집 중',
    tags: ['패브릭', '아이보리', '따뜻함'], priceRange: '22,000~58,000원', image: images.linen, match: 83,
  },
];

export const stores = [
  { name: '아늑한 서울', area: '성수동', mood: '우드톤 · 30석', image: images.cafe, match: 94 },
  { name: '성수 독립서점', area: '성수동', mood: '조용함 · 전시벽', image: images.bookstore, match: 89 },
  { name: '리프 쇼룸', area: '연남동', mood: '밝음 · 2개 구역', image: images.showroom, match: 86 },
  { name: '오후의 기록', area: '망원동', mood: '차분함 · 창가 선반', image: images.lounge, match: 82 },
];
