import { devices } from '@playwright/test';
import { describe, expect, it } from 'vitest';
import config from '../playwright.config.js';

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
