// spec: .claude/specs/meta-ui/11-cards-rebuild.md
// Phase 12-D: CardsScreen 主要要素の存在 + お気に入り persist + 検索 + デッキ追加遷移
// Phase 18: 種類は cardId 単位 (34 種 / 全 47 種)。COVERAGE → CATALOG。

import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // テスト独立性のため favorites をクリア
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.removeItem('conan.meta.v1.settings');
  });
});

test('CARDS: 34 種類 (cardId 単位) + CATALOG + 詳細パネル + フィルター', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/#cards');

  // 34 種類 · 全 47 種 (パラレルを cardId で畳む)
  await expect(page.getByText('34 種類').first()).toBeVisible({ timeout: 6000 });
  // CATALOG 見出し (旧 COVERAGE)
  await expect(page.getByText('CATALOG')).toBeVisible();
  // BY COLOR / BY RARITY
  await expect(page.getByText('BY COLOR')).toBeVisible();
  await expect(page.getByText('BY RARITY')).toBeVisible();
  // CARDS リスト見出し
  await expect(page.locator('text=/CARDS · \\d+ 件 一致/')).toBeVisible();
  // 詳細パネルの EFFECT / USAGE
  await expect(page.getByText('EFFECT · 効果')).toBeVisible();
  await expect(page.getByText('USAGE · このカードでの戦績')).toBeVisible();

  expect(errors).toEqual([]);
});

test('CARDS: 検索ボックスで件数が変化する', async ({ page }) => {
  await page.goto('/#cards');
  // パラレルまとめ ON 既定 → 34 件
  await expect(page.locator('text=/CARDS · 34 件 一致/')).toBeVisible({ timeout: 6000 });
  await page.getByPlaceholder('名前 / 効果 / 番号 / 特徴 で検索').fill('灰');
  await expect(page.locator('text=/CARDS · [0-9]+ 件 一致/')).not.toContainText('34 件');
});

test('CARDS: ★ お気に入り toggle が localStorage に persist', async ({ page }) => {
  await page.goto('/#cards');
  await expect(page.locator('text=/USAGE/')).toBeVisible({ timeout: 6000 });
  // 詳細パネルの「★ お気に入り」ボタン (exact: フィルタの「★ お気に入りのみ」と区別)
  await page.getByRole('button', { name: '★ お気に入り', exact: true }).click();
  // localStorage に書かれた favorites が non-empty
  const favCount = await page.evaluate(() => {
    const raw = localStorage.getItem('conan.meta.v1.settings');
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    return parsed?.state?.settings?.favorites?.length ?? 0;
  });
  expect(favCount).toBeGreaterThanOrEqual(1);
});

test('CARDS: 「+ デッキへ追加」で #deck へ遷移', async ({ page }) => {
  await page.goto('/#cards');
  await expect(page.locator('text=/USAGE/')).toBeVisible({ timeout: 6000 });
  await page.locator('button', { hasText: '+ デッキへ追加' }).click();
  await page.waitForURL(/#deck/);
});
