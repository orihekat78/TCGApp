// spec: .claude/specs/meta-ui/09-phasing-and-verification.md
// スモークテスト: 全 10 ハッシュルートが console error なしで描画される

import { test, expect } from '@playwright/test';

const ROUTES = [
  'home', 'setup', 'match', 'result',
  'deck', 'cards', 'history', 'replay',
  'tutorial', 'settings',
] as const;

for (const route of ROUTES) {
  test(`route #${route} renders without console errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto(`/#${route}`);
    // MetaShell + meta-fade アニメ完了まで待機
    await page.waitForTimeout(400);

    // ページが描画されていること (meta-root に何かしらの DOM がある)
    const root = await page.locator('#meta-root');
    await expect(root).toBeVisible();
    await expect(page.getByText('OFFLINE', { exact: true })).toHaveCount(0);

    expect(errors, `console errors on /#${route}`).toEqual([]);
  });
}
