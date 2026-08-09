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

  it.each(['retailerSku', 'rawName', 'canonicalProductKey'] as const)(
    'rejects an empty product.%s',
    (field) => {
      const observation = createValidRetailerObservation();
      observation.product[field] = '';

      expect(errorsFor(observation)).toContain(
        `product.${field} must be null or a nonempty string.`
      );
    }
  );

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

  it('rejects a missing required evidence kind', () => {
    const observation = createValidRetailerObservation();
    delete (observation.evidence[0] as { kind?: unknown }).kind;

    expect(errorsFor(observation)).toContain('evidence[0].kind is invalid.');
  });

  it('rejects an invalid evidence kind', () => {
    const observation = createValidRetailerObservation();
    (observation.evidence[0] as { kind: unknown }).kind = 'retailer_guess';

    expect(errorsFor(observation)).toContain('evidence[0].kind is invalid.');
  });

  it('rejects a missing evidence source', () => {
    const observation = createValidRetailerObservation();
    delete (observation.evidence[0] as { source?: unknown }).source;

    expect(errorsFor(observation)).toContain(
      'evidence[0].source must be nonempty.'
    );
  });

  it('rejects a non-JSON evidence value', () => {
    const observation = createValidRetailerObservation();
    (observation.evidence[0] as { value: unknown }).value = {
      nested: [true, undefined],
    };

    expect(errorsFor(observation)).toContain(
      'evidence[0].value must be JSON-compatible.'
    );
  });

  it('rejects an invalid action target URL', () => {
    const observation = createValidRetailerObservation();
    observation.actions.addToCart = {
      ...observation.actions.addToCart,
      targetUrl: 'javascript:alert(1)',
    };

    expect(errorsFor(observation)).toContain(
      'actions.addToCart.targetUrl must be null or an absolute HTTP/HTTPS URL.'
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
    ['observedAt', 'observedAt must be a valid ISO date-time.'],
    ['acquiredAt', 'acquisition.acquiredAt must be a valid ISO date-time.'],
  ] as const)('rejects an invalid %s timestamp', (field, message) => {
    const observation = createValidRetailerObservation();
    if (field === 'observedAt') {
      observation.observedAt = 'not-a-timestamp';
    } else {
      observation.acquisition.acquiredAt = 'not-a-timestamp';
    }

    expect(errorsFor(observation)).toContain(message);
  });

  it('rejects a non-ISO but parseable observedAt', () => {
    const observation = createValidRetailerObservation();
    observation.observedAt = 'August 9, 2026 12:00:01 UTC';

    expect(Number.isFinite(Date.parse(observation.observedAt))).toBe(true);
    expect(errorsFor(observation)).toContain(
      'observedAt must be a valid ISO date-time.'
    );
  });

  it('rejects a non-ISO but parseable acquisition timestamp', () => {
    const observation = createValidRetailerObservation();
    observation.acquisition.acquiredAt = 'August 9, 2026 12:00:00 UTC';

    expect(Number.isFinite(Date.parse(observation.acquisition.acquiredAt)))
      .toBe(true);
    expect(errorsFor(observation)).toContain(
      'acquisition.acquiredAt must be a valid ISO date-time.'
    );
  });

  it('accepts an ISO date-only listing releaseDate', () => {
    const observation = createValidRetailerObservation();
    observation.listing.releaseDate = '2026-08-09';

    expect(validateRetailerObservation(observation).valid).toBe(true);
  });

  it('rejects an invalid listing releaseDate', () => {
    const observation = createValidRetailerObservation();
    observation.listing.releaseDate = '2026-02-30';

    expect(errorsFor(observation)).toContain(
      'listing.releaseDate must be null, an ISO date, or an ISO date-time.'
    );
  });

  it.each([undefined, 99, 600, 200.5, '200'])(
    'rejects malformed acquisition HTTP status %s',
    (httpStatus) => {
      const observation = createValidRetailerObservation();
      (observation.acquisition as { httpStatus: unknown }).httpStatus = httpStatus;

      expect(errorsFor(observation)).toContain(
        'acquisition.httpStatus must be null or an integer from 100 to 599.'
      );
    }
  );

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

  it.each(['action', 'seller', 'pickup'] as const)(
    'rejects duplicate %s evidence references',
    (owner) => {
      const observation = createValidRetailerObservation();
      let expectedPath: string;
      if (owner === 'action') {
        observation.actions.addToCart = {
          ...observation.actions.addToCart,
          evidenceIds: ['cart-evidence', 'cart-evidence'],
        };
        expectedPath = 'actions.addToCart.evidenceIds';
      } else if (owner === 'seller') {
        observation.sellerEvidence = [
          {
            ...observation.sellerEvidence[0],
            evidenceIds: ['seller-evidence', 'seller-evidence'],
          },
        ];
        expectedPath = 'sellerEvidence[0].evidenceIds';
      } else {
        observation.fulfillment.pickupStores = [
          {
            ...observation.fulfillment.pickupStores[0],
            evidenceIds: ['pickup-evidence', 'pickup-evidence'],
          },
        ];
        expectedPath = 'fulfillment.pickupStores[0].evidenceIds';
      }

      expect(errorsFor(observation)).toContain(
        `${expectedPath} must not contain duplicate evidence IDs.`
      );
    }
  );

  it('rejects a malformed seller evidence field', () => {
    const observation = createValidRetailerObservation();
    (observation.sellerEvidence[0] as { sellerName: unknown }).sellerName = 42;

    expect(errorsFor(observation)).toContain(
      'sellerEvidence[0].sellerName must be null or a string.'
    );
  });

  it('rejects a malformed pickup-store field', () => {
    const observation = createValidRetailerObservation();
    (observation.fulfillment.pickupStores[0] as { postalCode: unknown })
      .postalCode = 29631;

    expect(errorsFor(observation)).toContain(
      'fulfillment.pickupStores[0].postalCode must be null or a string.'
    );
  });

  it('rejects an unapproved retailer at runtime', () => {
    const observation = createValidRetailerObservation();
    (observation.retailer as { id: string }).id = 'amazon';

    expect(errorsFor(observation)).toContain(
      'retailer.id must be an approved retailer ID.'
    );
  });
});
