import { describe, expect, it } from 'vitest';
import {
  validateRetailerObservation,
} from '../../src/domain/retailer-observation';
import { createValidRetailerObservation } from '../helpers/retailer-observation';

function errorsFor(observation: unknown): readonly string[] {
  const result = validateRetailerObservation(observation);
  expect(result.valid).toBe(false);
  return result.valid ? [] : result.errors;
}

describe('validateRetailerObservation', () => {
  it('accepts a valid rich observation', () => {
    const observation = createValidRetailerObservation();

    expect(validateRetailerObservation(observation)).toEqual({
      valid: true,
      observation,
      errors: [],
    });
  });

  it('keeps stock, preorder, access, and fulfillment combinations independent', () => {
    const observation = createValidRetailerObservation();
    observation.availability.stock = 'in_stock';
    observation.availability.preorder = 'live';
    observation.access = 'invitation_only';
    observation.fulfillment.shipping = 'unavailable';
    observation.fulfillment.pickup = 'available';
    observation.fulfillment.inStore = 'not_offered';

    expect(validateRetailerObservation(observation).valid).toBe(true);
  });

  it('represents invitation-only as access without changing stock', () => {
    const observation = createValidRetailerObservation();
    observation.access = 'invitation_only';
    observation.availability.stock = 'in_stock';

    expect(validateRetailerObservation(observation).valid).toBe(true);
    expect(observation.availability.stock).toBe('in_stock');
  });

  it('accepts a pickup-only fulfillment combination', () => {
    const observation = createValidRetailerObservation();
    observation.availability.online = 'unavailable';
    observation.fulfillment.shipping = 'not_offered';
    observation.fulfillment.pickup = 'available';
    observation.fulfillment.inStore = 'unknown';

    expect(validateRetailerObservation(observation).valid).toBe(true);
  });

  it('accepts an in-store-only fulfillment combination', () => {
    const observation = createValidRetailerObservation();
    observation.availability.online = 'unavailable';
    observation.fulfillment.shipping = 'not_offered';
    observation.fulfillment.pickup = 'not_offered';
    observation.fulfillment.inStore = 'available';
    observation.fulfillment.pickupStores = [];

    expect(validateRetailerObservation(observation).valid).toBe(true);
  });

  it.each([-1, 101, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid observation confidence %s',
    (confidenceScore) => {
      const observation = createValidRetailerObservation();
      observation.confidenceScore = confidenceScore;

      expect(errorsFor(observation)).toContain(
        'confidenceScore must be between 0 and 100.'
      );
    }
  );

  it('rejects invalid evidence confidence', () => {
    const observation = createValidRetailerObservation();
    observation.evidence = [
      { ...observation.evidence[0], confidenceScore: 100.01 },
      ...observation.evidence.slice(1),
    ];

    expect(errorsFor(observation)).toContain(
      'evidence[0].confidenceScore must be between 0 and 100.'
    );
  });

  it.each(['relative/path', 'ftp://target.example/product', 'not a url'])(
    'rejects invalid canonical URL %s',
    (canonicalUrl) => {
      const observation = createValidRetailerObservation();
      observation.listing.canonicalUrl = canonicalUrl;

      expect(errorsFor(observation)).toContain(
        'listing.canonicalUrl must be an absolute HTTP/HTTPS URL.'
      );
    }
  );

  it.each([
    ['observedAt', 'observedAt must be a valid timestamp.'],
    ['acquiredAt', 'acquisition.acquiredAt must be a valid timestamp.'],
  ] as const)('rejects an invalid %s timestamp', (field, message) => {
    const observation = createValidRetailerObservation();
    if (field === 'observedAt') {
      observation.observedAt = 'not-a-timestamp';
    } else {
      observation.acquisition.acquiredAt = 'not-a-timestamp';
    }

    expect(errorsFor(observation)).toContain(message);
  });

  it.each(['usd', 'US', 'USDD', '12A'])(
    'rejects invalid currency %s',
    (currency) => {
      const observation = createValidRetailerObservation();
      observation.price = { amount: 49.99, currency };

      expect(errorsFor(observation)).toContain(
        'price.currency must be a three-letter uppercase code.'
      );
    }
  );

  it('rejects a negative price', () => {
    const observation = createValidRetailerObservation();
    observation.price = { amount: -0.01, currency: 'USD' };

    expect(errorsFor(observation)).toContain(
      'price.amount must be finite and non-negative.'
    );
  });

  it('rejects duplicate evidence IDs', () => {
    const observation = createValidRetailerObservation();
    observation.evidence = [
      ...observation.evidence,
      { ...observation.evidence[0] },
    ];

    expect(errorsFor(observation)).toContain(
      'evidence ID "stock-evidence" must be unique.'
    );
  });

  it.each(['action', 'seller', 'pickup'] as const)(
    'rejects dangling %s evidence references',
    (owner) => {
      const observation = createValidRetailerObservation();
      if (owner === 'action') {
        observation.actions.addToCart = {
          ...observation.actions.addToCart,
          evidenceIds: ['missing-evidence'],
        };
      } else if (owner === 'seller') {
        observation.sellerEvidence = [
          {
            ...observation.sellerEvidence[0],
            evidenceIds: ['missing-evidence'],
          },
        ];
      } else {
        observation.fulfillment.pickupStores = [
          {
            ...observation.fulfillment.pickupStores[0],
            evidenceIds: ['missing-evidence'],
          },
        ];
      }

      expect(errorsFor(observation).some((error) =>
        error.includes('references unknown evidence ID "missing-evidence"')
      )).toBe(true);
    }
  );

  it('rejects an unapproved retailer at runtime', () => {
    const observation = createValidRetailerObservation();
    (observation.retailer as { id: string }).id = 'amazon';

    expect(errorsFor(observation)).toContain(
      'retailer.id must be an approved retailer ID.'
    );
  });
});
