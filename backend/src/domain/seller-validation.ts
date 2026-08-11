import type {
  SellerEvidence,
  SellerValidationResult,
} from './retailer-observation';
import type { RetailerId } from './tracker-types';

export interface FirstPartySellerPolicy {
  retailerId: RetailerId;
  sellerNames: readonly string[];
  merchantIds: readonly string[];
}

export type FirstPartySellerPolicyMap = Readonly<
  Record<RetailerId, FirstPartySellerPolicy>
>;

export interface SellerValidationInput {
  retailerId: RetailerId;
  sellerEvidence: readonly SellerEvidence[];
}

export interface SellerValidator {
  validate(input: SellerValidationInput): SellerValidationResult;
}

export const FIRST_PARTY_SELLER_POLICIES_V1 = {
  pokemon_center: {
    retailerId: 'pokemon_center',
    sellerNames: ['Pokémon Center', 'Pokemon Center'],
    merchantIds: [],
  },
  target: {
    retailerId: 'target',
    sellerNames: ['Target'],
    merchantIds: [],
  },
  best_buy: {
    retailerId: 'best_buy',
    sellerNames: ['Best Buy'],
    merchantIds: [],
  },
  walmart: {
    retailerId: 'walmart',
    sellerNames: ['Walmart', 'Walmart.com'],
    merchantIds: [],
  },
} satisfies FirstPartySellerPolicyMap;

type EvidenceAssessment =
  | 'first_party_name'
  | 'first_party_merchant'
  | 'third_party'
  | 'ambiguous'
  | 'neutral_merchant'
  | 'empty';

const offeredByPrefixes = [
  'sold and shipped by ',
  'sold by ',
  'offered by ',
] as const;

const fulfillmentPrefixes = ['fulfilled by '] as const;

export function normalizeSellerIdentity(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/\s+/g, ' ');
}

function normalizeOfferedByIdentity(value: string): string | null {
  const normalized = normalizeSellerIdentity(value);
  if (fulfillmentPrefixes.some((prefix) => normalized.startsWith(prefix))) {
    return null;
  }

  const prefix = offeredByPrefixes.find((candidate) =>
    normalized.startsWith(candidate)
  );

  return prefix ? normalized.slice(prefix.length).trim() : normalized;
}

function nonempty(value: string | null): value is string {
  return value !== null && value.trim().length > 0;
}

function assessSellerEvidence(
  evidence: SellerEvidence,
  approvedNames: ReadonlySet<string>,
  approvedMerchantIds: ReadonlySet<string>
): EvidenceAssessment {
  const sellerIdentities = new Set<string>();
  if (nonempty(evidence.sellerName)) {
    sellerIdentities.add(normalizeSellerIdentity(evidence.sellerName));
  }
  if (nonempty(evidence.offeredByText)) {
    const offeredByIdentity = normalizeOfferedByIdentity(
      evidence.offeredByText
    );
    if (offeredByIdentity !== null) {
      sellerIdentities.add(offeredByIdentity);
    }
  }

  const merchantId = nonempty(evidence.merchantId)
    ? normalizeSellerIdentity(evidence.merchantId)
    : null;
  const nameMatches = [...sellerIdentities].filter((identity) =>
    approvedNames.has(identity)
  );
  const nameMismatches = [...sellerIdentities].filter(
    (identity) => !approvedNames.has(identity)
  );
  const merchantMatches =
    merchantId !== null && approvedMerchantIds.has(merchantId);
  const hasUnreviewedMerchantId = merchantId !== null && !merchantMatches;
  const hasFirstPartyMatch = nameMatches.length > 0 || merchantMatches;
  const hasUnrecognizedIdentity = nameMismatches.length > 0;

  if (
    hasFirstPartyMatch &&
    (hasUnrecognizedIdentity || evidence.marketplaceBadgePresent === true)
  ) {
    return 'ambiguous';
  }

  if (merchantMatches) return 'first_party_merchant';
  if (nameMatches.length > 0) return 'first_party_name';
  if (hasUnrecognizedIdentity) return 'third_party';
  if (evidence.marketplaceBadgePresent === true) return 'ambiguous';
  if (hasUnreviewedMerchantId) return 'neutral_merchant';
  return 'empty';
}

export function createSellerValidator(
  policies: FirstPartySellerPolicyMap = FIRST_PARTY_SELLER_POLICIES_V1
): SellerValidator {
  const normalizedPolicies = new Map<
    RetailerId,
    { sellerNames: ReadonlySet<string>; merchantIds: ReadonlySet<string> }
  >();

  for (const policy of Object.values(policies)) {
    normalizedPolicies.set(policy.retailerId, {
      sellerNames: new Set(policy.sellerNames.map(normalizeSellerIdentity)),
      merchantIds: new Set(policy.merchantIds.map(normalizeSellerIdentity)),
    });
  }

  return {
    validate(input): SellerValidationResult {
      const policy = normalizedPolicies.get(input.retailerId);
      if (!policy || input.sellerEvidence.length === 0) {
        return {
          classification: 'unknown',
          firstParty: null,
          marketplaceOnly: null,
          reasons: ['missing_seller_evidence'],
        };
      }

      const assessments = new Set(
        input.sellerEvidence.map((evidence) =>
          assessSellerEvidence(
            evidence,
            policy.sellerNames,
            policy.merchantIds
          )
        )
      );
      const hasFirstPartyName = assessments.has('first_party_name');
      const hasFirstPartyMerchant = assessments.has('first_party_merchant');
      const hasFirstParty = hasFirstPartyName || hasFirstPartyMerchant;
      const hasThirdParty = assessments.has('third_party');
      const hasAmbiguous = assessments.has('ambiguous');
      const hasNeutralMerchant = assessments.has('neutral_merchant');

      if (hasFirstParty && hasThirdParty) {
        return {
          classification: 'mixed',
          firstParty: false,
          marketplaceOnly: false,
          reasons: ['mixed_first_and_third_party_evidence'],
        };
      }

      if (hasAmbiguous) {
        return {
          classification: 'unknown',
          firstParty: null,
          marketplaceOnly: null,
          reasons: ['ambiguous_or_conflicting_seller_evidence'],
        };
      }

      if (hasFirstParty) {
        const reasons: string[] = [];
        if (hasFirstPartyMerchant) reasons.push('approved_merchant_id');
        if (hasFirstPartyName) reasons.push('approved_seller_identity');

        return {
          classification: 'first_party',
          firstParty: true,
          marketplaceOnly: false,
          reasons,
        };
      }

      if (hasThirdParty) {
        return {
          classification: 'third_party',
          firstParty: false,
          marketplaceOnly: null,
          reasons: ['unrecognized_seller_identity'],
        };
      }

      return {
        classification: 'unknown',
        firstParty: null,
        marketplaceOnly: null,
        reasons: [
          hasNeutralMerchant
            ? 'unreviewed_merchant_id'
            : 'missing_seller_evidence',
        ],
      };
    },
  };
}

const sellerValidatorV1 = createSellerValidator();

export function validateSeller(
  input: SellerValidationInput
): SellerValidationResult {
  return sellerValidatorV1.validate(input);
}
