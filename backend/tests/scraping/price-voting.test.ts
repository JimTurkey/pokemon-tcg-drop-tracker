import { describe, expect, it } from 'vitest';
import type { ExtractionMethod, PriceCandidate } from '../../src/scraping/contracts';
import {
  findPriceConsensus,
  pricesMatch,
  selectAnchorCandidate,
  selectPreferredCandidate,
} from '../../src/scraping/legacy/price-voting';

function candidate(
  price: number,
  confidence: number,
  method: ExtractionMethod = 'generic-css'
): PriceCandidate {
  return { price, currency: 'USD', confidence, method };
}

describe('legacy price voting', () => {
  it('groups prices inside the existing 5% threshold', () => {
    expect(pricesMatch(97.51, 102.49)).toBe(true);
  });

  it('does not group prices at the exact existing 5% boundary', () => {
    expect(pricesMatch(97.5, 102.5)).toBe(false);
  });

  it('selects the winning candidate from the largest group', () => {
    const first = candidate(100, 0.6, 'generic-css');
    const matching = candidate(101, 0.9, 'json-ld');
    const other = candidate(140, 0.95, 'site-specific');

    const result = findPriceConsensus([first, matching, other]);

    expect(result.hasConsensus).toBe(true);
    expect(result.groups.map(group => group.length)).toEqual([2, 1]);
    expect(result.price).toBe(matching);
  });

  it('uses average confidence to break equal-size group ties', () => {
    const lowerConfidenceGroup = [
      candidate(100, 0.5, 'generic-css'),
      candidate(101, 0.5, 'site-specific'),
    ];
    const higherConfidenceGroup = [
      candidate(200, 0.8, 'generic-css'),
      candidate(201, 0.9, 'json-ld'),
    ];

    const result = findPriceConsensus([
      ...lowerConfidenceGroup,
      ...higherConfidenceGroup,
    ]);

    expect(result.groups[0]).toEqual(expect.arrayContaining(higherConfidenceGroup));
    expect(result.price).toBe(higherConfidenceGroup[1]);
  });

  it('selects the nearest anchor candidate inside the existing 15% threshold', () => {
    const selected = selectAnchorCandidate([
      candidate(130, 0.9),
      candidate(114.99, 0.6),
    ], 100);

    expect(selected?.candidate.price).toBe(114.99);
    expect(selected?.withinTolerance).toBe(true);
  });

  it('preserves the strict existing 15% anchor boundary', () => {
    const selected = selectAnchorCandidate([candidate(115, 0.9)], 100);

    expect(selected?.candidate.price).toBe(115);
    expect(selected?.withinTolerance).toBe(false);
  });

  it('selects the highest-confidence candidate from the preferred method', () => {
    const selected = selectPreferredCandidate([
      candidate(30, 0.7, 'site-specific'),
      candidate(31, 0.9, 'site-specific'),
      candidate(32, 1, 'json-ld'),
    ], 'site-specific');

    expect(selected?.price).toBe(31);
  });
});
