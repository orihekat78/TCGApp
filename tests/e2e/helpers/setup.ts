// E2E test setup helper — page.goto + window.__game 待機 + console error collector
// 静的リソース 404 (favicon 等) は filter で除外

import type { Page } from '@playwright/test';
import type { GameWindow } from './types';

const OFFICIAL_CARD_IMAGE_BASE =
  'https://www.takaratomy.co.jp/products/conan-cardgame/storage/card/';
const LOCAL_CARD_IMAGE =
  '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="3"><rect width="2" height="3" fill="#123"/></svg>';

export async function setupGamePage(
  page: Page,
  path = '/',
): Promise<{ errors: string[] }> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (request) => {
    const errorText = request.failure()?.errorText;
    if (errorText === 'net::ERR_ABORTED') return;
    errors.push(`requestfailed: ${request.url()}: ${errorText ?? 'unknown error'}`);
  });
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    const url = msg.location()?.url ?? '';
    if (text.includes('Failed to load resource') && /404/.test(text)) return;
    if (/favicon\.ico|robots\.txt/.test(url)) return;
    errors.push(`console.error: ${text}`);
  });
  await page.route(`${OFFICIAL_CARD_IMAGE_BASE}**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: LOCAL_CARD_IMAGE,
    });
  });
  await page.goto(path);
  await page.waitForFunction(() => typeof (window as unknown as GameWindow).__game !== 'undefined');
  return { errors };
}
