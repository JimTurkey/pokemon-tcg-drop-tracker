import {
  ACCESS_STATES,
  AccessState,
  FULFILLMENT_CHANNEL_STATES,
  FulfillmentChannelState,
  isPokemonProductType,
  isRetailerId,
  LISTING_VISIBILITY_STATES,
  ListingVisibilityState,
  PokemonProductType,
  PREORDER_STATES,
  PreorderState,
  PURCHASE_ACTION_STATES,
  PurchaseActionState,
  RELEASE_STATES,
  ReleaseState,
  RetailerId,
  SellerClassification,
  STOCK_AVAILABILITY_STATES,
  StockAvailabilityState,
} from './tracker-types';

export const RETAILER_OBSERVATION_SCHEMA_VERSION =
  'retailer-observation.v1' as const;

export const ACQUISITION_METHODS = [
  'static_http',
  'browser',
  'retailer_api',
] as const;

export type AcquisitionMethod = (typeof ACQUISITION_METHODS)[number];

export const ACQUISITION_FAILURE_REASONS = [
  'blocked_or_challenged',
  'timeout',
  'http_error',
  'network_error',
  'browser_error',
  'invalid_content',
  'unknown_error',
] as const;

export type AcquisitionFailureReason =
  (typeof ACQUISITION_FAILURE_REASONS)[number];

export const OBSERVATION_EVIDENCE_KINDS = [
  'dom',
  'json_ld',
  'embedded_json',
  'http',
  'browser',
  'legacy',
] as const;

export type ObservationEvidenceKind =
  (typeof OBSERVATION_EVIDENCE_KINDS)[number];

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export interface Money {
  amount: number;
  currency: string;
}

export interface ObservationEvidence {
  id: string;
  kind: ObservationEvidenceKind;
  field: string;
  value: JsonValue;
  source: string;
  locator: string | null;
  excerpt: string | null;
  confidenceScore: number;
}

export interface SellerEvidence {
  sellerName: string | null;
  merchantId: string | null;
  offeredByText: string | null;
  marketplaceBadgePresent: boolean | null;
  evidenceIds: readonly string[];
}

export interface PurchaseActionEvidence {
  state: PurchaseActionState;
  label: string | null;
  targetUrl: string | null;
  evidenceIds: readonly string[];
}

export interface PickupStoreObservation {
  retailerStoreId: string | null;
  name: string | null;
  postalCode: string | null;
  availability: FulfillmentChannelState;
  evidenceIds: readonly string[];
}

export interface AcquisitionSuccess {
  status: 'succeeded';
  method: AcquisitionMethod;
  finalUrl: string;
  httpStatus: number | null;
  acquiredAt: string;
}

export interface AcquisitionFailure {
  status: 'failed';
  method: AcquisitionMethod;
  requestedUrl: string;
  reason: AcquisitionFailureReason;
  httpStatus: number | null;
  errorCode: string | null;
  occurredAt: string;
}

export interface NormalizedRetailerObservation {
  schemaVersion: typeof RETAILER_OBSERVATION_SCHEMA_VERSION;
  retailer: {
    id: RetailerId;
    hostname: string;
    adapterId: string;
    adapterVersion: string;
  };
  product: {
    retailerSku: string | null;
    rawName: string | null;
    /** Populated by later catalog resolution, not trusted retailer markup. */
    canonicalProductKey: string | null;
    /** Populated by later catalog enrichment, not trusted retailer markup. */
    productType: PokemonProductType | null;
  };
  listing: {
    canonicalUrl: string;
    visibility: ListingVisibilityState;
    releaseState: ReleaseState;
    releaseDate: string | null;
  };
  price: Money | null;
  availability: {
    stock: StockAvailabilityState;
    preorder: PreorderState;
    online: FulfillmentChannelState;
  };
  access: AccessState;
  fulfillment: {
    shipping: FulfillmentChannelState;
    pickup: FulfillmentChannelState;
    inStore: FulfillmentChannelState;
    pickupStores: readonly PickupStoreObservation[];
  };
  actions: {
    addToCart: PurchaseActionEvidence;
    preorder: PurchaseActionEvidence;
    notifyMe: PurchaseActionEvidence;
    waitlist: PurchaseActionEvidence;
  };
  /** Raw adapter evidence only. Classification belongs to seller validation. */
  sellerEvidence: readonly SellerEvidence[];
  acquisition: AcquisitionSuccess;
  observedAt: string;
  confidenceScore: number;
  evidence: readonly ObservationEvidence[];
}

export type RetailerObservationAttempt =
  | {
      status: 'succeeded';
      observation: NormalizedRetailerObservation;
    }
  | {
      status: 'failed';
      acquisition: AcquisitionFailure;
      observation: null;
    };

export interface SellerValidationResult {
  classification: SellerClassification;
  firstParty: boolean | null;
  marketplaceOnly: boolean | null;
  reasons: readonly string[];
}

export type RetailerObservationValidationResult =
  | {
      valid: true;
      observation: NormalizedRetailerObservation;
      errors: readonly [];
    }
  | {
      valid: false;
      errors: readonly string[];
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonemptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidCalendarDateParts(
  year: number,
  month: number,
  day: number
): boolean {
  if (month < 1 || month > 12 || day < 1) return false;

  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    isLeapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  return day <= daysInMonth[month - 1];
}

function isValidIsoDate(value: unknown): value is string {
  if (!isNonemptyString(value)) return false;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  return isValidCalendarDateParts(
    Number(match[1]),
    Number(match[2]),
    Number(match[3])
  );
}

function isValidIsoDateTime(value: unknown): value is string {
  if (!isNonemptyString(value)) return false;

  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(
    value
  );
  if (!match) return false;

  const validCalendarDate = isValidCalendarDateParts(
    Number(match[1]),
    Number(match[2]),
    Number(match[3])
  );
  const validTime =
    Number(match[4]) <= 23 &&
    Number(match[5]) <= 59 &&
    Number(match[6]) <= 59;
  const validOffset =
    match[7] === undefined ||
    (Number(match[7]) <= 23 && Number(match[8]) <= 59);

  return (
    validCalendarDate &&
    validTime &&
    validOffset &&
    Number.isFinite(Date.parse(value))
  );
}

function isJsonValue(
  value: unknown,
  ancestors: Set<object> = new Set()
): value is JsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return true;
  }
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object') return false;
  if (ancestors.has(value)) return false;

  ancestors.add(value);
  let valid: boolean;
  if (Array.isArray(value)) {
    valid = value.every((item) => isJsonValue(item, ancestors));
  } else {
    const prototype = Object.getPrototypeOf(value);
    valid =
      (prototype === Object.prototype || prototype === null) &&
      Object.values(value).every((item) => isJsonValue(item, ancestors));
  }
  ancestors.delete(value);

  return valid;
}

function isAbsoluteHttpUrl(value: unknown): value is string {
  if (!isNonemptyString(value)) return false;

  try {
    const parsed = new URL(value);
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      parsed.hostname.length > 0
    );
  } catch {
    return false;
  }
}

function isReasonableHostname(value: unknown): value is string {
  if (!isNonemptyString(value) || value.length > 253) return false;
  const labels = value.split('.');
  if (labels.length < 2) return false;

  return labels.every(
    (label) =>
      label.length > 0 &&
      label.length <= 63 &&
      /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label)
  );
}

function isScore(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 100
  );
}

function includesValue(
  values: readonly string[],
  value: unknown
): value is string {
  return typeof value === 'string' && values.includes(value);
}

function validateEvidenceReferences(
  value: unknown,
  path: string,
  knownEvidenceIds: ReadonlySet<string>,
  errors: string[]
): void {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array.`);
    return;
  }

  const referencedIds = new Set<string>();
  for (const evidenceId of value) {
    if (!isNonemptyString(evidenceId)) {
      errors.push(`${path} must contain only nonempty evidence IDs.`);
    } else if (referencedIds.has(evidenceId)) {
      errors.push(`${path} must not contain duplicate evidence IDs.`);
    } else if (!knownEvidenceIds.has(evidenceId)) {
      errors.push(`${path} references unknown evidence ID "${evidenceId}".`);
    }
    if (isNonemptyString(evidenceId)) referencedIds.add(evidenceId);
  }
}

export function validateRetailerObservation(
  value: unknown
): RetailerObservationValidationResult {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return { valid: false, errors: ['observation must be an object.'] };
  }

  if (value.schemaVersion !== RETAILER_OBSERVATION_SCHEMA_VERSION) {
    errors.push(
      `schemaVersion must be "${RETAILER_OBSERVATION_SCHEMA_VERSION}".`
    );
  }

  const retailer = isRecord(value.retailer) ? value.retailer : null;
  if (!retailer) {
    errors.push('retailer must be an object.');
  } else {
    if (typeof retailer.id !== 'string' || !isRetailerId(retailer.id)) {
      errors.push('retailer.id must be an approved retailer ID.');
    }
    if (!isReasonableHostname(retailer.hostname)) {
      errors.push('retailer.hostname must be a syntactically reasonable hostname.');
    }
    if (!isNonemptyString(retailer.adapterId)) {
      errors.push('retailer.adapterId must be nonempty.');
    }
    if (!isNonemptyString(retailer.adapterVersion)) {
      errors.push('retailer.adapterVersion must be nonempty.');
    }
  }

  const product = isRecord(value.product) ? value.product : null;
  if (!product) {
    errors.push('product must be an object.');
  } else {
    for (const field of [
      'retailerSku',
      'rawName',
      'canonicalProductKey',
    ] as const) {
      if (product[field] !== null && !isNonemptyString(product[field])) {
        errors.push(`product.${field} must be null or a nonempty string.`);
      }
    }
    if (
      product.productType !== null &&
      (typeof product.productType !== 'string' ||
        !isPokemonProductType(product.productType))
    ) {
      errors.push('product.productType must be null or an approved product type.');
    }
  }

  const listing = isRecord(value.listing) ? value.listing : null;
  if (!listing) {
    errors.push('listing must be an object.');
  } else {
    if (!isAbsoluteHttpUrl(listing.canonicalUrl)) {
      errors.push('listing.canonicalUrl must be an absolute HTTP/HTTPS URL.');
    }
    if (!includesValue(LISTING_VISIBILITY_STATES, listing.visibility)) {
      errors.push('listing.visibility is invalid.');
    }
    if (!includesValue(RELEASE_STATES, listing.releaseState)) {
      errors.push('listing.releaseState is invalid.');
    }
    if (
      listing.releaseDate !== null &&
      !isValidIsoDate(listing.releaseDate) &&
      !isValidIsoDateTime(listing.releaseDate)
    ) {
      errors.push('listing.releaseDate must be null, an ISO date, or an ISO date-time.');
    }
  }

  if (value.price !== null) {
    if (!isRecord(value.price)) {
      errors.push('price must be null or an object.');
    } else {
      if (
        typeof value.price.amount !== 'number' ||
        !Number.isFinite(value.price.amount) ||
        value.price.amount < 0
      ) {
        errors.push('price.amount must be finite and non-negative.');
      }
      if (
        typeof value.price.currency !== 'string' ||
        !/^[A-Z]{3}$/.test(value.price.currency)
      ) {
        errors.push('price.currency must be a three-letter uppercase code.');
      }
    }
  }

  const availability = isRecord(value.availability)
    ? value.availability
    : null;
  if (!availability) {
    errors.push('availability must be an object.');
  } else {
    if (!includesValue(STOCK_AVAILABILITY_STATES, availability.stock)) {
      errors.push('availability.stock is invalid.');
    }
    if (!includesValue(PREORDER_STATES, availability.preorder)) {
      errors.push('availability.preorder is invalid.');
    }
    if (!includesValue(FULFILLMENT_CHANNEL_STATES, availability.online)) {
      errors.push('availability.online is invalid.');
    }
  }

  if (!includesValue(ACCESS_STATES, value.access)) {
    errors.push('access is invalid.');
  }

  const fulfillment = isRecord(value.fulfillment) ? value.fulfillment : null;
  if (!fulfillment) {
    errors.push('fulfillment must be an object.');
  } else {
    for (const field of ['shipping', 'pickup', 'inStore'] as const) {
      if (!includesValue(FULFILLMENT_CHANNEL_STATES, fulfillment[field])) {
        errors.push(`fulfillment.${field} is invalid.`);
      }
    }
    if (!Array.isArray(fulfillment.pickupStores)) {
      errors.push('fulfillment.pickupStores must be an array.');
    }
  }

  if (!isScore(value.confidenceScore)) {
    errors.push('confidenceScore must be between 0 and 100.');
  }
  if (!isValidIsoDateTime(value.observedAt)) {
    errors.push('observedAt must be a valid ISO date-time.');
  }

  const acquisition = isRecord(value.acquisition) ? value.acquisition : null;
  if (!acquisition) {
    errors.push('acquisition must be an object.');
  } else {
    if (acquisition.status !== 'succeeded') {
      errors.push('acquisition.status must be "succeeded".');
    }
    if (!includesValue(ACQUISITION_METHODS, acquisition.method)) {
      errors.push('acquisition.method is invalid.');
    }
    if (!isAbsoluteHttpUrl(acquisition.finalUrl)) {
      errors.push('acquisition.finalUrl must be an absolute HTTP/HTTPS URL.');
    }
    if (
      acquisition.httpStatus !== null &&
      (typeof acquisition.httpStatus !== 'number' ||
        !Number.isInteger(acquisition.httpStatus) ||
        acquisition.httpStatus < 100 ||
        acquisition.httpStatus > 599)
    ) {
      errors.push('acquisition.httpStatus must be null or an integer from 100 to 599.');
    }
    if (!isValidIsoDateTime(acquisition.acquiredAt)) {
      errors.push('acquisition.acquiredAt must be a valid ISO date-time.');
    }
  }

  const evidenceItems = Array.isArray(value.evidence) ? value.evidence : null;
  const evidenceIds = new Set<string>();
  if (!evidenceItems) {
    errors.push('evidence must be an array.');
  } else {
    for (const [index, item] of evidenceItems.entries()) {
      const path = `evidence[${index}]`;
      if (!isRecord(item)) {
        errors.push(`${path} must be an object.`);
        continue;
      }
      if (!isNonemptyString(item.id)) {
        errors.push(`${path}.id must be nonempty.`);
      } else if (evidenceIds.has(item.id)) {
        errors.push(`evidence ID "${item.id}" must be unique.`);
      } else {
        evidenceIds.add(item.id);
      }
      if (!includesValue(OBSERVATION_EVIDENCE_KINDS, item.kind)) {
        errors.push(`${path}.kind is invalid.`);
      }
      if (!isNonemptyString(item.field)) {
        errors.push(`${path}.field must be nonempty.`);
      }
      if (!isJsonValue(item.value)) {
        errors.push(`${path}.value must be JSON-compatible.`);
      }
      if (!isNonemptyString(item.source)) {
        errors.push(`${path}.source must be nonempty.`);
      }
      if (item.locator !== null && typeof item.locator !== 'string') {
        errors.push(`${path}.locator must be null or a string.`);
      }
      if (item.excerpt !== null && typeof item.excerpt !== 'string') {
        errors.push(`${path}.excerpt must be null or a string.`);
      }
      if (!isScore(item.confidenceScore)) {
        errors.push(`${path}.confidenceScore must be between 0 and 100.`);
      }
    }
  }

  const actions = isRecord(value.actions) ? value.actions : null;
  if (!actions) {
    errors.push('actions must be an object.');
  } else {
    for (const actionName of [
      'addToCart',
      'preorder',
      'notifyMe',
      'waitlist',
    ] as const) {
      const action = isRecord(actions[actionName]) ? actions[actionName] : null;
      if (!action) {
        errors.push(`actions.${actionName} must be an object.`);
        continue;
      }
      if (!includesValue(PURCHASE_ACTION_STATES, action.state)) {
        errors.push(`actions.${actionName}.state is invalid.`);
      }
      if (action.label !== null && typeof action.label !== 'string') {
        errors.push(`actions.${actionName}.label must be null or a string.`);
      }
      if (
        action.targetUrl !== null &&
        !isAbsoluteHttpUrl(action.targetUrl)
      ) {
        errors.push(
          `actions.${actionName}.targetUrl must be null or an absolute HTTP/HTTPS URL.`
        );
      }
      validateEvidenceReferences(
        action.evidenceIds,
        `actions.${actionName}.evidenceIds`,
        evidenceIds,
        errors
      );
    }
  }

  if (!Array.isArray(value.sellerEvidence)) {
    errors.push('sellerEvidence must be an array.');
  } else {
    for (const [index, item] of value.sellerEvidence.entries()) {
      const path = `sellerEvidence[${index}]`;
      if (!isRecord(item)) {
        errors.push(`${path} must be an object.`);
        continue;
      }
      for (const field of [
        'sellerName',
        'merchantId',
        'offeredByText',
      ] as const) {
        if (item[field] !== null && typeof item[field] !== 'string') {
          errors.push(`${path}.${field} must be null or a string.`);
        }
      }
      if (
        item.marketplaceBadgePresent !== null &&
        typeof item.marketplaceBadgePresent !== 'boolean'
      ) {
        errors.push(`${path}.marketplaceBadgePresent must be null or a boolean.`);
      }
      validateEvidenceReferences(
        item.evidenceIds,
        `${path}.evidenceIds`,
        evidenceIds,
        errors
      );
    }
  }

  if (fulfillment && Array.isArray(fulfillment.pickupStores)) {
    for (const [index, item] of fulfillment.pickupStores.entries()) {
      const path = `fulfillment.pickupStores[${index}]`;
      if (!isRecord(item)) {
        errors.push(`${path} must be an object.`);
        continue;
      }
      for (const field of [
        'retailerStoreId',
        'name',
        'postalCode',
      ] as const) {
        if (item[field] !== null && typeof item[field] !== 'string') {
          errors.push(`${path}.${field} must be null or a string.`);
        }
      }
      if (!includesValue(FULFILLMENT_CHANNEL_STATES, item.availability)) {
        errors.push(`${path}.availability is invalid.`);
      }
      validateEvidenceReferences(
        item.evidenceIds,
        `${path}.evidenceIds`,
        evidenceIds,
        errors
      );
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    observation: value as unknown as NormalizedRetailerObservation,
    errors: [],
  };
}
