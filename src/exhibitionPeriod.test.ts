import { describe, expect, it } from 'vitest';
import { exhibitionPeriodError, formatExhibitionDateInput, suggestedExhibitionPeriod } from './exhibitionPeriod';

describe('exhibition period', () => {
  it('validates the calendar and requires a later end date', () => {
    expect(exhibitionPeriodError({ startsOn: '2028-02-29', endsOn: '2028-03-01' })).toBe('');
    for (const startsOn of ['2027-02-29', '2028-02-30', '2028-13-01', '0000-01-01', '2028-03-01', '2028-03-02', '']) {
      expect(exhibitionPeriodError({ startsOn, endsOn: '2028-03-01' })).not.toBe('');
    }
  });
  it('formats typed and pasted digits without retaining extra characters', () => {
    expect(formatExhibitionDateInput('2026/12/05')).toBe('2026-12-05');
    expect(formatExhibitionDateInput('2026-1')).toBe('2026-1');
  });
  it('suggests a period using the Korean calendar day', () => {
    expect(suggestedExhibitionPeriod(new Date('2026-11-05T16:00:00Z'))).toEqual({ startsOn: '2026-11-13', endsOn: '2027-02-11' });
  });
});
