import { TRACKER_POLICY_V1 } from './tracker-policy.v1';
import {
  BestValueTag,
  ConfidenceLevel,
  isPokemonProductType,
  PokemonProductType,
  StarRating,
} from './tracker-types';

export interface ValueRatingInput {
  price: number | null;
  packCount: number | null;
  productType: string;
  confidenceLevel: ConfidenceLevel;
}

export type UnratedReason =
  | 'missing_price'
  | 'missing_pack_count'
  | 'invalid_price'
  | 'invalid_pack_count'
  | 'product_type_out_of_scope';

export type ValueRatingResult =
  | {
      rated: false;
      reason: UnratedReason;
    }
  | {
      rated: true;
      score: number;
      stars: StarRating;
      tag: BestValueTag;
      pricePerPack: number;
    };

function starRating(score: number): StarRating {
  const thresholds = TRACKER_POLICY_V1.value.starThresholds;
  if (score >= thresholds.five) return 5;
  if (score >= thresholds.four) return 4;
  if (score >= thresholds.three) return 3;
  if (score >= thresholds.two) return 2;
  return 1;
}

function valueTag(stars: StarRating, confidenceLevel: ConfidenceLevel): BestValueTag {
  if (stars >= 4 && confidenceLevel === 'high') return 'best_value';
  if (stars >= 4) return 'strong_value';
  if (stars >= 3) return 'watch';
  return 'low_value';
}

export function calculateValueRating(input: ValueRatingInput): ValueRatingResult {
  if (input.price === null) return { rated: false, reason: 'missing_price' };
  if (input.packCount === null) return { rated: false, reason: 'missing_pack_count' };
  if (!Number.isFinite(input.price) || input.price <= 0) {
    return { rated: false, reason: 'invalid_price' };
  }
  if (!Number.isFinite(input.packCount) || input.packCount <= 0) {
    return { rated: false, reason: 'invalid_pack_count' };
  }
  if (!isPokemonProductType(input.productType)) {
    return { rated: false, reason: 'product_type_out_of_scope' };
  }

  const productType = input.productType as PokemonProductType;
  const policy = TRACKER_POLICY_V1.value;
  const packValuePoints = Math.round(
    (input.packCount / input.price) * policy.packValueMultiplier
  );
  const specialCollectionBonus =
    productType === 'special_collection' ? policy.specialCollectionBonus : 0;
  const score = Math.min(
    100,
    Math.max(
      0,
      packValuePoints + policy.productTypePoints[productType] + specialCollectionBonus
    )
  );
  const stars = starRating(score);

  return {
    rated: true,
    score,
    stars,
    tag: valueTag(stars, input.confidenceLevel),
    pricePerPack: input.price / input.packCount,
  };
}
