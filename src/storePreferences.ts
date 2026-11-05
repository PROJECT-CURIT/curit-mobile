export const storeMoods = ['미니멀', '내추럴', '우드톤', '빈티지', '모던', '아트'];
export const storeColors = ['아이보리', '화이트', '베이지', '브라운', '블랙', '그레이'];
export const storePurposes = ['분위기 전환', '공간 전시', '포토존 구성', '지역 크리에이터 소개', '상품 판매', '브랜드 표현'];
export const storeZones = ['벽면', '선반', '테이블', '카운터', '창가', '입구', '대기공간'];

export function storeChoices(options: string[], saved: string[]) {
  return [...new Set([...options, ...saved])];
}

export function storeBudgetError(min: string, max: string) {
  if ([min, max].some(value => value && (!/^\d+$/.test(value) || Number(value) > 2_147_483_647))) {
    return '예산은 0원부터 2,147,483,647원까지 입력할 수 있어요.';
  }
  if (min && max && Number(min) > Number(max)) return '최대 예산은 최소 예산 이상으로 입력해 주세요.';
  return '';
}

export function formatStoreBudget(min: number | null, max: number | null) {
  const money = (value: number) => `${value.toLocaleString('ko-KR')}원`;
  if (min === null) return max === null ? '미설정' : `${money(max)} 이하`;
  if (max === null) return `${money(min)} 이상`;
  return min === max ? money(min) : `${money(min)} ~ ${money(max)}`;
}
