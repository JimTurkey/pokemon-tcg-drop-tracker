import { describe, expect, it } from 'vitest';
import {
  canonicalizeRetailerProductUrl,
  identifyRetailerUrl,
  RETAILER_DEFINITIONS,
  validateRetailerProductUrl,
  validateRetailerRedirect,
} from '../../../src/scraping/retailers/retailer-registry';

const approvedHosts = [
  ['pokemon_center', 'pokemoncenter.com'],
  ['pokemon_center', 'www.pokemoncenter.com'],
  ['target', 'target.com'],
  ['target', 'www.target.com'],
  ['best_buy', 'bestbuy.com'],
  ['best_buy', 'www.bestbuy.com'],
  ['walmart', 'walmart.com'],
  ['walmart', 'www.walmart.com'],
] as const;

const validProductUrls = [
  ['pokemon_center', 'https://www.pokemoncenter.com/product/100-10001/example-box'],
  ['pokemon_center', 'https://pokemoncenter.com/product/example-key'],
  ['target', 'https://www.target.com/p/example-box/-/A-12345678'],
  ['target', 'https://target.com/p/category/example-box/-/A-12345678/'],
  ['best_buy', 'https://www.bestbuy.com/site/example-box/6571234.p'],
  ['best_buy', 'https://bestbuy.com/site/category/example-box/6571234.p/'],
  ['walmart', 'https://www.walmart.com/ip/example-box/123456789'],
  ['walmart', 'https://walmart.com/ip/123456789/'],
] as const;

describe('retailer URL identification', () => {
  it.each(approvedHosts)('identifies %s from exact hostname %s', (retailerId, hostname) => {
    expect(identifyRetailerUrl(`https://${hostname}/anything`)).toMatchObject({
      status: 'identified',
      retailer: { id: retailerId },
    });
  });

  it('relies on URL hostname case normalization', () => {
    expect(
      identifyRetailerUrl('HTTPS://WWW.TARGET.COM/p/example/-/A-12345678')
    ).toMatchObject({
      status: 'identified',
      retailer: { id: 'target' },
    });
  });

  it.each([
    'https://target.com.example.test/p/example/-/A-12345678',
    'https://eviltarget.com/p/example/-/A-12345678',
    'https://help.target.com/p/example/-/A-12345678',
    'https://marketplace.walmart.com/ip/example/123456789',
    'https://example.test/target.com/p/example/-/A-12345678',
    'https://example.test/?next=target.com',
  ])('rejects deceptive or unapproved hostname %s', (url) => {
    expect(identifyRetailerUrl(url)).toEqual({
      status: 'rejected',
      reason: 'unsupported_retailer',
    });
  });

  it('rejects malformed URLs without throwing', () => {
    expect(identifyRetailerUrl('not a url')).toEqual({
      status: 'rejected',
      reason: 'invalid_url',
    });
  });

  it('rejects unsupported protocols', () => {
    expect(identifyRetailerUrl('ftp://www.target.com/p/example/-/A-12345678')).toEqual({
      status: 'rejected',
      reason: 'unsupported_protocol',
    });
  });

  it('publishes only the approved hostname map', () => {
    expect(
      Object.fromEntries(
        Object.entries(RETAILER_DEFINITIONS).map(([id, definition]) => [
          id,
          definition.approvedHostnames,
        ])
      )
    ).toEqual({
      pokemon_center: ['pokemoncenter.com', 'www.pokemoncenter.com'],
      target: ['target.com', 'www.target.com'],
      best_buy: ['bestbuy.com', 'www.bestbuy.com'],
      walmart: ['walmart.com', 'www.walmart.com'],
    });
  });
});

describe('retailer product URL validation', () => {
  it.each(validProductUrls)('accepts a conservative %s product path', (retailerId, url) => {
    expect(validateRetailerProductUrl(url)).toMatchObject({
      status: 'valid',
      retailer: { id: retailerId },
    });
  });

  it.each([
    'https://www.pokemoncenter.com/product/',
    'https://www.pokemoncenter.com/products/example',
    'https://www.target.com/p/example',
    'https://www.target.com/p/-/A-12345678',
    'https://www.target.com/p/example/-/A-not-numeric',
    'https://www.bestbuy.com/site/example/sku.p',
    'https://www.bestbuy.com/site/6571234.p',
    'https://www.walmart.com/ip/example/not-numeric',
    'https://www.walmart.com/search?q=123456789',
  ])('rejects unrelated or malformed product path %s', (url) => {
    expect(validateRetailerProductUrl(url)).toEqual({
      status: 'rejected',
      reason: 'unsupported_product_url',
    });
  });

  it('rejects a product URL for the wrong expected retailer', () => {
    expect(
      validateRetailerProductUrl(
        'https://www.walmart.com/ip/example/123456789',
        'target'
      )
    ).toEqual({
      status: 'rejected',
      reason: 'redirect_retailer_mismatch',
    });
  });
});

describe('retailer redirect and canonical URL validation', () => {
  it('accepts a redirect between approved hosts for the same retailer', () => {
    expect(
      validateRetailerRedirect(
        'https://target.com/p/example/-/A-12345678',
        'https://www.target.com/p/example/-/A-12345678?preselect=1'
      )
    ).toMatchObject({
      status: 'valid',
      retailer: { id: 'target' },
    });
  });

  it('rejects a cross-retailer redirect', () => {
    expect(
      validateRetailerRedirect(
        'https://www.target.com/p/example/-/A-12345678',
        'https://www.walmart.com/ip/example/123456789'
      )
    ).toEqual({
      status: 'rejected',
      reason: 'redirect_retailer_mismatch',
    });
  });

  it('rejects a redirect to an unapproved subdomain', () => {
    expect(
      validateRetailerRedirect(
        'https://www.target.com/p/example/-/A-12345678',
        'https://help.target.com/p/example/-/A-12345678'
      )
    ).toEqual({
      status: 'rejected',
      reason: 'redirect_retailer_mismatch',
    });
  });

  it('rejects a final URL that is not a supported product page', () => {
    expect(
      validateRetailerRedirect(
        'https://www.target.com/p/example/-/A-12345678',
        'https://www.target.com/search?q=example'
      )
    ).toEqual({
      status: 'rejected',
      reason: 'unsupported_product_url',
    });
  });

  it('canonicalizes an approved product URL while preserving its query', () => {
    expect(
      canonicalizeRetailerProductUrl(
        'https://target.com/p/example/-/A-12345678?preselect=1#reviews',
        'target'
      )
    ).toMatchObject({
      status: 'valid',
      canonicalUrl:
        'https://www.target.com/p/example/-/A-12345678?preselect=1',
    });
  });

  it('revalidates and rejects an unapproved page-supplied canonical URL', () => {
    expect(
      canonicalizeRetailerProductUrl(
        'https://example.test/p/example/-/A-12345678',
        'target'
      )
    ).toEqual({
      status: 'rejected',
      reason: 'unsupported_retailer',
    });
  });
});
