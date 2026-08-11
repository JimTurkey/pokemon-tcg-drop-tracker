import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { SellerEvidence } from '../../src/domain/retailer-observation';
import {
  createSellerValidator,
  FIRST_PARTY_SELLER_POLICIES_V1,
  normalizeSellerIdentity,
  validateSeller,
} from '../../src/domain/seller-validation';
import { evaluateTier } from '../../src/domain/tiering';
import type { RetailerId } from '../../src/domain/tracker-types';
import type { RetailerOfferCandidate } from '../../src/scraping/adapters/contracts';
import sellerFixture from '../fixtures/retailers/seller-evidence-cases.json';

type FixtureCaseName = keyof typeof sellerFixture.cases;

function fixtureCase(name: FixtureCaseName): readonly SellerEvidence[] {
  return sellerFixture.cases[name] as readonly SellerEvidence[];
}

function validate(
  retailerId: RetailerId,
  sellerEvidence: readonly SellerEvidence[]
) {
  return validateSeller({ retailerId, sellerEvidence });
}

describe('seller validation V1 policy', () => {
  it('uses only the explicitly reviewed V1 seller names and no merchant IDs', () => {
    expect(FIRST_PARTY_SELLER_POLICIES_V1).toEqual({
      pokemon_center: {
        retailerId: 'pokemon_center',
        sellerNames: ['Pokémon Center', 'Pokemon Center'],
        merchantIds: [],
      },
      target: {
        retailerId: 'target',
        sellerNames: ['Target'],
        merchantIds: [],
      },
      best_buy: {
        retailerId: 'best_buy',
        sellerNames: ['Best Buy'],
        merchantIds: [],
      },
      walmart: {
        retailerId: 'walmart',
        sellerNames: ['Walmart', 'Walmart.com'],
        merchantIds: [],
      },
    });
  });

  it('normalizes safely without fuzzy matching', () => {
    expect(normalizeSellerIdentity('  BEST   Buy  ')).toBe('best buy');
    expect(normalizeSellerIdentity('Best Buys')).not.toBe('best buy');
  });

  it.each([
    ['pokemon_center', 'pokemonCenterFirstParty'],
    ['target', 'targetFirstParty'],
    ['best_buy', 'bestBuyFirstParty'],
    ['walmart', 'walmartFirstParty'],
  ] as const)(
    'recognizes the reviewed first-party name for %s',
    (retailerId, caseName) => {
      expect(validate(retailerId, fixtureCase(caseName))).toEqual({
        classification: 'first_party',
        firstParty: true,
        marketplaceOnly: false,
        reasons: ['approved_seller_identity'],
      });
    }
  );

  it('matches first-party names after trim, case-fold, and whitespace collapse', () => {
    expect(validate('walmart', [{
      sellerName: '  wALmArt.COM  ',
      merchantId: null,
      offeredByText: ' SOLD   BY   Walmart.com ',
      marketplaceBadgePresent: false,
      evidenceIds: ['normalized-seller'],
    }])).toEqual({
      classification: 'first_party',
      firstParty: true,
      marketplaceOnly: false,
      reasons: ['approved_seller_identity'],
    });
  });

  it('supports approved merchant IDs without adding unverified IDs to V1', () => {
    const validator = createSellerValidator({
      ...FIRST_PARTY_SELLER_POLICIES_V1,
      target: {
        ...FIRST_PARTY_SELLER_POLICIES_V1.target,
        merchantIds: ['target-confirmed-fixture-id'],
      },
    });

    expect(validator.validate({
      retailerId: 'target',
      sellerEvidence: [{
        sellerName: null,
        merchantId: ' TARGET-CONFIRMED-FIXTURE-ID ',
        offeredByText: null,
        marketplaceBadgePresent: null,
        evidenceIds: ['merchant-id'],
      }],
    })).toEqual({
      classification: 'first_party',
      firstParty: true,
      marketplaceOnly: false,
      reasons: ['approved_merchant_id'],
    });
  });
});

describe('conservative seller classification', () => {
  it('keeps missing evidence unknown', () => {
    expect(validate('target', fixtureCase('missing'))).toEqual({
      classification: 'unknown',
      firstParty: null,
      marketplaceOnly: null,
      reasons: ['missing_seller_evidence'],
    });
  });

  it('does not infer first-party from a false marketplace badge alone', () => {
    expect(
      validate('target', fixtureCase('falseMarketplaceBadgeWithoutSeller'))
    ).toEqual({
      classification: 'unknown',
      firstParty: null,
      marketplaceOnly: null,
      reasons: ['missing_seller_evidence'],
    });
  });

  it('does not infer marketplace-only from a badge without seller/actionability linkage', () => {
    expect(
      validate('walmart', fixtureCase('marketplaceBadgeWithoutSeller'))
    ).toEqual({
      classification: 'unknown',
      firstParty: null,
      marketplaceOnly: null,
      reasons: ['ambiguous_or_conflicting_seller_evidence'],
    });
  });

  it('classifies an explicit unrecognized seller as third-party without guessing marketplace-only', () => {
    expect(validate('walmart', fixtureCase('thirdParty'))).toEqual({
      classification: 'third_party',
      firstParty: false,
      marketplaceOnly: null,
      reasons: ['unrecognized_seller_identity'],
    });
  });

  it('classifies separate first- and third-party offers as mixed', () => {
    expect(validate('walmart', fixtureCase('mixed'))).toEqual({
      classification: 'mixed',
      firstParty: false,
      marketplaceOnly: false,
      reasons: ['mixed_first_and_third_party_evidence'],
    });
  });

  it('does not depend on seller evidence order', () => {
    expect(validate('walmart', fixtureCase('reorderedMultipleSellers'))).toEqual(
      validate('walmart', fixtureCase('mixed'))
    );
  });

  it('does not change classification for repeated seller observations', () => {
    const evidence = fixtureCase('targetFirstParty');
    expect(validate('target', [...evidence, ...evidence])).toEqual(
      validate('target', evidence)
    );
  });

  it('keeps contradictory evidence on one offer unknown', () => {
    expect(validate('target', [{
      sellerName: 'Target',
      merchantId: null,
      offeredByText: 'Sold by Example Card Marketplace',
      marketplaceBadgePresent: true,
      evidenceIds: ['contradictory-offer'],
    }])).toEqual({
      classification: 'unknown',
      firstParty: null,
      marketplaceOnly: null,
      reasons: ['ambiguous_or_conflicting_seller_evidence'],
    });
  });

  it('does not treat array position as first-party preference', () => {
    const firstThirdParty = fixtureCase('reorderedMultipleSellers');
    const firstRetailer = fixtureCase('mixed');

    expect(firstThirdParty[0].sellerName).toBe('Example Card Marketplace');
    expect(firstRetailer[0].sellerName).toBe('Walmart');
    expect(validate('walmart', firstThirdParty)).toEqual(
      validate('walmart', firstRetailer)
    );
  });

  it('does not use the first or minimum-priced offer as seller proof', () => {
    const [firstPartyEvidence, thirdPartyEvidence] = fixtureCase('mixed');
    const offers: RetailerOfferCandidate[] = [
      {
        offerKey: 'lower-third-party-offer',
        price: { amount: 39.99, currency: 'USD' },
        actionable: true,
        sellerEvidence: [thirdPartyEvidence],
        evidenceIds: thirdPartyEvidence.evidenceIds,
      },
      {
        offerKey: 'higher-first-party-offer',
        price: { amount: 49.99, currency: 'USD' },
        actionable: true,
        sellerEvidence: [firstPartyEvidence],
        evidenceIds: firstPartyEvidence.evidenceIds,
      },
    ];
    const classifyOffers = (orderedOffers: readonly RetailerOfferCandidate[]) =>
      validate(
        'walmart',
        orderedOffers.flatMap((offer) => offer.sellerEvidence)
      );

    expect(classifyOffers(offers)).toEqual({
      classification: 'mixed',
      firstParty: false,
      marketplaceOnly: false,
      reasons: ['mixed_first_and_third_party_evidence'],
    });
    expect(classifyOffers([...offers].reverse())).toEqual(classifyOffers(offers));
  });
});

describe('seller-validation boundary', () => {
  it('cannot create Tier 1 without separate confirmed opportunity evidence', () => {
    const sellerValidation = validate(
      'target',
      fixtureCase('targetFirstParty')
    );

    expect(evaluateTier({
      retailer: 'target',
      productType: 'etb',
      country: 'US',
      sellerValidation,
      opportunityEvidence: 'none',
      independentSourceCount: 100,
    })).toEqual({
      eligible: true,
      tier: 'rumor',
      reason: 'rumor_only',
    });
  });

  it('does not depend on tiering, readiness, or opportunity modules', () => {
    const sourcePath = path.resolve(
      __dirname,
      '../../src/domain/seller-validation.ts'
    );
    const source = fs.readFileSync(sourcePath, 'utf8');

    expect(source).not.toMatch(/from ['"].*tiering['"]/);
    expect(source).not.toMatch(/from ['"].*readiness['"]/);
    expect(source).not.toMatch(/from ['"].*opportunit/);
  });
});
