import type { NormalizedRetailerObservation } from '../../src/domain/retailer-observation';

export function createValidRetailerObservation(): NormalizedRetailerObservation {
  return {
    schemaVersion: 'retailer-observation.v1',
    retailer: {
      id: 'target',
      hostname: 'www.target.com',
      adapterId: 'target-fixture',
      adapterVersion: '1.0.0',
    },
    product: {
      retailerSku: '12345678',
      rawName: 'Pokémon TCG Example Elite Trainer Box',
      canonicalProductKey: 'example-set:etb',
      productType: 'etb',
    },
    listing: {
      canonicalUrl: 'https://www.target.com/p/example/-/A-12345678',
      visibility: 'visible',
      releaseState: 'released',
      releaseDate: '2026-08-01',
    },
    price: {
      amount: 49.99,
      currency: 'USD',
    },
    availability: {
      stock: 'in_stock',
      preorder: 'not_applicable',
      online: 'available',
    },
    access: 'public',
    fulfillment: {
      shipping: 'available',
      pickup: 'available',
      inStore: 'available',
      pickupStores: [
        {
          retailerStoreId: 'target-1234',
          name: 'Clemson Target',
          postalCode: '29631',
          availability: 'available',
          evidenceIds: ['pickup-evidence'],
        },
      ],
    },
    actions: {
      addToCart: {
        state: 'enabled',
        label: 'Add to cart',
        targetUrl: null,
        evidenceIds: ['cart-evidence'],
      },
      preorder: {
        state: 'absent',
        label: null,
        targetUrl: null,
        evidenceIds: [],
      },
      notifyMe: {
        state: 'absent',
        label: null,
        targetUrl: null,
        evidenceIds: [],
      },
      waitlist: {
        state: 'absent',
        label: null,
        targetUrl: null,
        evidenceIds: [],
      },
    },
    sellerEvidence: [
      {
        sellerName: 'Target',
        merchantId: 'target',
        offeredByText: 'Sold by Target',
        marketplaceBadgePresent: false,
        evidenceIds: ['seller-evidence'],
      },
    ],
    acquisition: {
      status: 'succeeded',
      method: 'browser',
      finalUrl: 'https://www.target.com/p/example/-/A-12345678',
      httpStatus: 200,
      acquiredAt: '2026-08-09T12:00:00.000Z',
    },
    observedAt: '2026-08-09T12:00:01.000Z',
    confidenceScore: 95,
    evidence: [
      {
        id: 'stock-evidence',
        kind: 'embedded_json',
        field: 'availability.stock',
        value: 'in_stock',
        source: 'fixture',
        locator: '$.product.availability',
        excerpt: null,
        confidenceScore: 98,
      },
      {
        id: 'cart-evidence',
        kind: 'dom',
        field: 'actions.addToCart',
        value: true,
        source: 'fixture',
        locator: '[data-test="add-to-cart"]',
        excerpt: 'Add to cart',
        confidenceScore: 100,
      },
      {
        id: 'seller-evidence',
        kind: 'dom',
        field: 'sellerEvidence',
        value: 'Target',
        source: 'fixture',
        locator: '[data-test="sold-by"]',
        excerpt: 'Sold by Target',
        confidenceScore: 95,
      },
      {
        id: 'pickup-evidence',
        kind: 'embedded_json',
        field: 'fulfillment.pickupStores',
        value: 'target-1234',
        source: 'fixture',
        locator: '$.fulfillment.pickup',
        excerpt: null,
        confidenceScore: 90,
      },
    ],
  };
}
