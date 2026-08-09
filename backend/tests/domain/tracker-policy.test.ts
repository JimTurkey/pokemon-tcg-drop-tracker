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

  it('uses derived opportunity evidence for the preserved tier rules', () => {
    expect(TRACKER_POLICY_V1.version).toBe('v1');
    expect(TRACKER_POLICY_V1.tierRules.tier1Evidence).toEqual([
      'confirmed_add_to_cart',
      'confirmed_preorder_live',
      'confirmed_local_pickup',
    ]);
    expect(TRACKER_POLICY_V1.tierRules.tier2Evidence).toEqual([
      'likely_stock',
      'likely_preorder',
    ]);
    expect(
      TRACKER_POLICY_V1.tierRules.minimumIndependentSourcesForTier2
    ).toBe(2);
  });

  it('preserves the workbook rumor-readiness issue as unresolved', () => {
    expect(TRACKER_POLICY_V1.unresolvedPolicyDecisions.rumorReadinessFormula.status)
      .toBe('unresolved');
    expect(TRACKER_POLICY_V1.unresolvedPolicyDecisions.rumorReadinessFormula.workbookExpression)
      .toContain('credibilityScore * 12');
  });
});
