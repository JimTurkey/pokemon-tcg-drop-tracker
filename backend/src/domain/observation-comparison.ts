import type { NormalizedRetailerObservation } from './retailer-observation';
import type { ListingChangeState } from './tracker-types';

export interface ObservationComparison {
  changeState: ListingChangeState;
  changedFields: readonly string[];
  previousObservedAt: string | null;
}

export const MEANINGFUL_OBSERVATION_FIELDS = [
  'retailer.id',
  'retailer.hostname',
  'product.retailerSku',
  'product.rawName',
  'listing.canonicalUrl',
  'listing.visibility',
  'listing.releaseState',
  'listing.releaseDate',
  'price',
  'availability.stock',
  'availability.preorder',
  'availability.online',
  'access',
  'fulfillment.shipping',
  'fulfillment.pickup',
  'fulfillment.inStore',
  'fulfillment.pickupStores',
  'actions.addToCart',
  'actions.preorder',
  'actions.notifyMe',
  'actions.waitlist',
  'sellerEvidence',
] as const;

type MeaningfulObservationField =
  (typeof MEANINGFUL_OBSERVATION_FIELDS)[number];

function withoutEvidenceReferences<T extends { evidenceIds: readonly string[] }>(
  value: T
): Omit<T, 'evidenceIds'> {
  const { evidenceIds: _evidenceIds, ...meaningfulValue } = value;
  return meaningfulValue;
}

function sortedSemanticValues(values: readonly unknown[]): readonly unknown[] {
  return [...values].sort((left, right) =>
    JSON.stringify(left).localeCompare(JSON.stringify(right))
  );
}

function meaningfulValue(
  observation: NormalizedRetailerObservation,
  field: MeaningfulObservationField
): unknown {
  switch (field) {
    case 'retailer.id':
      return observation.retailer.id;
    case 'retailer.hostname':
      return observation.retailer.hostname;
    case 'product.retailerSku':
      return observation.product.retailerSku;
    case 'product.rawName':
      return observation.product.rawName;
    case 'listing.canonicalUrl':
      return observation.listing.canonicalUrl;
    case 'listing.visibility':
      return observation.listing.visibility;
    case 'listing.releaseState':
      return observation.listing.releaseState;
    case 'listing.releaseDate':
      return observation.listing.releaseDate;
    case 'price':
      return observation.price;
    case 'availability.stock':
      return observation.availability.stock;
    case 'availability.preorder':
      return observation.availability.preorder;
    case 'availability.online':
      return observation.availability.online;
    case 'access':
      return observation.access;
    case 'fulfillment.shipping':
      return observation.fulfillment.shipping;
    case 'fulfillment.pickup':
      return observation.fulfillment.pickup;
    case 'fulfillment.inStore':
      return observation.fulfillment.inStore;
    case 'fulfillment.pickupStores':
      return sortedSemanticValues(
        observation.fulfillment.pickupStores.map(withoutEvidenceReferences)
      );
    case 'actions.addToCart':
      return withoutEvidenceReferences(observation.actions.addToCart);
    case 'actions.preorder':
      return withoutEvidenceReferences(observation.actions.preorder);
    case 'actions.notifyMe':
      return withoutEvidenceReferences(observation.actions.notifyMe);
    case 'actions.waitlist':
      return withoutEvidenceReferences(observation.actions.waitlist);
    case 'sellerEvidence':
      return sortedSemanticValues(
        observation.sellerEvidence.map(withoutEvidenceReferences)
      );
  }
}

function valuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function compareRetailerObservations(
  previous: NormalizedRetailerObservation | null,
  current: NormalizedRetailerObservation
): ObservationComparison {
  if (previous === null) {
    return {
      changeState: 'first_seen',
      changedFields: [],
      previousObservedAt: null,
    };
  }

  const changedFields = MEANINGFUL_OBSERVATION_FIELDS.filter(
    (field) =>
      !valuesEqual(
        meaningfulValue(previous, field),
        meaningfulValue(current, field)
      )
  );

  let changeState: ListingChangeState;
  if (
    previous.listing.visibility === 'hidden' &&
    current.listing.visibility === 'visible'
  ) {
    changeState = 'activated';
  } else if (
    previous.listing.visibility === 'visible' &&
    current.listing.visibility === 'hidden'
  ) {
    changeState = 'deactivated';
  } else if (changedFields.length === 0) {
    changeState = 'unchanged';
  } else {
    changeState = 'changed';
  }

  return {
    changeState,
    changedFields,
    previousObservedAt: previous.observedAt,
  };
}
