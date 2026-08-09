import { describe, expect, it, vi } from 'vitest';
import {
  createBrowserLaunchOptions,
  createPageAcquirer,
  requiresDirectBrowser,
  STATIC_REQUEST_CONFIG,
} from '../../src/scraping/acquisition/page-acquirer';

function createBrowser(options?: { gotoError?: Error }) {
  const close = vi.fn().mockResolvedValue(undefined);
  const page = {
    setViewport: vi.fn().mockResolvedValue(undefined),
    goto: options?.gotoError
      ? vi.fn().mockRejectedValue(options.gotoError)
      : vi.fn().mockResolvedValue(undefined),
    mouse: { move: vi.fn().mockResolvedValue(undefined) },
    title: vi.fn().mockResolvedValue('Fixture product'),
    evaluate: vi.fn().mockResolvedValue(undefined),
    content: vi.fn().mockResolvedValue('<html>browser fixture</html>'),
  };
  const browser = {
    newPage: vi.fn().mockResolvedValue(page),
    close,
  };
  return { browser, close, page };
}

describe('page acquisition boundary', () => {
  it('uses the existing static request configuration', async () => {
    const staticFetch = vi.fn().mockResolvedValue('<html>static fixture</html>');
    const acquirer = createPageAcquirer({ staticFetch });

    await expect(acquirer.acquireStatic('https://example.test/item')).resolves.toBe(
      '<html>static fixture</html>'
    );
    expect(staticFetch).toHaveBeenCalledWith(
      'https://example.test/item',
      STATIC_REQUEST_CONFIG
    );
    expect(STATIC_REQUEST_CONFIG.timeout).toBe(20000);
    expect(STATIC_REQUEST_CONFIG.maxRedirects).toBe(5);
  });

  it('preserves current full-URL direct-browser routing', () => {
    expect(requiresDirectBrowser('https://www.bestbuy.com/site/item')).toBe(true);
    expect(requiresDirectBrowser('https://www.target.com/p/item')).toBe(true);
    expect(requiresDirectBrowser('https://www.walmart.com/ip/item')).toBe(true);
    expect(requiresDirectBrowser('https://www.costco.com/item.html')).toBe(true);
    expect(requiresDirectBrowser('https://example.test/item')).toBe(false);
  });

  it('closes the browser after successful acquisition', async () => {
    const { browser, close, page } = createBrowser();
    const launchBrowser = vi.fn().mockResolvedValue(browser);
    const acquirer = createPageAcquirer({
      launchBrowser,
      delay: vi.fn().mockResolvedValue(undefined),
    });

    await expect(acquirer.acquireBrowser('https://example.test/item')).resolves.toBe(
      '<html>browser fixture</html>'
    );
    expect(launchBrowser).toHaveBeenCalledWith(createBrowserLaunchOptions());
    expect(page.goto).toHaveBeenCalledWith('https://example.test/item', {
      waitUntil: 'networkidle2',
      timeout: 45000,
    });
    expect(close).toHaveBeenCalledOnce();
  });

  it('closes the browser when page acquisition fails', async () => {
    const expectedError = new Error('navigation failed');
    const { browser, close } = createBrowser({ gotoError: expectedError });
    const acquirer = createPageAcquirer({
      launchBrowser: vi.fn().mockResolvedValue(browser),
      delay: vi.fn().mockResolvedValue(undefined),
    });

    await expect(acquirer.acquireBrowser('https://example.test/item')).rejects.toThrow(
      expectedError
    );
    expect(close).toHaveBeenCalledOnce();
  });
});
