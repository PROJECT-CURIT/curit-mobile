import { describe, expect, it } from 'vitest';
import { calculateMatchScore } from './matchScoring';

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
