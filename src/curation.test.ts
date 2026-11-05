import { describe, expect, it } from 'vitest';
import { calculateMatchScore, matchCreatorTraits } from './matchScoring';

describe('curation match score', () => {
  it('scores registered fit factors as points, not a probability', () => {
    expect(calculateMatchScore({ matchedTermCount: 2, regionFit: true, hasAvailableItems: true, hasExhibitionZones: true })).toBe(80);
  });

  it('does not invent a minimum score when no conditions match', () => {
    expect(calculateMatchScore({ matchedTermCount: 0, regionFit: false, hasAvailableItems: false, hasExhibitionZones: false })).toBe(0);
  });

  it('caps keyword contribution and total at 100 points', () => {
    expect(calculateMatchScore({ matchedTermCount: 20, regionFit: true, hasAvailableItems: true, hasExhibitionZones: true })).toBe(100);
  });
});

describe('saved creator DNA matching', () => {
  const store = { category: '카페', mood_tags: ['우드톤', '베이지'], purpose_tags: ['상품 판매', '공간 전시'] };

  it('uses saved mood, color, preferred space and goals even when introduction has no keywords', () => {
    const fit = matchCreatorTraits({ dna_moods: ['우드톤'], dna_colors: ['베이지'], preferred_spaces: ['카페'], collaboration_goals: ['둘 다'] }, store);
    expect(fit.keywords).toEqual(['우드톤', '베이지', '카페', '판매', '홍보']);
    expect(fit.reasons.join(' ')).toContain('우드톤·베이지');
    expect(fit.reasons.join(' ')).toContain('선호 공간으로 카페');
    expect(fit.reasons.join(' ')).toContain('판매·홍보');
  });

  it('changes fit after changing saved preferences rather than returning a fixed high score', () => {
    const before = matchCreatorTraits({ dna_moods: ['모던'], dna_colors: ['블랙'], preferred_spaces: ['서점'] }, store);
    const after = matchCreatorTraits({ dna_moods: ['우드톤'], dna_colors: ['베이지'], preferred_spaces: ['카페'] }, store);
    const score = (keywords: string[]) => calculateMatchScore({ matchedTermCount: keywords.length, regionFit: true, hasAvailableItems: true, hasExhibitionZones: true });
    expect(score(after.keywords)).toBeGreaterThan(score(before.keywords));
  });

  it('keeps missing and legacy preferences valid without inventing a preference', () => {
    expect(matchCreatorTraits(undefined, store).keywords).toEqual([]);
    expect(matchCreatorTraits({ dna_colors: null, preferred_spaces: ['복합문화공간'] }, store).reasons).toEqual([]);
  });

  it('shows an installation precaution for confirmation instead of matching its negative words', () => {
    const fit = matchCreatorTraits({ install_conditions: '습기가 많은 카페에는 설치할 수 없어요' }, store);
    expect(fit.keywords).toEqual([]);
    expect(fit.reasons).toEqual([]);
    expect(fit.installationNote).toContain('습기가 많은 카페에는 설치할 수 없어요');
  });

  it('normalizes equivalent shop names and does not match empty tags', () => {
    expect(matchCreatorTraits({ preferred_spaces: ['편집샵'], dna_moods: [' ', '우드톤', '우드톤'] }, { ...store, category: '편집숍' }).keywords).toEqual(['우드톤', '편집숍']);
    expect(matchCreatorTraits({ preferred_spaces: [''] }, { ...store, category: '' }).keywords).toEqual([]);
  });

  it('does not infer sales compatibility from an unrelated store purpose', () => {
    expect(matchCreatorTraits({ collaboration_goals: ['작품 판매'] }, { ...store, purpose_tags: ['분위기 전환'] }).keywords).toEqual([]);
  });
});
