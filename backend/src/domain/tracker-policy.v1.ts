import {
  BestValueTag,
  OpportunityEvidenceState,
  PokemonProductType,
  ReadinessBand,
  RetailerId,
  SellerClassification,
} from './tracker-types';

export interface ReadinessBandRule {
  min: number;
  max: number;
  band: ReadinessBand;
  label: string;
}

export const TRACKER_POLICY_V1 = {
  version: 'v1',
  category: 'pokemon_tcg',
  scope: {
    retailers: [
      'pokemon_center',
      'target',
      'best_buy',
      'walmart',
    ] as readonly RetailerId[],
    productTypes: [
      'special_collection',
      'etb',
      'booster_bundle',
      'booster_box',
    ] as readonly PokemonProductType[],
    country: 'US' as const,
    firstPartyOnly: true,
    pickupZipCode: '29631',
  },
  cadenceMinutes: {
    normal: 60,
    within72Hours: 30,
    within24Hours: 15,
    within2Hours: 10,
    activeDropWindow: 5,
    postRush: 30,
    returnToNormalAfterHours: 24,
  },
  readinessBands: [
    { min: 0, max: 29, band: 'normal', label: 'Normal' },
    { min: 30, max: 49, band: 'watch', label: 'Watch' },
    { min: 50, max: 69, band: 'elevated', label: 'Elevated' },
    { min: 70, max: 89, band: 'high_probability', label: 'High probability' },
    { min: 90, max: 100, band: 'drop_likely_imminent', label: 'Drop likely imminent' },
  ] as readonly ReadinessBandRule[],
  priorityOrder: [
    'tier_1',
    'best_value',
    'drop_readiness_score',
    'star_rating',
    'recency',
  ] as const,
  tierRules: {
    tier1Evidence: [
      'confirmed_add_to_cart',
      'confirmed_preorder_live',
      'confirmed_local_pickup',
    ] as readonly OpportunityEvidenceState[],
    tier2Evidence: [
      'likely_stock',
      'likely_preorder',
    ] as readonly OpportunityEvidenceState[],
    minimumIndependentSourcesForTier2: 2,
    rejectedSellerClassifications: [
      'third_party',
      'mixed',
      'unknown',
    ] as readonly SellerClassification[],
  },
  readiness: {
    confidenceWeight: 0.35,
    independentSourcePoints: 4,
    independentSourceCap: 8,
    releaseProximityPoints: {
      within2Days: 35,
      within7Days: 30,
      within14Days: 20,
      within30Days: 10,
    },
    confirmedStockEvidencePoints: 15,
    likelyStockEvidencePoints: 8,
    approvedRetailerPoints: 5,
  },
  value: {
    packValueMultiplier: 200,
    productTypePoints: {
      special_collection: 25,
      etb: 30,
      booster_bundle: 35,
      booster_box: 40,
    } satisfies Record<PokemonProductType, number>,
    specialCollectionBonus: 10,
    starThresholds: {
      five: 85,
      four: 70,
      three: 55,
      two: 40,
    },
    tags: [
      'best_value',
      'strong_value',
      'watch',
      'low_value',
    ] as readonly BestValueTag[],
  },
  unresolvedPolicyDecisions: {
    rumorReadinessFormula: {
      status: 'unresolved',
      workbookExpression:
        'MIN(100, ROUND(credibilityScore * 12, 0) + mention/source/release/retailer bonuses)',
      note:
        'The workbook multiplies an already 0-100 credibility score by 12. V1 intentionally does not implement or correct this formula pending an explicit policy decision.',
    },
  },
} as const;
