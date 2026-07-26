import { devices } from '@playwright/test';
import { describe, expect, it, vi } from 'vitest';
import config from '../playwright.config.js';
import { createPlaywrightConfig, resolveE2EPort } from '../playwright.config.js';

describe('mobile-chromium Playwright project', () => {
  it('uses the Pixel 5 device characteristics in landscape', () => {
    const project = config.projects?.find(({ name }) => name === 'mobile-chromium');
    const use = project?.use;

    expect(use).toBeDefined();
    expect(use?.viewport).toEqual({ width: 851, height: 393 });
    expect(use?.screen).toEqual({ width: 851, height: 393 });
    expect(use?.viewport?.width).toBeGreaterThan(use?.viewport?.height ?? Infinity);
    expect(use?.screen?.width).toBeGreaterThan(use?.screen?.height ?? Infinity);
    expect(use?.isMobile).toBe(true);
    expect(use?.hasTouch).toBe(true);
    expect(use?.deviceScaleFactor).toBe(devices['Pixel 5'].deviceScaleFactor);
    expect(use?.userAgent).toBe(devices['Pixel 5'].userAgent);
  });
});

describe('Playwright port configuration', () => {
  it('defaults to port 5173 and starts Vite with strictPort', () => {
    vi.stubEnv('PLAYWRIGHT_PORT', undefined);
    try {
      const defaultConfig = createPlaywrightConfig(resolveE2EPort());
      const webServer = defaultConfig.webServer as { command: string; url: string };

      expect(resolveE2EPort()).toBe(5173);
      expect(defaultConfig.use?.baseURL).toBe('http://localhost:5173');
      expect(webServer.url).toBe('http://localhost:5173');
      expect(webServer.command).toContain('--port 5173');
      expect(webServer.command).toContain('--strictPort');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('accepts a valid decimal port override', () => {
    const override = createPlaywrightConfig(resolveE2EPort('5198'));
    const webServer = override.webServer as { command: string; url: string };

    expect(override.use?.baseURL).toBe('http://localhost:5198');
    expect(webServer.url).toBe('http://localhost:5198');
    expect(webServer.command).toContain('--port 5198');
    expect(webServer.command).toContain('--strictPort');
  });

  it.each(['', '0', '65536', '-1', '5198; echo injected', '5198 --host 0.0.0.0', 'abc'])('rejects unsafe port value %j', (value) => {
      expect(() => resolveE2EPort(value)).toThrow('PLAYWRIGHT_PORT must be a decimal integer from 1 to 65535');
  });
});
