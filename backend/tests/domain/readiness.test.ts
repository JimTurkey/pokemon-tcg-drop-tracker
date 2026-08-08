import { describe, expect, it } from 'vitest';
import { calculateReadiness, getReadinessBand } from '../../src/domain/readiness';

describe('getReadinessBand', () => {
  it.each([
    [0, 'normal'],
    [29, 'normal'],
    [30, 'watch'],
    [49, 'watch'],
    [50, 'elevated'],
    [69, 'elevated'],
    [70, 'high_probability'],
    [89, 'high_probability'],
    [90, 'drop_likely_imminent'],
    [100, 'drop_likely_imminent'],
  ] as const)('maps score %i to %s', (score, band) => {
    expect(getReadinessBand(score)).toBe(band);
  });

  it('clamps scores outside the 0-100 range', () => {
    expect(getReadinessBand(-1)).toBe('normal');
    expect(getReadinessBand(101)).toBe('drop_likely_imminent');
  });
});

describe('calculateReadiness', () => {
  it('returns an auditable workbook-derived component breakdown', () => {
    expect(calculateReadiness({
      confidenceScore: 80,
      independentSourceCount: 3,
      daysToNextRelease: 7,
      stockEvidence: 'confirmed',
      retailer: 'target',
    })).toEqual({
      score: 90,
      band: 'drop_likely_imminent',
      breakdown: {
        confidence: 28,
        independentSources: 12,
        releaseProximity: 30,
        stockEvidence: 15,
        approvedRetailer: 5,
      },
    });
  });

  it('does not award approved-retailer points to an unknown retailer', () => {
    const result = calculateReadiness({
      confidenceScore: 0,
      independentSourceCount: 0,
      daysToNextRelease: null,
      stockEvidence: 'none',
      retailer: 'unknown_retailer',
    });

    expect(result.breakdown.approvedRetailer).toBe(0);
    expect(result.score).toBe(0);
  });

  it.each([
    [2, 35],
    [3, 30],
    [7, 30],
    [8, 20],
    [14, 20],
    [15, 10],
    [30, 10],
    [31, 0],
    [-1, 0],
  ] as const)('applies %i-day release boundary as %i points', (days, expectedPoints) => {
    const result = calculateReadiness({
      confidenceScore: 0,
      independentSourceCount: 0,
      daysToNextRelease: days,
      stockEvidence: 'none',
      retailer: 'unknown_retailer',
    });
    expect(result.breakdown.releaseProximity).toBe(expectedPoints);
  });
});
