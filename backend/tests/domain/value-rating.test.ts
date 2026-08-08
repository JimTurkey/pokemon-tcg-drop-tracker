import { describe, expect, it } from 'vitest';
import { calculateValueRating } from '../../src/domain/value-rating';

describe('calculateValueRating', () => {
  it('rates a high-confidence Booster Box as Best Value', () => {
    expect(calculateValueRating({
      price: 144,
      packCount: 36,
      productType: 'booster_box',
      confidenceLevel: 'high',
    })).toEqual({
      rated: true,
      score: 90,
      stars: 5,
      tag: 'best_value',
      pricePerPack: 4,
    });
  });

  it('keeps the Best Value tag separate from the star rating', () => {
    const result = calculateValueRating({
      price: 20,
      packCount: 4,
      productType: 'special_collection',
      confidenceLevel: 'medium',
    });

    expect(result).toMatchObject({
      rated: true,
      score: 75,
      stars: 4,
      tag: 'strong_value',
    });
  });

  it('returns unrated when price is missing', () => {
    expect(calculateValueRating({
      price: null,
      packCount: 6,
      productType: 'booster_bundle',
      confidenceLevel: 'high',
    })).toEqual({ rated: false, reason: 'missing_price' });
  });

  it('returns unrated when pack count is missing', () => {
    expect(calculateValueRating({
      price: 26.99,
      packCount: null,
      productType: 'booster_bundle',
      confidenceLevel: 'high',
    })).toEqual({ rated: false, reason: 'missing_pack_count' });
  });

  it.each([
    [{ price: 0 }, 'invalid_price'],
    [{ packCount: 0 }, 'invalid_pack_count'],
    [{ productType: 'premium_collection' }, 'product_type_out_of_scope'],
  ] as const)('returns unrated for exclusion %s', (override, reason) => {
    expect(calculateValueRating({
      price: 49.99,
      packCount: 9,
      productType: 'etb',
      confidenceLevel: 'high',
      ...override,
    })).toEqual({ rated: false, reason });
  });
});
