import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { PageAcquirer } from '../../src/scraping/acquisition/page-acquirer';
import { createScraper } from '../../src/services/scraper';

const aiMocks = vi.hoisted(() => ({
  tryAIExtraction: vi.fn(),
  tryAIVerification: vi.fn(),
  tryAIStockStatusVerification: vi.fn(),
  tryAIArbitration: vi.fn(),
}));

vi.mock('../../src/services/ai-extractor', () => aiMocks);

const fixtureDirectory = path.resolve(__dirname, '../fixtures/scraping');

function fixture(name: string): string {
  return fs.readFileSync(path.join(fixtureDirectory, name), 'utf8');
}

interface FakeAcquirerOptions {
  staticHtml?: string;
  browserHtml?: string;
  staticError?: unknown;
  forbiddenError?: unknown;
}

function fakeAcquirer(options: FakeAcquirerOptions): PageAcquirer & {
  acquireStatic: ReturnType<typeof vi.fn>;
  acquireBrowser: ReturnType<typeof vi.fn>;
} {
  const acquireStatic = options.staticError === undefined
    ? vi.fn().mockResolvedValue(options.staticHtml ?? '')
    : vi.fn().mockRejectedValue(options.staticError);
  const acquireBrowser = vi.fn().mockResolvedValue(options.browserHtml ?? '');

  return {
    acquireStatic,
    acquireBrowser,
    isForbiddenError: error => error === options.forbiddenError,
    requiresDirectBrowser: url => [
      /bestbuy\.com/i,
      /target\.com/i,
      /walmart\.com/i,
      /costco\.com/i,
    ].some(pattern => pattern.test(url)),
  };
}

describe('legacy scraper extraction', () => {
  it('extracts JSON-LD price, metadata, confidence, and InStock', async () => {
    const acquirer = fakeAcquirer({ staticHtml: fixture('jsonld-in-stock.html') });
    const scraper = createScraper(acquirer);
    const result = await scraper.scrapeProduct('https://example.test/product');
    const votingResult = await scraper.scrapeProductWithVoting('https://example.test/product');

    expect(result).toMatchObject({
      name: 'Fixture Booster Bundle',
      price: { price: 26.94, currency: 'USD' },
      imageUrl: 'https://example.test/booster.jpg',
      stockStatus: 'in_stock',
    });
    expect(votingResult.selectedMethod).toBe('json-ld');
    expect(votingResult.priceCandidates).toContainEqual(expect.objectContaining({
      price: 26.94,
      method: 'json-ld',
      confidence: 0.9,
    }));
  });

  it('preserves JSON-LD OutOfStock', async () => {
    const acquirer = fakeAcquirer({ staticHtml: fixture('jsonld-out-of-stock.html') });
    const result = await createScraper(acquirer).scrapeProduct(
      'https://example.test/product'
    );

    expect(result.stockStatus).toBe('out_of_stock');
    expect(result.price).toEqual({ price: 49.99, currency: 'USD' });
  });

  it('extracts a generic current price while ignoring an obvious original price', async () => {
    const acquirer = fakeAcquirer({ staticHtml: fixture('generic-current-price.html') });
    const result = await createScraper(acquirer).scrapeProductWithVoting(
      'https://example.test/product'
    );

    expect(result.price?.price).toBe(59.99);
    expect(result.priceCandidates.map(candidate => candidate.price)).not.toContain(79.99);
    expect(result.priceCandidates).toContainEqual(expect.objectContaining({
      price: 59.99,
      method: 'generic-css',
      confidence: 0.6,
    }));
  });

  it('preserves generic add-to-cart as legacy in_stock', async () => {
    const acquirer = fakeAcquirer({ staticHtml: fixture('generic-add-to-cart.html') });
    const result = await createScraper(acquirer).scrapeProductWithVoting(
      'https://example.test/product'
    );

    expect(result.stockStatus).toBe('in_stock');
  });

  it('preserves coming-soon as legacy out_of_stock', async () => {
    const acquirer = fakeAcquirer({ staticHtml: fixture('coming-soon.html') });
    const result = await createScraper(acquirer).scrapeProductWithVoting(
      'https://example.test/product'
    );

    expect(result.stockStatus).toBe('out_of_stock');
  });

  it('preserves sold-out as legacy out_of_stock', async () => {
    const acquirer = fakeAcquirer({ staticHtml: fixture('sold-out.html') });
    const result = await createScraper(acquirer).scrapeProductWithVoting(
      'https://example.test/product'
    );

    expect(result.stockStatus).toBe('out_of_stock');
  });

  it('falls back to generic extraction after malformed JSON-LD', async () => {
    const acquirer = fakeAcquirer({
      staticHtml: fixture('malformed-jsonld-fallback.html'),
    });
    const result = await createScraper(acquirer).scrapeProductWithVoting(
      'https://example.test/product'
    );

    expect(result.price).toEqual({ price: 34.5, currency: 'USD' });
    expect(result.stockStatus).toBe('in_stock');
  });

  it('resolves a relative image against the product URL', async () => {
    const acquirer = fakeAcquirer({ staticHtml: fixture('relative-image.html') });
    const result = await createScraper(acquirer).scrapeProductWithVoting(
      'https://example.test/products/item'
    );

    expect(result.imageUrl).toBe('https://example.test/images/product.jpg');
  });

  it('characterizes Walmart embedded product data', async () => {
    const acquirer = fakeAcquirer({ browserHtml: fixture('walmart-embedded.html') });
    const result = await createScraper(acquirer).scrapeProductWithVoting(
      'https://www.walmart.com/ip/fixture'
    );

    expect(result).toMatchObject({
      name: 'Walmart Fixture Box',
      price: { price: 44.98, currency: 'USD' },
      stockStatus: 'in_stock',
      selectedMethod: 'site-specific',
    });
    expect(result.priceCandidates).toContainEqual(expect.objectContaining({
      price: 44.98,
      method: 'site-specific',
      confidence: 0.85,
    }));
    expect(acquirer.acquireStatic).not.toHaveBeenCalled();
    expect(acquirer.acquireBrowser).toHaveBeenCalledOnce();
  });

  it('characterizes Best Buy price extraction', async () => {
    const acquirer = fakeAcquirer({ browserHtml: fixture('best-buy.html') });
    const result = await createScraper(acquirer).scrapeProductWithVoting(
      'https://www.bestbuy.com/site/fixture'
    );

    expect(result.name).toBe('Best Buy Fixture ETB');
    expect(result.price).toEqual({ price: 54.99, currency: 'USD' });
  });

  it('characterizes Target price extraction', async () => {
    const acquirer = fakeAcquirer({ browserHtml: fixture('target.html') });
    const result = await createScraper(acquirer).scrapeProductWithVoting(
      'https://www.target.com/p/fixture'
    );

    expect(result.name).toBe('Target Fixture Bundle');
    expect(result.price).toEqual({ price: 28.99, currency: 'USD' });
  });

  it('preserves multiple-candidate review behavior', async () => {
    const acquirer = fakeAcquirer({
      staticHtml: fixture('multiple-price-groups.html'),
    });
    const result = await createScraper(acquirer).scrapeProductWithVoting(
      'https://example.test/product'
    );

    expect(result.priceCandidates).toHaveLength(3);
    expect(result.needsReview).toBe(true);
    expect(result.price?.price).toBe(10);
  });

  it('preserves anchor-price priority in the voting pipeline', async () => {
    const acquirer = fakeAcquirer({
      staticHtml: fixture('multiple-price-groups.html'),
    });
    const result = await createScraper(acquirer).scrapeProductWithVoting(
      'https://example.test/product',
      undefined,
      undefined,
      20
    );

    expect(result.price).toEqual({ price: 20, currency: 'USD' });
    expect(result.selectedMethod).toBe('generic-css');
    expect(result.aiStatus).toBe('verified');
    expect(result.needsReview).toBe(false);
  });

  it('preserves preferred extraction-method priority', async () => {
    const acquirer = fakeAcquirer({
      staticHtml: fixture('mixed-method-prices.html'),
    });
    const result = await createScraper(acquirer).scrapeProductWithVoting(
      'https://example.test/product',
      undefined,
      'generic-css'
    );

    expect(result.price).toEqual({ price: 50, currency: 'USD' });
    expect(result.selectedMethod).toBe('generic-css');
    expect(result.needsReview).toBe(false);
  });
});

describe('legacy scraper acquisition routing', () => {
  it('uses static acquisition first for a generic URL', async () => {
    const acquirer = fakeAcquirer({ staticHtml: fixture('jsonld-in-stock.html') });
    await createScraper(acquirer).scrapeProductWithVoting('https://example.test/product');

    expect(acquirer.acquireStatic).toHaveBeenCalledOnce();
    expect(acquirer.acquireBrowser).not.toHaveBeenCalled();
  });

  it('falls back to browser acquisition on HTTP 403', async () => {
    const forbidden = new Error('forbidden');
    const acquirer = fakeAcquirer({
      staticError: forbidden,
      forbiddenError: forbidden,
      browserHtml: fixture('jsonld-in-stock.html'),
    });
    const result = await createScraper(acquirer).scrapeProductWithVoting(
      'https://example.test/product'
    );

    expect(acquirer.acquireBrowser).toHaveBeenCalledOnce();
    expect(result.price?.price).toBe(26.94);
  });

  it('falls back to browser when static HTML has no usable price candidates', async () => {
    const acquirer = fakeAcquirer({
      staticHtml: fixture('no-price.html'),
      browserHtml: fixture('jsonld-in-stock.html'),
    });
    const result = await createScraper(acquirer).scrapeProductWithVoting(
      'https://example.test/product'
    );

    expect(acquirer.acquireStatic).toHaveBeenCalledOnce();
    expect(acquirer.acquireBrowser).toHaveBeenCalledOnce();
    expect(result.price?.price).toBe(26.94);
  });

  it('routes current JS-heavy URLs directly to browser acquisition', async () => {
    const acquirer = fakeAcquirer({ browserHtml: fixture('target.html') });
    await createScraper(acquirer).scrapeProductWithVoting(
      'https://www.target.com/p/fixture'
    );

    expect(acquirer.acquireStatic).not.toHaveBeenCalled();
    expect(acquirer.acquireBrowser).toHaveBeenCalledOnce();
  });
});

describe('legacy scraper AI and failure characterization', () => {
  it('does not call AI extraction or verification when both paths are disabled', async () => {
    const acquirer = fakeAcquirer({ staticHtml: fixture('no-price.html') });
    const result = await createScraper(acquirer).scrapeProductWithVoting(
      'https://example.test/product',
      123,
      undefined,
      undefined,
      true,
      true
    );

    expect(result.price).toBeNull();
    expect(aiMocks.tryAIExtraction).not.toHaveBeenCalled();
    expect(aiMocks.tryAIVerification).not.toHaveBeenCalled();
    expect(aiMocks.tryAIStockStatusVerification).not.toHaveBeenCalled();
  });

  it('preserves the current unknown result after acquisition failure', async () => {
    const acquirer = fakeAcquirer({ staticError: new Error('network failed') });
    const result = await createScraper(acquirer).scrapeProductWithVoting(
      'https://example.test/product'
    );

    expect(result).toEqual({
      name: null,
      price: null,
      imageUrl: null,
      url: 'https://example.test/product',
      stockStatus: 'unknown',
      aiStatus: null,
      priceCandidates: [],
      needsReview: false,
    });
  });
});
