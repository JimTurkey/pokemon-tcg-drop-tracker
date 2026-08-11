import type {
  AcquisitionFailure,
  AcquisitionSuccess,
  NormalizedRetailerObservation,
  PurchaseActionEvidence,
  RetailerObservationAttempt,
} from '../../domain/retailer-observation';
import type {
  FulfillmentChannelState,
  RetailerId,
  StockAvailabilityState,
} from '../../domain/tracker-types';
import type { ScrapedProduct } from '../contracts';

export interface LegacySuccessfulObservationContext {
  retailerId: RetailerId;
  retailerHostname: string;
  adapterId: string;
  adapterVersion: string;
  retailerSku: string | null;
  acquisition: AcquisitionSuccess;
  observedAt: string;
  confidenceScore: number;
}

export type LegacyObservationMappingInput =
  | {
      status: 'succeeded';
      scrapedProduct: ScrapedProduct;
      context: LegacySuccessfulObservationContext;
    }
  | {
      status: 'failed';
      acquisition: AcquisitionFailure;
    };

function unknownAction(): PurchaseActionEvidence {
  return {
    state: 'unknown',
    label: null,
    targetUrl: null,
    evidenceIds: [],
  };
}

function mapLegacyStockStatus(
  status: ScrapedProduct['stockStatus']
): StockAvailabilityState {
  return status;
}

function mapLegacyOnlineAvailability(
  status: ScrapedProduct['stockStatus']
): FulfillmentChannelState {
  if (status === 'in_stock') return 'available';
  if (status === 'out_of_stock') return 'unavailable';
  return 'unknown';
}

export function mapLegacyObservation(
  input: LegacyObservationMappingInput
): RetailerObservationAttempt {
  if (input.status === 'failed') {
    return {
      status: 'failed',
      acquisition: input.acquisition,
      observation: null,
    };
  }

  const { context, scrapedProduct } = input;
  const legacyStockEvidenceId = 'legacy-stock-status';
  const observation: NormalizedRetailerObservation = {
    schemaVersion: 'retailer-observation.v1',
    retailer: {
      id: context.retailerId,
      hostname: context.retailerHostname,
      adapterId: context.adapterId,
      adapterVersion: context.adapterVersion,
    },
    product: {
      retailerSku: context.retailerSku,
      rawName: scrapedProduct.name,
      canonicalProductKey: null,
      productType: null,
    },
    listing: {
      canonicalUrl: context.acquisition.finalUrl,
      visibility: 'unknown',
      releaseState: 'unknown',
      releaseDate: null,
    },
    price: scrapedProduct.price
      ? {
          amount: scrapedProduct.price.price,
          currency: scrapedProduct.price.currency,
        }
      : null,
    availability: {
      stock: mapLegacyStockStatus(scrapedProduct.stockStatus),
      preorder: 'unknown',
      online: mapLegacyOnlineAvailability(scrapedProduct.stockStatus),
    },
    access: 'unknown',
    fulfillment: {
      shipping: 'unknown',
      pickup: 'unknown',
      inStore: 'unknown',
      pickupStores: [],
    },
    actions: {
      addToCart: unknownAction(),
      preorder: unknownAction(),
      notifyMe: unknownAction(),
      waitlist: unknownAction(),
    },
    sellerEvidence: [],
    acquisition: context.acquisition,
    observedAt: context.observedAt,
    confidenceScore: context.confidenceScore,
    evidence: [
      {
        id: legacyStockEvidenceId,
        kind: 'legacy',
        field: 'availability.stock',
        value: scrapedProduct.stockStatus,
        source: 'priceghost_legacy_scraper',
        locator: null,
        excerpt: null,
        confidenceScore: context.confidenceScore,
      },
    ],
  };

  return { status: 'succeeded', observation };
}
