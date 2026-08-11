# Retailer adapter foundation

This foundation defines an offline, unwired boundary for future Pokémon retailer
adapters. It does not change the PriceGhost scraper or acquisition runtime.

## Intended flow

```text
acquisition
  -> requested/final URL retailer identity validation
  -> adapter selection
  -> adapter parsing
  -> validateRetailerObservation()
  -> seller validation
  -> opportunity-evidence derivation
  -> tiering
```

The current legacy `PageAcquirer` returns HTML only and loses final URL, status,
and timing metadata. `RetailerAdapterInput` declares the metadata the future
pipeline must provide without changing that legacy boundary in this foundation.

## Exact-host retailer identity

Retailer identity uses parsed `URL.hostname` equality against these V1 values:

| Retailer | Approved hostnames |
| --- | --- |
| Pokémon Center | `pokemoncenter.com`, `www.pokemoncenter.com` |
| Target | `target.com`, `www.target.com` |
| Best Buy | `bestbuy.com`, `www.bestbuy.com` |
| Walmart | `walmart.com`, `www.walmart.com` |

There is no substring, suffix, arbitrary-subdomain, path, or query matching.
Requested and final URLs must identify the same retailer, and the final URL must
match that retailer's conservative product-path rule. A page-supplied canonical
URL is revalidated before use. Canonicalization removes fragments but preserves
query parameters for later retailer-specific decisions.

Retailer identity validation is not network-level SSRF protection. It does not
resolve or block private IP addresses, protect redirect hops, prevent DNS
rebinding, or constrain browser subrequests. Those controls remain deferred.

## Adapter responsibilities

An adapter receives acquired HTML plus acquisition metadata and performs pure
parsing. It may use Cheerio or shared pure parsing helpers, create structured
evidence, populate retailer facts, and return honest unknown states.

An adapter must not launch a browser, make HTTP requests, persist data, notify
users, classify sellers, calculate Tier/readiness/Best Value, or emit
`likely_stock`/`likely_preorder`.

`RetailerOfferCandidate` preserves each raw offer's key, price, actionability,
seller evidence, and evidence references. Adapters must not treat the first
JSON-LD offer, minimum price, hostname, or generic add-to-cart presence as proof
of first-party status. No concrete retailer adapter is included yet.

## Seller validation

Seller validation is a separate pure domain step over structurally valid raw
`SellerEvidence`. V1 uses normalized exact matching only: Unicode normalization,
trim, case-fold, internal-whitespace collapse, and exact removal of common
"sold by" prefixes. It does not use fuzzy matching.

The reviewed V1 seller names are Pokémon Center/Pokemon Center, Target, Best
Buy, and Walmart/Walmart.com. Merchant-ID allowlists are intentionally empty
until representative fixtures confirm stable IDs.

Missing seller evidence, a false marketplace badge without identity, or
ambiguous/contradictory evidence stays `unknown`. First- and third-party offer
evidence is `mixed`. Unrecognized explicit seller identity is `third_party`.
Because `SellerEvidence` does not yet prove which offers are actionable,
third-party evidence does not guess `marketplaceOnly: true`.

Seller validation returns no Tier or opportunity evidence. Tier 1 continues to
require separate confirmed add-to-cart, live-preorder, or local-pickup evidence.

## Error boundaries

The future pipeline keeps these outcomes distinct rather than collapsing them
into a generic unknown result:

- `acquisition_failed`: acquisition owns the failure; no observation exists.
- `unsupported_retailer`: URL identity is outside the approved registry.
- `unsupported_product_url`: retailer is approved but the path is unsupported.
- `redirect_retailer_mismatch`: requested and final retailer identities differ.
- `adapter_not_registered`: retailer is approved but has no adapter.
- `adapter_does_not_support_url`: registered adapter rejects the validated URL.
- `adapter_parse_failed`: adapter returns a safe structured parse error.
- `parsed_with_unknown_facts`: parsing succeeded with honest unknown fields.
- `invalid_normalized_observation`: runtime observation validation failed.
- `seller_unclassified`: observation is valid but seller evidence is insufficient.

## Deferred work

This foundation is not connected to production scraping, routes, scheduling,
persistence, notifications, or the frontend. It adds no concrete retailer
adapter, migration, browser behavior, network retry, SSRF enforcement, pickup
scraping, social ingestion, readiness change, or alert behavior.
