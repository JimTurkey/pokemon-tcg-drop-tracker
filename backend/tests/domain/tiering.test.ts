import { describe, expect, it } from 'vitest';
import { evaluateTier, TierInput } from '../../src/domain/tiering';

const eligibleInput: TierInput = {
  retailer: 'pokemon_center',
  productType: 'etb',
  country: 'US',
  sellerClassification: 'first_party',
  availabilityState: 'add_to_cart',
  independentSourceCount: 0,
};

describe('evaluateTier', () => {
  it.each(['add_to_cart', 'preorder_live', 'local_pickup_available'] as const)(
    'classifies confirmed %s as Tier 1',
    (availabilityState) => {
      expect(evaluateTier({ ...eligibleInput, availabilityState })).toEqual({
        eligible: true,
        tier: 'tier_1',
        reason: 'confirmed',
      });
    }
  );

  it.each(['likely_stock', 'likely_preorder'] as const)(
    'requires two independent sources for Tier 2 %s',
    (availabilityState) => {
      expect(evaluateTier({
        ...eligibleInput,
        availabilityState,
        independentSourceCount: 1,
      }).tier).toBe('rumor');
      expect(evaluateTier({
        ...eligibleInput,
        availabilityState,
        independentSourceCount: 2,
      })).toEqual({
        eligible: true,
        tier: 'tier_2',
        reason: 'multi_source_likely',
      });
    }
  );

  it.each(['third_party', 'mixed', 'unknown'] as const)(
    'rejects %s sellers',
    (sellerClassification) => {
      expect(evaluateTier({ ...eligibleInput, sellerClassification })).toEqual({
        eligible: false,
        tier: null,
        reason: 'seller_not_first_party',
      });
    }
  );

  it('rejects marketplace-only availability', () => {
    expect(evaluateTier({
      ...eligibleInput,
      availabilityState: 'marketplace_only',
    })).toEqual({
      eligible: false,
      tier: null,
      reason: 'marketplace_only',
    });
  });

  it.each([
    [{ retailer: 'amazon' }, 'retailer_out_of_scope'],
    [{ productType: 'premium_collection' }, 'product_type_out_of_scope'],
    [{ country: 'CA' }, 'country_out_of_scope'],
  ] as const)('rejects canonical-scope exclusion %s', (override, reason) => {
    expect(evaluateTier({ ...eligibleInput, ...override })).toEqual({
      eligible: false,
      tier: null,
      reason,
    });
  });
});
