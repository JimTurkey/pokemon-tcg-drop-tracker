import { describe, expect, it } from 'vitest';
import { compareRetailerObservations } from '../../src/domain/observation-comparison';
import { createValidRetailerObservation } from '../helpers/retailer-observation';

describe('compareRetailerObservations', () => {
  it('classifies an observation without a prior observation as first seen', () => {
    const current = createValidRetailerObservation();

    expect(compareRetailerObservations(null, current)).toEqual({
      changeState: 'first_seen',
      changedFields: [],
      previousObservedAt: null,
    });
  });

  it('is unchanged despite new per-observation metadata', () => {
    const previous = createValidRetailerObservation();
    const current = structuredClone(previous);
    current.observedAt = '2026-08-09T12:05:01.000Z';
    current.acquisition.acquiredAt = '2026-08-09T12:05:00.000Z';
    current.confidenceScore = 90;
    current.evidence = current.evidence.map((evidence) => ({
      ...evidence,
      confidenceScore: Math.max(0, evidence.confidenceScore - 1),
    }));

    expect(compareRetailerObservations(previous, current)).toEqual({
      changeState: 'unchanged',
      changedFields: [],
      previousObservedAt: previous.observedAt,
    });
  });

  it('classifies hidden to visible as activated', () => {
    const previous = createValidRetailerObservation();
    previous.listing.visibility = 'hidden';
    const current = structuredClone(previous);
    current.listing.visibility = 'visible';

    expect(compareRetailerObservations(previous, current)).toMatchObject({
      changeState: 'activated',
      changedFields: ['listing.visibility'],
    });
  });

  it('classifies visible to hidden as deactivated', () => {
    const previous = createValidRetailerObservation();
    const current = structuredClone(previous);
    current.listing.visibility = 'hidden';

    expect(compareRetailerObservations(previous, current)).toMatchObject({
      changeState: 'deactivated',
      changedFields: ['listing.visibility'],
    });
  });

  it('classifies a price change as changed', () => {
    const previous = createValidRetailerObservation();
    const current = structuredClone(previous);
    current.price = { amount: 44.99, currency: 'USD' };

    expect(compareRetailerObservations(previous, current)).toMatchObject({
      changeState: 'changed',
      changedFields: ['price'],
    });
  });

  it('classifies a stock change as changed', () => {
    const previous = createValidRetailerObservation();
    const current = structuredClone(previous);
    current.availability.stock = 'out_of_stock';

    expect(compareRetailerObservations(previous, current)).toMatchObject({
      changeState: 'changed',
      changedFields: ['availability.stock'],
    });
  });

  it('classifies a purchase-action change as changed', () => {
    const previous = createValidRetailerObservation();
    const current = structuredClone(previous);
    current.actions.addToCart = {
      ...current.actions.addToCart,
      state: 'disabled',
      label: 'Unavailable',
    };

    expect(compareRetailerObservations(previous, current)).toMatchObject({
      changeState: 'changed',
      changedFields: ['actions.addToCart'],
    });
  });

  it('ignores a canonical product key enrichment change', () => {
    const previous = createValidRetailerObservation();
    previous.product.canonicalProductKey = null;
    const current = structuredClone(previous);
    current.product.canonicalProductKey = 'example-set:etb';

    expect(compareRetailerObservations(previous, current)).toMatchObject({
      changeState: 'unchanged',
      changedFields: [],
    });
  });

  it('ignores a product type enrichment change', () => {
    const previous = createValidRetailerObservation();
    previous.product.productType = null;
    const current = structuredClone(previous);
    current.product.productType = 'etb';

    expect(compareRetailerObservations(previous, current)).toMatchObject({
      changeState: 'unchanged',
      changedFields: [],
    });
  });

  it('still classifies a retailer SKU change as changed', () => {
    const previous = createValidRetailerObservation();
    const current = structuredClone(previous);
    current.product.retailerSku = '87654321';

    expect(compareRetailerObservations(previous, current)).toMatchObject({
      changeState: 'changed',
      changedFields: ['product.retailerSku'],
    });
  });

  it('still classifies a raw product-name change as changed', () => {
    const previous = createValidRetailerObservation();
    const current = structuredClone(previous);
    current.product.rawName = 'Pokémon TCG Renamed Elite Trainer Box';

    expect(compareRetailerObservations(previous, current)).toMatchObject({
      changeState: 'changed',
      changedFields: ['product.rawName'],
    });
  });
});
