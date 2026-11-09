type MatchEvidence = { matchedTermCount: number; regionFit: boolean; hasAvailableItems: boolean; hasExhibitionZones: boolean; dimensionFit?: 'fits' | 'unknown' | 'too-large' };

export function matchScoreBreakdown(input: MatchEvidence) {
  return [
    { label: '취향·협업 목적', points: Math.min(40, Math.max(0, input.matchedTermCount) * 10), max: 40 },
    { label: '활동 지역', points: input.regionFit ? 20 : 0, max: 20 },
    { label: '판매 가능 재고', points: input.hasAvailableItems ? 20 : 0, max: 20 },
    { label: '전시 구역·치수', points: !input.hasExhibitionZones || input.dimensionFit === 'too-large' ? 0 : input.dimensionFit === 'unknown' ? 10 : 20, max: 20 },
  ];
}

export function calculateMatchScore(input: MatchEvidence) {
  return matchScoreBreakdown(input).reduce((total, part) => total + part.points, 0);
}

type ExhibitionZone = { widthCm?: number | null; heightCm?: number | null; widthMm?: number | null; heightMm?: number | null };
type ArtworkSize = { width_mm?: number | null; height_mm?: number | null };

export function matchDimensions(items: ArtworkSize[], zones: ExhibitionZone[]): 'fits' | 'unknown' | 'too-large' {
  const zoneSizes = zones.map(zone => [zone.widthMm ?? Number(zone.widthCm) * 10, zone.heightMm ?? Number(zone.heightCm) * 10]);
  const itemSizes = items.map(item => [Number(item.width_mm), Number(item.height_mm)]);
  const hasSize = (size: number[]) => size.every(value => Number.isFinite(value) && value > 0);
  if (itemSizes.some(size => hasSize(size) && zoneSizes.some(zone => hasSize(zone) && size[0]! <= zone[0]! && size[1]! <= zone[1]!))) return 'fits';
  return itemSizes.length && zoneSizes.length && itemSizes.every(hasSize) && zoneSizes.every(hasSize) ? 'too-large' : 'unknown';
}

export type CreatorMatchTraits = {
  dna_moods?: string[] | null;
  dna_colors?: string[] | null;
  preferred_spaces?: string[] | null;
  collaboration_goals?: string[] | null;
  install_conditions?: string | null;
};

/** Only structured positive preferences affect taste. Free-text precautions are
 * carried to confirmation, never interpreted as evidence of a safe installation. */
export function matchCreatorTraits(creator: CreatorMatchTraits | null | undefined, store: { category: string; mood_tags: string[]; purpose_tags: string[] }) {
  const normalize = (value: string) => value.trim().toLocaleLowerCase('ko-KR').replace(/편집샵/g, '편집숍');
  const storeMoods = new Set(store.mood_tags.map(normalize));
  const moods = [...new Set([...(creator?.dna_moods ?? []), ...(creator?.dna_colors ?? [])])]
    .filter(value => value.trim() && storeMoods.has(normalize(value)));
  const space = (creator?.preferred_spaces ?? []).find(value => value.trim() && normalize(store.category).includes(normalize(value)));
  const goals = creator?.collaboration_goals ?? [];
  const sale = goals.some(value => value === '작품 판매' || value === '둘 다') && store.purpose_tags.includes('상품 판매');
  const promotion = goals.some(value => value === '작품 홍보' || value === '둘 다')
    && store.purpose_tags.some(value => ['공간 전시', '지역 크리에이터 소개', '브랜드 표현'].includes(value));
  const purposes = [sale ? '판매' : '', promotion ? '홍보' : ''].filter(Boolean);
  return {
    keywords: [...moods.map(normalize), ...(space ? [normalize(space)] : []), ...purposes],
    reasons: [
      ...(moods.length ? [`작품 DNA와 공간의 ${moods.slice(0, 3).join('·')} 취향이 같아요`] : []),
      ...(space ? [`작가가 선호 공간으로 ${space}를 선택했어요`] : []),
      ...(purposes.length ? [`${purposes.join('·')} 협업 목적이 겹쳐요`] : []),
    ],
    installationNote: creator?.install_conditions?.trim() ? `작가의 설치·관리 조건: ${creator.install_conditions.trim()}` : '',
  };
}
