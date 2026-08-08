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

export const AVAILABILITY_STATES = [
  'unknown',
  'coming_soon',
  'preorder_announced',
  'preorder_live',
  'add_to_cart',
  'local_pickup_available',
  'likely_stock',
  'likely_preorder',
  'out_of_stock',
  'sold_out',
  'notify_me',
  'waitlist',
  'invitation_only',
  'marketplace_only',
  'blocked_or_challenged',
  'error',
] as const;

export type AvailabilityState = (typeof AVAILABILITY_STATES)[number];

export const ACCESS_STATES = [
  'public',
  'invitation_only',
  'member_only',
  'account_required',
] as const;

export type AccessState = (typeof ACCESS_STATES)[number];

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
