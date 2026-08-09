import { describe, expect, it } from 'vitest';
import { evaluateTier, TierInput } from '../../src/domain/tiering';

const eligibleInput: TierInput = {
  retailer: 'pokemon_center',
  productType: 'etb',
  country: 'US',
  sellerValidation: {
    classification: 'first_party',
    firstParty: true,
    marketplaceOnly: false,
    reasons: [],
  },
  opportunityEvidence: 'confirmed_add_to_cart',
  independentSourceCount: 0,
};

describe('evaluateTier', () => {
  it.each([
    'confirmed_add_to_cart',
    'confirmed_preorder_live',
    'confirmed_local_pickup',
  ] as const)('classifies %s as Tier 1', (opportunityEvidence) => {
    expect(evaluateTier({ ...eligibleInput, opportunityEvidence })).toEqual({
      eligible: true,
      tier: 'tier_1',
      reason: 'confirmed',
    });
  });

  it.each([
    [{ retailer: 'amazon' }, 'retailer_out_of_scope'],
    [{ productType: 'premium_collection' }, 'product_type_out_of_scope'],
    [{ country: 'CA' }, 'country_out_of_scope'],
  ] as const)('rejects Tier 1 scope exclusion %s', (override, reason) => {
    expect(evaluateTier({ ...eligibleInput, ...override })).toEqual({
      eligible: false,
      tier: null,
      reason,
    });
  });

  it.each(['third_party', 'mixed', 'unknown'] as const)(
    'rejects %s seller classification',
    (classification) => {
      expect(evaluateTier({
        ...eligibleInput,
        sellerValidation: {
          classification,
          firstParty: false,
          marketplaceOnly: false,
          reasons: [],
        },
      })).toEqual({
        eligible: false,
        tier: null,
        reason: 'seller_not_first_party',
      });
    }
  );

  it.each([false, null] as const)(
    'requires an affirmative first-party determination (%s)',
    (firstParty) => {
      expect(evaluateTier({
        ...eligibleInput,
        sellerValidation: {
          classification: 'first_party',
          firstParty,
          marketplaceOnly: false,
          reasons: [],
        },
      })).toEqual({
        eligible: false,
        tier: null,
        reason: 'seller_not_first_party',
      });
    }
  );

  it('rejects marketplace-only seller validation', () => {
    expect(evaluateTier({
      ...eligibleInput,
      sellerValidation: {
        classification: 'first_party',
        firstParty: true,
        marketplaceOnly: true,
        reasons: ['Only marketplace offers are actionable.'],
      },
    })).toEqual({
      eligible: false,
      tier: null,
      reason: 'marketplace_only',
    });
  });

  it.each(['likely_stock', 'likely_preorder'] as const)(
    'keeps %s at rumor with one source and promotes it to Tier 2 with two',
    (opportunityEvidence) => {
      expect(evaluateTier({
        ...eligibleInput,
        opportunityEvidence,
        independentSourceCount: 1,
      })).toEqual({
        eligible: true,
        tier: 'rumor',
        reason: 'rumor_only',
      });
      expect(evaluateTier({
        ...eligibleInput,
        opportunityEvidence,
        independentSourceCount: 2,
      })).toEqual({
        eligible: true,
        tier: 'tier_2',
        reason: 'multi_source_likely',
      });
    }
  );

  it('keeps no opportunity evidence as rumor', () => {
    expect(evaluateTier({
      ...eligibleInput,
      opportunityEvidence: 'none',
      independentSourceCount: 100,
    })).toEqual({
      eligible: true,
      tier: 'rumor',
      reason: 'rumor_only',
    });
  });

  it('does not use readiness to determine tier', () => {
    const inputWithUnrelatedReadiness = {
      ...eligibleInput,
      opportunityEvidence: 'none',
      readinessScore: 100,
    } as TierInput & { readinessScore: number };

    expect(evaluateTier(inputWithUnrelatedReadiness).tier).toBe('rumor');
  });
});
