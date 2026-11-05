export function calculateMatchScore(input: { matchedTermCount: number; regionFit: boolean; hasAvailableItems: boolean; hasExhibitionZones: boolean }) {
  const taste = Math.min(40, Math.max(0, input.matchedTermCount) * 10);
  return Math.min(100, taste + (input.regionFit ? 20 : 0) + (input.hasAvailableItems ? 20 : 0) + (input.hasExhibitionZones ? 20 : 0));
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
