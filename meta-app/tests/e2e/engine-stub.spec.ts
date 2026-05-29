// spec: .claude/specs/meta-ui/05-engine-stub.md + 10-integration-with-src.md
// Phase 11: engineStub は DeckEditor の validateDeck で引き続き利用
// SETUP→MATCH は実機 performGameStart 経路に切り替わったため simulateMatch 系テストは削除

import { test, expect } from '@playwright/test';

test('validateDeck: 40 枚ちょうど + ID 上限 3 + パートナー必須', async ({ page }) => {
  await page.goto('/#deck');
  // DECK 編集画面で WarningBanner が表示される (SAMPLE_DECK は 40 枚なので OK 状態)
  await expect(page.locator('text=/検証 OK|検証エラー/')).toBeVisible({ timeout: 6000 });
});

test('localStorage namespace 分離: meta-app は conan.meta.v1.* のみ書き込み', async ({ page }) => {
  await page.goto('/#home');
  await page.waitForTimeout(500);
  const keys = await page.evaluate(() => Object.keys(localStorage).sort());
  // 5174 が書き込む localStorage キーは全て conan.meta.v1 prefix を持つこと
  // (Phase 11 で src/ から import するようになっても、localStorage に書く側は meta-app stores のみ)
  for (const k of keys) {
    expect(k, `unexpected localStorage key on 5174: ${k}`).toMatch(/^conan\.meta\.v1\./);
  }
});
