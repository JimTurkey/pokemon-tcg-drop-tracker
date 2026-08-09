import type { ParsedPrice } from '../utils/priceParser';

/** The three-state availability model used by the legacy PriceGhost runtime. */
export type LegacyStockStatus = 'in_stock' | 'out_of_stock' | 'unknown';

export type ExtractionMethod = 'json-ld' | 'site-specific' | 'generic-css' | 'ai';

export interface PriceCandidate {
  price: number;
  currency: string;
  method: ExtractionMethod;
  context?: string;
  confidence: number;
}

export type AIStatus = 'verified' | 'corrected' | null;

export interface ScrapedProduct {
  name: string | null;
  price: ParsedPrice | null;
  imageUrl: string | null;
  url: string;
  stockStatus: LegacyStockStatus;
  aiStatus: AIStatus;
}

export interface ScrapedProductWithCandidates extends ScrapedProduct {
  priceCandidates: PriceCandidate[];
  needsReview: boolean;
  selectedMethod?: ExtractionMethod;
}
