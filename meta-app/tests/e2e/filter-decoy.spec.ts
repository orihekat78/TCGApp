// spec: card-addition-checklist.md §7 「画面処理 = テキスト文言」の deck-builder 適用。
// facet フィルタが語義通りに動くか、decoy (条件外カード) を盤面に置いて
// 「混入しない / 条件内が漏れない」を実機で踏む。
// 灰原哀 = 青のみ / 萩原千速 = 黄のみ (逆色の decoy なし、実データ検証済) を使う。

import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('conan.meta.v1.filters'));
});

test('CARDS §7: 色 facet が decoy を除外し、条件内の漏れも無い', async ({ page }) => {
  await page.goto('/#cards');
  await expect(page.getByText('34 種類').first()).toBeVisible({ timeout: 6000 });
  // 名前が出るリスト表示へ
  await page.getByRole('button', { name: 'リスト' }).click();

  // フィルタ無し: 青の灰原哀・黄の萩原千速 ともに候補に出る
  await expect(page.getByText('灰原哀').first()).toBeVisible();
  await expect(page.getByText('萩原千速').first()).toBeVisible();

  // 色=青 → 黄の萩原千速(decoy)は混入せず、青の灰原哀は残る
  await page.locator('button.meta-chip', { hasText: '青' }).first().click();
  await expect(page.getByText('灰原哀').first()).toBeVisible();
  await expect(page.getByText('萩原千速')).toHaveCount(0);

  // 青オフ → 黄 → 逆に灰原哀が消え萩原千速が残る (条件内の漏れも無い)
  await page.locator('button.meta-chip', { hasText: '青' }).first().click();
  await page.locator('button.meta-chip', { hasText: '黄' }).first().click();
  await expect(page.getByText('萩原千速').first()).toBeVisible();
  await expect(page.getByText('灰原哀')).toHaveCount(0);
});

test('DECK §7: プールの色 facet が decoy を除外 (キャラ/イベントのみ)', async ({ page }) => {
  await page.goto('/#deck');
  await expect(page.getByText('検証 OK')).toBeVisible({ timeout: 6000 });

  // 色=青 → 黄の萩原千速(キャラ)はプールから消える
  await page.locator('button.meta-chip', { hasText: '青' }).first().click();
  await expect(page.getByLabel('萩原千速')).toHaveCount(0);

  // 青オフ → 黄 → 萩原千速が出る
  await page.locator('button.meta-chip', { hasText: '青' }).first().click();
  await page.locator('button.meta-chip', { hasText: '黄' }).first().click();
  await expect(page.getByLabel('萩原千速').first()).toBeVisible();
});
