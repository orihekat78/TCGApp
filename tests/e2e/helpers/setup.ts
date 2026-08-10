// E2E test setup helper — page.goto + window.__game 待機 + console error collector
// 静的リソース 404 (favicon 等) は filter で除外

import type { Page } from '@playwright/test';
import type { GameWindow } from './types';

export async function setupGamePage(
  page: Page,
  path = '/',
): Promise<{ errors: string[] }> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    const url = msg.location()?.url ?? '';
    if (text.includes('Failed to load resource') && /404/.test(text)) return;
    if (/favicon\.ico|robots\.txt/.test(url)) return;
    errors.push(`console.error: ${text}`);
  });
  await page.goto(path);
  await page.waitForFunction(() => typeof (window as unknown as GameWindow).__game !== 'undefined');
  return { errors };
}
