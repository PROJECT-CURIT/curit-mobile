import { describe, expect, it } from 'vitest';
import { formatStoreBudget, storeBudgetError, storeChoices, storeMoods } from './storePreferences';

describe('store preferences', () => {
  it('allows blank and zero amounts while rejecting invalid ranges and integer overflow', () => {
    expect(storeBudgetError('', '')).toBe('');
    expect(storeBudgetError('0', '0')).toBe('');
    expect(storeBudgetError('', '2147483647')).toBe('');
    expect(storeBudgetError('10', '0')).toContain('최소 예산');
    expect(storeBudgetError('0', '2147483648')).toContain('2,147,483,647');
  });

  it('displays incomplete budgets and zero without implying a second bound', () => {
    expect(formatStoreBudget(null, null)).toBe('미설정');
    expect(formatStoreBudget(0, null)).toBe('0원 이상');
    expect(formatStoreBudget(null, 300000)).toBe('300,000원 이하');
    expect(formatStoreBudget(0, 0)).toBe('0원');
  });

  it('keeps previously saved options visible without duplicating current options', () => {
    const options = storeChoices(storeMoods, ['따뜻한', '미니멀']);
    expect(options).toContain('따뜻한');
    expect(options.filter(value => value === '미니멀')).toHaveLength(1);
  });
});
