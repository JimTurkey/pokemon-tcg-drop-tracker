import { describe, expect, expectTypeOf, it } from 'vitest';
import type {
  ExtractionMethod,
  ScrapedProduct,
  ScrapedProductWithCandidates,
} from '../../src/scraping/contracts';
import type { ParsedPrice } from '../../src/utils/priceParser';
import {
  scrapePrice,
  scrapeProduct,
  scrapeProductWithVoting,
} from '../../src/services/scraper';

describe('legacy scraper public API compatibility', () => {
  it('preserves the existing exported function signatures', () => {
    expectTypeOf(scrapeProduct).toEqualTypeOf<
      (url: string, userId?: number) => Promise<ScrapedProduct>
    >();
    expectTypeOf(scrapeProductWithVoting).toEqualTypeOf<
      (
        url: string,
        userId?: number,
        preferredMethod?: ExtractionMethod,
        anchorPrice?: number,
        skipAiVerification?: boolean,
        skipAiExtraction?: boolean
      ) => Promise<ScrapedProductWithCandidates>
    >();
    expectTypeOf(scrapePrice).toEqualTypeOf<
      (url: string) => Promise<ParsedPrice | null>
    >();

    expect(scrapeProduct).toBeTypeOf('function');
    expect(scrapeProductWithVoting).toBeTypeOf('function');
    expect(scrapePrice).toBeTypeOf('function');
  });
});
