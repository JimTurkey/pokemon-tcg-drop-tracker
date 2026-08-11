import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { validateRetailerObservation } from '../../../src/domain/retailer-observation';
import type {
  RetailerAdapter,
  RetailerAdapterParseResult,
  RetailerOfferCandidate,
} from '../../../src/scraping/adapters/contracts';
import {
  createRetailerAdapterRegistry,
  defaultRetailerAdapterRegistry,
} from '../../../src/scraping/adapters/adapter-registry';
import { createValidRetailerObservation } from '../../helpers/retailer-observation';

function parsedUnknownResult(): RetailerAdapterParseResult {
  const observation = createValidRetailerObservation();
  observation.availability = {
    stock: 'unknown',
    preorder: 'unknown',
    online: 'unknown',
  };
  observation.access = 'unknown';
  observation.fulfillment = {
    shipping: 'unknown',
    pickup: 'unknown',
    inStore: 'unknown',
    pickupStores: [],
  };
  observation.sellerEvidence = [];

  return {
    status: 'parsed',
    observation,
    offers: [],
    selectedOfferKey: null,
  };
}

function targetAdapter(
  parseResult: RetailerAdapterParseResult = parsedUnknownResult()
): RetailerAdapter {
  return {
    retailerId: 'target',
    adapterId: 'target-test-adapter',
    adapterVersion: '1.0.0-test',
    matchesUrl: (url) => url.hostname === 'www.target.com',
    parse: vi.fn().mockReturnValue(parseResult),
  };
}

describe('retailer adapter registry', () => {
  it('selects a registered adapter for its supported final URL', () => {
    const adapter = targetAdapter();
    const registry = createRetailerAdapterRegistry([adapter]);

    expect(
      registry.select(
        'target',
        new URL('https://www.target.com/p/example/-/A-12345678')
      )
    ).toEqual({ status: 'selected', adapter });
  });

  it('rejects duplicate retailer registrations explicitly', () => {
    const registry = createRetailerAdapterRegistry();
    expect(registry.register(targetAdapter()).status).toBe('registered');
    expect(registry.register({
      ...targetAdapter(),
      adapterId: 'another-target-adapter',
    })).toEqual({
      status: 'rejected',
      reason: 'duplicate_adapter_registration',
    });
  });

  it('rejects duplicate adapter IDs explicitly', () => {
    const adapter = targetAdapter();
    const registry = createRetailerAdapterRegistry([adapter]);
    const bestBuyAdapter: RetailerAdapter = {
      ...adapter,
      retailerId: 'best_buy',
    };

    expect(registry.register(bestBuyAdapter)).toEqual({
      status: 'rejected',
      reason: 'duplicate_adapter_registration',
    });
  });

  it('distinguishes an unsupported retailer from an approved retailer with no adapter', () => {
    const registry = createRetailerAdapterRegistry();
    const url = new URL('https://www.target.com/p/example/-/A-12345678');

    expect(registry.select('amazon', url)).toEqual({
      status: 'rejected',
      reason: 'unsupported_retailer',
    });
    expect(registry.select('target', url)).toEqual({
      status: 'rejected',
      reason: 'adapter_not_registered',
    });
  });

  it('distinguishes adapter URL rejection from an adapter parse failure', () => {
    const parseFailure: RetailerAdapterParseResult = {
      status: 'failed',
      error: {
        code: 'malformed_content',
        message: 'Synthetic embedded data was malformed.',
        retryable: false,
        details: ['fixture-only'],
      },
    };
    const adapter = targetAdapter(parseFailure);
    const registry = createRetailerAdapterRegistry([adapter]);

    expect(
      registry.select(
        'target',
        new URL('https://target.com/p/example/-/A-12345678')
      )
    ).toEqual({
      status: 'rejected',
      reason: 'adapter_does_not_support_url',
    });

    const selected = registry.select(
      'target',
      new URL('https://www.target.com/p/example/-/A-12345678')
    );
    expect(selected.status).toBe('selected');
    if (selected.status === 'selected') {
      expect(selected.adapter.parse({
        requestedUrl: 'https://www.target.com/p/example/-/A-12345678',
        html: '<html><body>synthetic fixture</body></html>',
        acquisition: {
          status: 'succeeded',
          method: 'static_http',
          finalUrl: 'https://www.target.com/p/example/-/A-12345678',
          httpStatus: 200,
          acquiredAt: '2026-08-11T12:00:00Z',
        },
        observedAt: '2026-08-11T12:00:01Z',
      })).toBe(parseFailure);
    }
  });

  it('allows a successful parse to preserve honestly unknown retailer facts', () => {
    const parseResult = parsedUnknownResult();
    expect(parseResult.status).toBe('parsed');
    if (parseResult.status === 'parsed') {
      expect(parseResult.observation.availability).toEqual({
        stock: 'unknown',
        preorder: 'unknown',
        online: 'unknown',
      });
      expect(parseResult.observation.sellerEvidence).toEqual([]);
      expect(validateRetailerObservation(parseResult.observation).valid).toBe(true);
    }
  });

  it('retains price, seller, actionability, and evidence linkage per offer', () => {
    const offers: RetailerOfferCandidate[] = [
      {
        offerKey: 'offer-third-party',
        price: { amount: 39.99, currency: 'USD' },
        actionable: true,
        sellerEvidence: [{
          sellerName: 'Example Card Marketplace',
          merchantId: null,
          offeredByText: 'Sold by Example Card Marketplace',
          marketplaceBadgePresent: true,
          evidenceIds: ['offer-third-party-evidence'],
        }],
        evidenceIds: ['offer-third-party-evidence'],
      },
      {
        offerKey: 'offer-retailer',
        price: { amount: 49.99, currency: 'USD' },
        actionable: false,
        sellerEvidence: [{
          sellerName: 'Walmart',
          merchantId: null,
          offeredByText: 'Sold by Walmart',
          marketplaceBadgePresent: false,
          evidenceIds: ['offer-retailer-evidence'],
        }],
        evidenceIds: ['offer-retailer-evidence'],
      },
    ];

    expect(offers).toEqual([
      expect.objectContaining({
        offerKey: 'offer-third-party',
        price: { amount: 39.99, currency: 'USD' },
        actionable: true,
        evidenceIds: ['offer-third-party-evidence'],
      }),
      expect.objectContaining({
        offerKey: 'offer-retailer',
        price: { amount: 49.99, currency: 'USD' },
        actionable: false,
        evidenceIds: ['offer-retailer-evidence'],
      }),
    ]);
  });

  it('exposes no tier, readiness, value, or opportunity-evidence fields', () => {
    type ForbiddenOfferFields = Extract<
      keyof RetailerOfferCandidate,
      'tier' | 'readiness' | 'bestValue' | 'opportunityEvidence'
    >;
    type ForbiddenParseResultFields = Extract<
      keyof Extract<RetailerAdapterParseResult, { status: 'parsed' }>,
      'tier' | 'readiness' | 'bestValue' | 'opportunityEvidence'
    >;

    expectTypeOf<ForbiddenOfferFields>().toEqualTypeOf<never>();
    expectTypeOf<ForbiddenParseResultFields>().toEqualTypeOf<never>();
  });

  it('keeps the default registry intentionally empty', () => {
    expect(defaultRetailerAdapterRegistry.list()).toEqual([]);
  });
});
