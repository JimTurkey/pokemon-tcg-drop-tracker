import { describe, expect, it } from 'vitest';
import { TRACKER_POLICY_V1 } from '../../src/domain/tracker-policy.v1';

describe('TRACKER_POLICY_V1', () => {
  it('encodes the canonical scope exactly', () => {
    expect(TRACKER_POLICY_V1.scope).toEqual({
      retailers: ['pokemon_center', 'target', 'best_buy', 'walmart'],
      productTypes: ['special_collection', 'etb', 'booster_bundle', 'booster_box'],
      country: 'US',
      firstPartyOnly: true,
      pickupZipCode: '29631',
    });
  });

  it('encodes the canonical priority order', () => {
    expect(TRACKER_POLICY_V1.priorityOrder).toEqual([
      'tier_1',
      'best_value',
      'drop_readiness_score',
      'star_rating',
      'recency',
    ]);
  });

  it('preserves the workbook rumor-readiness issue as unresolved', () => {
    expect(TRACKER_POLICY_V1.unresolvedPolicyDecisions.rumorReadinessFormula.status)
      .toBe('unresolved');
    expect(TRACKER_POLICY_V1.unresolvedPolicyDecisions.rumorReadinessFormula.workbookExpression)
      .toContain('credibilityScore * 12');
  });
});
