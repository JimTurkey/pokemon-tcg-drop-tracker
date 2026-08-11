import type {
  AcquisitionSuccess,
  Money,
  NormalizedRetailerObservation,
  SellerEvidence,
} from '../../domain/retailer-observation';
import type { RetailerId } from '../../domain/tracker-types';

/**
 * Immutable content and metadata supplied to a retailer adapter after acquisition
 * and requested/final URL validation have completed.
 */
export interface RetailerAdapterInput {
  requestedUrl: string;
  html: string;
  acquisition: AcquisitionSuccess;
  observedAt: string;
}

/**
 * Raw offer facts retained before seller validation. The offer key and evidence
 * references preserve the relationship between price, seller, and actionability.
 */
export interface RetailerOfferCandidate {
  offerKey: string;
  price: Money | null;
  actionable: boolean | null;
  sellerEvidence: readonly SellerEvidence[];
  evidenceIds: readonly string[];
}

export const ADAPTER_PARSE_ERROR_CODES = [
  'invalid_input',
  'unsupported_content',
  'malformed_content',
  'missing_required_fact',
  'unexpected_error',
] as const;

export type AdapterParseErrorCode =
  (typeof ADAPTER_PARSE_ERROR_CODES)[number];

/** Safe diagnostics only; adapters must not expose raw credentials or secrets. */
export interface AdapterParseError {
  code: AdapterParseErrorCode;
  message: string;
  retryable: boolean;
  details: readonly string[];
}

export type RetailerAdapterParseResult =
  | {
      status: 'parsed';
      observation: NormalizedRetailerObservation;
      offers: readonly RetailerOfferCandidate[];
      selectedOfferKey: string | null;
    }
  | {
      status: 'failed';
      error: AdapterParseError;
    };

/**
 * Retailer adapters are pure parsers over already-acquired content. They do not
 * perform network/browser I/O, persistence, notifications, seller
 * classification, or opportunity/readiness/value/tier calculations.
 */
export interface RetailerAdapter {
  retailerId: RetailerId;
  adapterId: string;
  adapterVersion: string;
  matchesUrl(url: URL): boolean;
  parse(input: RetailerAdapterInput): RetailerAdapterParseResult;
}
