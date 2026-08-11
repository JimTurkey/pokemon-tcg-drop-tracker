import { isRetailerId, type RetailerId } from '../../domain/tracker-types';
import type { RetailerAdapter } from './contracts';

export type AdapterRegistrationResult =
  | {
      status: 'registered';
      adapter: RetailerAdapter;
    }
  | {
      status: 'rejected';
      reason: 'unsupported_retailer' | 'duplicate_adapter_registration';
    };

export type AdapterSelectionResult =
  | {
      status: 'selected';
      adapter: RetailerAdapter;
    }
  | {
      status: 'rejected';
      reason:
        | 'unsupported_retailer'
        | 'adapter_not_registered'
        | 'adapter_does_not_support_url';
    };

export interface RetailerAdapterRegistry {
  register(adapter: RetailerAdapter): AdapterRegistrationResult;
  get(retailerId: RetailerId): RetailerAdapter | null;
  select(retailerId: string, finalUrl: URL): AdapterSelectionResult;
  list(): readonly RetailerAdapter[];
}

export function createRetailerAdapterRegistry(
  initialAdapters: readonly RetailerAdapter[] = []
): RetailerAdapterRegistry {
  const adaptersByRetailer = new Map<RetailerId, RetailerAdapter>();
  const adapterIds = new Set<string>();

  const registry: RetailerAdapterRegistry = {
    register(adapter): AdapterRegistrationResult {
      if (!isRetailerId(adapter.retailerId)) {
        return { status: 'rejected', reason: 'unsupported_retailer' };
      }

      if (
        adaptersByRetailer.has(adapter.retailerId) ||
        adapterIds.has(adapter.adapterId)
      ) {
        return {
          status: 'rejected',
          reason: 'duplicate_adapter_registration',
        };
      }

      adaptersByRetailer.set(adapter.retailerId, adapter);
      adapterIds.add(adapter.adapterId);
      return { status: 'registered', adapter };
    },

    get(retailerId): RetailerAdapter | null {
      return adaptersByRetailer.get(retailerId) ?? null;
    },

    select(retailerId, finalUrl): AdapterSelectionResult {
      if (!isRetailerId(retailerId)) {
        return { status: 'rejected', reason: 'unsupported_retailer' };
      }

      const adapter = adaptersByRetailer.get(retailerId);
      if (!adapter) {
        return { status: 'rejected', reason: 'adapter_not_registered' };
      }

      if (!adapter.matchesUrl(finalUrl)) {
        return {
          status: 'rejected',
          reason: 'adapter_does_not_support_url',
        };
      }

      return { status: 'selected', adapter };
    },

    list(): readonly RetailerAdapter[] {
      return [...adaptersByRetailer.values()];
    },
  };

  for (const adapter of initialAdapters) {
    const result = registry.register(adapter);
    if (result.status === 'rejected') {
      throw new Error(
        `Unable to initialize retailer adapter registry: ${result.reason} (${adapter.adapterId}).`
      );
    }
  }

  return registry;
}

/** Intentionally empty until concrete retailer adapters are implemented. */
export const defaultRetailerAdapterRegistry = createRetailerAdapterRegistry();
