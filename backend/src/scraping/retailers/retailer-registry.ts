import type { RetailerId } from '../../domain/tracker-types';

export interface RetailerDefinition {
  id: RetailerId;
  displayName: string;
  canonicalHostname: string;
  approvedHostnames: readonly string[];
  matchesProductPath(pathname: string): boolean;
}

export type RetailerUrlRejectionReason =
  | 'invalid_url'
  | 'unsupported_protocol'
  | 'unsupported_retailer'
  | 'unsupported_product_url'
  | 'redirect_retailer_mismatch';

export type RetailerUrlIdentificationResult =
  | {
      status: 'identified';
      retailer: RetailerDefinition;
      url: URL;
    }
  | {
      status: 'rejected';
      reason: 'invalid_url' | 'unsupported_protocol' | 'unsupported_retailer';
    };

export type RetailerProductUrlValidationResult =
  | {
      status: 'valid';
      retailer: RetailerDefinition;
      url: URL;
    }
  | {
      status: 'rejected';
      reason: RetailerUrlRejectionReason;
    };

export type RetailerRedirectValidationResult =
  | {
      status: 'valid';
      retailer: RetailerDefinition;
      requestedUrl: URL;
      finalUrl: URL;
    }
  | {
      status: 'rejected';
      reason: RetailerUrlRejectionReason;
    };

export type CanonicalRetailerProductUrlResult =
  | {
      status: 'valid';
      retailer: RetailerDefinition;
      url: URL;
      canonicalUrl: string;
    }
  | {
      status: 'rejected';
      reason: RetailerUrlRejectionReason;
    };

const productPathMatchers: Record<RetailerId, RegExp> = {
  pokemon_center: /^\/product\/[^/]+(?:\/.*)?$/,
  target: /^\/p\/(?:[^/]+\/)+-\/A-\d+\/?$/,
  best_buy: /^\/site\/(?:[^/]+\/)+\d+\.p\/?$/,
  walmart: /^\/ip\/(?:[^/]+\/)?\d+\/?$/,
};

export const RETAILER_DEFINITIONS = {
  pokemon_center: {
    id: 'pokemon_center',
    displayName: 'Pokémon Center',
    canonicalHostname: 'www.pokemoncenter.com',
    approvedHostnames: ['pokemoncenter.com', 'www.pokemoncenter.com'],
    matchesProductPath: (pathname: string) =>
      productPathMatchers.pokemon_center.test(pathname),
  },
  target: {
    id: 'target',
    displayName: 'Target',
    canonicalHostname: 'www.target.com',
    approvedHostnames: ['target.com', 'www.target.com'],
    matchesProductPath: (pathname: string) =>
      productPathMatchers.target.test(pathname),
  },
  best_buy: {
    id: 'best_buy',
    displayName: 'Best Buy',
    canonicalHostname: 'www.bestbuy.com',
    approvedHostnames: ['bestbuy.com', 'www.bestbuy.com'],
    matchesProductPath: (pathname: string) =>
      productPathMatchers.best_buy.test(pathname),
  },
  walmart: {
    id: 'walmart',
    displayName: 'Walmart',
    canonicalHostname: 'www.walmart.com',
    approvedHostnames: ['walmart.com', 'www.walmart.com'],
    matchesProductPath: (pathname: string) =>
      productPathMatchers.walmart.test(pathname),
  },
} satisfies Record<RetailerId, RetailerDefinition>;

const retailerDefinitions = Object.values(RETAILER_DEFINITIONS);

function parseRetailerUrl(
  value: string | URL
):
  | { status: 'parsed'; url: URL }
  | { status: 'rejected'; reason: 'invalid_url' | 'unsupported_protocol' } {
  let url: URL;

  try {
    url = new URL(value.toString());
  } catch {
    return { status: 'rejected', reason: 'invalid_url' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { status: 'rejected', reason: 'unsupported_protocol' };
  }

  return { status: 'parsed', url };
}

function findRetailerByHostname(hostname: string): RetailerDefinition | null {
  return retailerDefinitions.find((retailer) =>
    retailer.approvedHostnames.includes(hostname)
  ) ?? null;
}

export function getRetailerDefinition(
  retailerId: RetailerId
): RetailerDefinition {
  return RETAILER_DEFINITIONS[retailerId];
}

export function identifyRetailerUrl(
  value: string | URL
): RetailerUrlIdentificationResult {
  const parsed = parseRetailerUrl(value);
  if (parsed.status === 'rejected') return parsed;

  const retailer = findRetailerByHostname(parsed.url.hostname);
  if (!retailer) {
    return { status: 'rejected', reason: 'unsupported_retailer' };
  }

  return { status: 'identified', retailer, url: parsed.url };
}

export function validateRetailerProductUrl(
  value: string | URL,
  expectedRetailerId?: RetailerId
): RetailerProductUrlValidationResult {
  const identified = identifyRetailerUrl(value);
  if (identified.status === 'rejected') return identified;

  if (
    expectedRetailerId !== undefined &&
    identified.retailer.id !== expectedRetailerId
  ) {
    return { status: 'rejected', reason: 'redirect_retailer_mismatch' };
  }

  if (!identified.retailer.matchesProductPath(identified.url.pathname)) {
    return { status: 'rejected', reason: 'unsupported_product_url' };
  }

  return {
    status: 'valid',
    retailer: identified.retailer,
    url: identified.url,
  };
}

export function validateRetailerRedirect(
  requestedValue: string | URL,
  finalValue: string | URL
): RetailerRedirectValidationResult {
  const requested = identifyRetailerUrl(requestedValue);
  if (requested.status === 'rejected') return requested;

  const parsedFinal = parseRetailerUrl(finalValue);
  if (parsedFinal.status === 'rejected') return parsedFinal;

  const finalRetailer = findRetailerByHostname(parsedFinal.url.hostname);
  if (!finalRetailer || finalRetailer.id !== requested.retailer.id) {
    return { status: 'rejected', reason: 'redirect_retailer_mismatch' };
  }

  if (!finalRetailer.matchesProductPath(parsedFinal.url.pathname)) {
    return { status: 'rejected', reason: 'unsupported_product_url' };
  }

  return {
    status: 'valid',
    retailer: finalRetailer,
    requestedUrl: requested.url,
    finalUrl: parsedFinal.url,
  };
}

export function canonicalizeRetailerProductUrl(
  value: string | URL,
  expectedRetailerId?: RetailerId
): CanonicalRetailerProductUrlResult {
  const validated = validateRetailerProductUrl(value, expectedRetailerId);
  if (validated.status === 'rejected') return validated;

  const canonicalUrl = new URL(validated.url.href);
  canonicalUrl.hostname = validated.retailer.canonicalHostname;
  canonicalUrl.hash = '';

  return {
    status: 'valid',
    retailer: validated.retailer,
    url: validated.url,
    canonicalUrl: canonicalUrl.href,
  };
}
