import axios, { AxiosError, type AxiosRequestConfig } from 'axios';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { PuppeteerLaunchOptions } from 'puppeteer';

puppeteer.use(StealthPlugin());

export const STATIC_REQUEST_CONFIG: AxiosRequestConfig = {
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
  },
  timeout: 20000,
  maxRedirects: 5,
};

export function createBrowserLaunchOptions(): PuppeteerLaunchOptions {
  return {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--disable-crash-reporter',
      '--window-size=1920,1080',
      '--start-maximized',
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    ignoreDefaultArgs: ['--enable-automation'],
  };
}

const DIRECT_BROWSER_PATTERNS = [
  /bestbuy\.com/i,
  /target\.com/i,
  /walmart\.com/i,
  /costco\.com/i,
];

export function requiresDirectBrowser(url: string): boolean {
  return DIRECT_BROWSER_PATTERNS.some(pattern => pattern.test(url));
}

interface BrowserPageLike {
  setViewport(viewport: { width: number; height: number }): Promise<void>;
  goto(url: string, options: { waitUntil: 'networkidle2'; timeout: number }): Promise<unknown>;
  mouse: {
    move(x: number, y: number): Promise<void>;
  };
  title(): Promise<string>;
  evaluate(pageFunction: string): Promise<unknown>;
  content(): Promise<string>;
}

interface BrowserLike {
  newPage(): Promise<BrowserPageLike>;
  close(): Promise<void>;
}

export interface PageAcquirer {
  acquireStatic(url: string): Promise<string>;
  acquireBrowser(url: string): Promise<string>;
  isForbiddenError(error: unknown): boolean;
  requiresDirectBrowser(url: string): boolean;
}

export interface PageAcquirerDependencies {
  staticFetch: (url: string, config: AxiosRequestConfig) => Promise<string>;
  launchBrowser: (options: PuppeteerLaunchOptions) => Promise<BrowserLike>;
  delay: (milliseconds: number) => Promise<void>;
  now: () => number;
  random: () => number;
}

const defaultDependencies: PageAcquirerDependencies = {
  staticFetch: async (url, config) => {
    const response = await axios.get<string>(url, config);
    return response.data;
  },
  launchBrowser: async options => (
    await puppeteer.launch(options)
  ) as unknown as BrowserLike,
  delay: milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),
  now: () => Date.now(),
  random: () => Math.random(),
};

export function createPageAcquirer(
  dependencies: Partial<PageAcquirerDependencies> = {}
): PageAcquirer {
  const deps = { ...defaultDependencies, ...dependencies };

  return {
    async acquireStatic(url: string): Promise<string> {
      return deps.staticFetch(url, STATIC_REQUEST_CONFIG);
    },

    async acquireBrowser(url: string): Promise<string> {
      const browser = await deps.launchBrowser(createBrowserLaunchOptions());

      try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        await page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: 45000,
        });

        await page.mouse.move(100, 200);
        await deps.delay(500);
        await page.mouse.move(300, 400);

        const maxWaitTime = 20000;
        const startTime = deps.now();

        while (deps.now() - startTime < maxWaitTime) {
          const title = await page.title();
          if (!title.toLowerCase().includes('just a moment') &&
              !title.toLowerCase().includes('checking your browser')) {
            break;
          }
          console.log(`[Browser] Waiting for Cloudflare challenge to complete... (${title})`);
          await page.mouse.move(
            100 + deps.random() * 500,
            100 + deps.random() * 400
          );
          await deps.delay(2000);
        }

        await page.evaluate('window.scrollBy(0, 300)');
        await deps.delay(1000);
        return page.content();
      } finally {
        await browser.close();
      }
    },

    isForbiddenError(error: unknown): boolean {
      return error instanceof AxiosError && error.response?.status === 403;
    },

    requiresDirectBrowser,
  };
}

export const productionPageAcquirer = createPageAcquirer();
