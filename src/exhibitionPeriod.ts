export type ExhibitionPeriod = {
  startsOn: string;
  endsOn: string;
};

function validDate(value: string) {
  if (!/^(?!0000)[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function exhibitionPeriodError({ startsOn, endsOn }: ExhibitionPeriod) {
  if (!validDate(startsOn) || !validDate(endsOn)) return '시작일과 종료일을 YYYY-MM-DD 형식의 실제 날짜로 입력해 주세요.';
  if (endsOn <= startsOn) return '종료일은 시작일보다 뒤여야 해요.';
  return '';
}

export function formatExhibitionDateInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  return [digits.slice(0, 4), digits.slice(4, 6), digits.slice(6)].filter(Boolean).join('-');
}

export function suggestedExhibitionPeriod(now = new Date()): ExhibitionPeriod {
  const koreaDate = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const dateAfter = (days: number) => {
    const date = new Date(koreaDate);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  };
  return { startsOn: dateAfter(7), endsOn: dateAfter(97) };
}
