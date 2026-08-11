export const RETAILER_IDS = [
  'pokemon_center',
  'target',
  'best_buy',
  'walmart',
] as const;

export type RetailerId = (typeof RETAILER_IDS)[number];

export const POKEMON_PRODUCT_TYPES = [
  'special_collection',
  'etb',
  'booster_bundle',
  'booster_box',
] as const;

export type PokemonProductType = (typeof POKEMON_PRODUCT_TYPES)[number];

export type CountryCode = 'US';

export const SELLER_CLASSIFICATIONS = [
  'first_party',
  'third_party',
  'mixed',
  'unknown',
] as const;

export type SellerClassification = (typeof SELLER_CLASSIFICATIONS)[number];

export const STOCK_AVAILABILITY_STATES = [
  'unknown',
  'in_stock',
  'out_of_stock',
  'sold_out',
] as const;

export type StockAvailabilityState =
  (typeof STOCK_AVAILABILITY_STATES)[number];

export const RELEASE_STATES = [
  'unknown',
  'coming_soon',
  'released',
] as const;

export type ReleaseState = (typeof RELEASE_STATES)[number];

export const PREORDER_STATES = [
  'unknown',
  'not_applicable',
  'announced',
  'not_live',
  'live',
  'closed',
] as const;

export type PreorderState = (typeof PREORDER_STATES)[number];

export const ACCESS_STATES = [
  'unknown',
  'public',
  'account_required',
  'member_only',
  'invitation_only',
] as const;

export type AccessState = (typeof ACCESS_STATES)[number];

export const FULFILLMENT_CHANNEL_STATES = [
  'unknown',
  'available',
  'unavailable',
  'not_offered',
] as const;

export type FulfillmentChannelState =
  (typeof FULFILLMENT_CHANNEL_STATES)[number];

export const LISTING_VISIBILITY_STATES = [
  'unknown',
  'visible',
  'hidden',
] as const;

export type ListingVisibilityState =
  (typeof LISTING_VISIBILITY_STATES)[number];

export const LISTING_CHANGE_STATES = [
  'unknown',
  'first_seen',
  'unchanged',
  'activated',
  'deactivated',
  'changed',
] as const;

export type ListingChangeState = (typeof LISTING_CHANGE_STATES)[number];

export const PURCHASE_ACTION_STATES = [
  'unknown',
  'enabled',
  'disabled',
  'absent',
] as const;

export type PurchaseActionState = (typeof PURCHASE_ACTION_STATES)[number];

export const OPPORTUNITY_EVIDENCE_STATES = [
  'none',
  'confirmed_add_to_cart',
  'confirmed_preorder_live',
  'confirmed_local_pickup',
  'likely_stock',
  'likely_preorder',
] as const;

export type OpportunityEvidenceState =
  (typeof OPPORTUNITY_EVIDENCE_STATES)[number];

export type OpportunityTier = 'tier_1' | 'tier_2' | 'rumor';

export type ReadinessBand =
  | 'normal'
  | 'watch'
  | 'elevated'
  | 'high_probability'
  | 'drop_likely_imminent';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type BestValueTag =
  | 'best_value'
  | 'strong_value'
  | 'watch'
  | 'low_value';

export type StarRating = 1 | 2 | 3 | 4 | 5;

export function isRetailerId(value: string): value is RetailerId {
  return (RETAILER_IDS as readonly string[]).includes(value);
}

export function isPokemonProductType(value: string): value is PokemonProductType {
  return (POKEMON_PRODUCT_TYPES as readonly string[]).includes(value);
}
