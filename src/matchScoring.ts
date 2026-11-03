export function calculateMatchScore(input: { matchedTermCount: number; regionFit: boolean; hasAvailableItems: boolean; hasExhibitionZones: boolean }) {
  const taste = Math.min(40, Math.max(0, input.matchedTermCount) * 10);
  return Math.min(100, taste + (input.regionFit ? 20 : 0) + (input.hasAvailableItems ? 20 : 0) + (input.hasExhibitionZones ? 20 : 0));
}
