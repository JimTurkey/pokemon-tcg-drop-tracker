import { describe, expect, it } from 'vitest';
import type {
  AcquisitionFailure,
  AcquisitionSuccess,
} from '../../src/domain/retailer-observation';
import type { ScrapedProduct } from '../../src/scraping/contracts';
import {
  LegacySuccessfulObservationContext,
  mapLegacyObservation,
} from '../../src/scraping/legacy/legacy-observation-mapping';

const acquisition: AcquisitionSuccess = {
  status: 'succeeded',
  method: 'static_http',
  finalUrl: 'https://www.target.com/p/example/-/A-12345678',
  httpStatus: 200,
  acquiredAt: '2026-08-09T12:00:00.000Z',
};

const context: LegacySuccessfulObservationContext = {
  retailerId: 'target',
  retailerHostname: 'www.target.com',
  adapterId: 'priceghost-legacy-bridge',
  adapterVersion: '1.0.0',
  retailerSku: null,
  acquisition,
  observedAt: '2026-08-09T12:00:01.000Z',
  confidenceScore: 60,
};

function legacyProduct(
  stockStatus: ScrapedProduct['stockStatus']
): ScrapedProduct {
  return {
    name: 'Pokémon TCG Example Elite Trainer Box',
    price: { price: 49.99, currency: 'USD' },
    imageUrl: null,
    url: acquisition.finalUrl,
    stockStatus,
    aiStatus: null,
  };
}

describe('mapLegacyObservation', () => {
  it('maps legacy in-stock without implying add-to-cart, preorder, pickup, or seller', () => {
    const result = mapLegacyObservation({
      status: 'succeeded',
      scrapedProduct: legacyProduct('in_stock'),
      context,
    });

    expect(result.status).toBe('succeeded');
    if (result.status !== 'succeeded') return;
    expect(result.observation.availability).toEqual({
      stock: 'in_stock',
      preorder: 'unknown',
      online: 'available',
    });
    expect(result.observation.actions.addToCart.state).toBe('unknown');
    expect(result.observation.actions.preorder.state).toBe('unknown');
    expect(result.observation.fulfillment.pickup).toBe('unknown');
    expect(result.observation.fulfillment.pickupStores).toEqual([]);
    expect(result.observation.sellerEvidence).toEqual([]);
  });

  it('maps legacy out-of-stock without claiming sold-out, coming-soon, or preorder', () => {
    const result = mapLegacyObservation({
      status: 'succeeded',
      scrapedProduct: legacyProduct('out_of_stock'),
      context,
    });

    expect(result.status).toBe('succeeded');
    if (result.status !== 'succeeded') return;
    expect(result.observation.availability.stock).toBe('out_of_stock');
    expect(result.observation.availability.stock).not.toBe('sold_out');
    expect(result.observation.listing.releaseState).toBe('unknown');
    expect(result.observation.availability.preorder).toBe('unknown');
  });

  it('keeps legacy unknown as a successful observation with unknown facts', () => {
    const result = mapLegacyObservation({
      status: 'succeeded',
      scrapedProduct: legacyProduct('unknown'),
      context,
    });

    expect(result.status).toBe('succeeded');
    if (result.status !== 'succeeded') return;
    expect(result.observation.availability).toEqual({
      stock: 'unknown',
      preorder: 'unknown',
      online: 'unknown',
    });
    expect(result.observation.acquisition.status).toBe('succeeded');
  });

  it('maps acquisition failure to a failed attempt with no observation', () => {
    const failure: AcquisitionFailure = {
      status: 'failed',
      method: 'browser',
      requestedUrl: acquisition.finalUrl,
      reason: 'blocked_or_challenged',
      httpStatus: 403,
      errorCode: 'cloudflare_challenge',
      occurredAt: '2026-08-09T12:00:00.000Z',
    };

    expect(mapLegacyObservation({ status: 'failed', acquisition: failure })).toEqual({
      status: 'failed',
      acquisition: failure,
      observation: null,
    });
  });

  it.each(['in_stock', 'out_of_stock', 'unknown'] as const)(
    'retains legacy %s in provenance',
    (stockStatus) => {
      const result = mapLegacyObservation({
        status: 'succeeded',
        scrapedProduct: legacyProduct(stockStatus),
        context,
      });

      expect(result.status).toBe('succeeded');
      if (result.status !== 'succeeded') return;
      expect(result.observation.evidence).toContainEqual(
        expect.objectContaining({
          id: 'legacy-stock-status',
          kind: 'legacy',
          value: stockStatus,
          source: 'priceghost_legacy_scraper',
        })
      );
    }
  );
});
