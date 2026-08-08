import { TRACKER_POLICY_V1 } from './tracker-policy.v1';
import {
  AvailabilityState,
  isPokemonProductType,
  isRetailerId,
  OpportunityTier,
  SellerClassification,
} from './tracker-types';

export interface TierInput {
  retailer: string;
  productType: string;
  country: string;
  sellerClassification: SellerClassification;
  availabilityState: AvailabilityState;
  independentSourceCount: number;
}

export type TierExclusionReason =
  | 'retailer_out_of_scope'
  | 'product_type_out_of_scope'
  | 'country_out_of_scope'
  | 'seller_not_first_party'
  | 'marketplace_only';

export interface TierResult {
  eligible: boolean;
  tier: OpportunityTier | null;
  reason: TierExclusionReason | 'confirmed' | 'multi_source_likely' | 'rumor_only';
}

export function evaluateTier(input: TierInput): TierResult {
  const rules = TRACKER_POLICY_V1.tierRules;

  if (!isRetailerId(input.retailer)) {
    return { eligible: false, tier: null, reason: 'retailer_out_of_scope' };
  }

  if (!isPokemonProductType(input.productType)) {
    return { eligible: false, tier: null, reason: 'product_type_out_of_scope' };
  }

  if (input.country !== TRACKER_POLICY_V1.scope.country) {
    return { eligible: false, tier: null, reason: 'country_out_of_scope' };
  }

  if (rules.rejectedSellerClassifications.includes(input.sellerClassification)) {
    return { eligible: false, tier: null, reason: 'seller_not_first_party' };
  }

  if (rules.excludedAvailability.includes(input.availabilityState)) {
    return { eligible: false, tier: null, reason: 'marketplace_only' };
  }

  if (rules.tier1Availability.includes(input.availabilityState)) {
    return { eligible: true, tier: 'tier_1', reason: 'confirmed' };
  }

  const sourceCount = Math.max(
    0,
    Math.floor(Number.isFinite(input.independentSourceCount) ? input.independentSourceCount : 0)
  );
  if (
    rules.tier2Availability.includes(input.availabilityState) &&
    sourceCount >= rules.minimumIndependentSourcesForTier2
  ) {
    return { eligible: true, tier: 'tier_2', reason: 'multi_source_likely' };
  }

  return { eligible: true, tier: 'rumor', reason: 'rumor_only' };
}
