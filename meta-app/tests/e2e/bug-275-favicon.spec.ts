import { test, expect } from '@playwright/test';

test.describe('BUG-275 — favicon 404', () => {
  test('favicon が宣言され、参照先を取得できる', async ({ page, request }) => {
    await page.goto('/#setup');

    const icon = page.locator('link[rel~="icon"]');
    await expect(icon).toHaveCount(1);
    await expect(icon).toHaveAttribute('href', '/favicon.svg');

    const href = await icon.getAttribute('href');
    const response = await request.get(new URL(href!, page.url()).toString());
    expect(response.status()).toBe(200);
  });

  test('851x393 でも同じ favicon 宣言を維持する', async ({ page }) => {
    await page.setViewportSize({ width: 851, height: 393 });
    await page.goto('/#setup');

    const icon = page.locator('link[rel~="icon"]');
    await expect(icon).toHaveCount(1);
    await expect(icon).toHaveAttribute('href', '/favicon.svg');
  });
});
