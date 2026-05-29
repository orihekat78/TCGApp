// spec: .claude/specs/meta-ui/14-tutorial-complete.md + 15-tutorial-lesson-viewer.md
// Phase 16: ハブ (章リスト + ステップカード) + ステップクリック → フルスクリーン lesson viewer

import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('conan.meta.v1.settings'));
});

test('TUTORIAL: ハブで 8 章 + 2 グループラベル表示', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto('/#tutorial');
  await expect(page.getByText('探偵学校')).toBeVisible({ timeout: 6000 });

  await expect(page.getByText('基本ルール').first()).toBeVisible();
  await expect(page.getByText('カードの読み方').first()).toBeVisible();
  await expect(page.getByText('キーワード能力').first()).toBeVisible();
  await expect(page.getByText('上級者向け').first()).toBeVisible();
  await expect(page.locator('text=/初めての方は/')).toBeVisible();
  await expect(page.locator('text=/詳しく知りたい方/')).toBeVisible();

  expect(errors).toEqual([]);
});

test('TUTORIAL: ステップカードクリック → lesson viewer 起動 + ステップ表示', async ({ page }) => {
  await page.goto('/#tutorial');
  await expect(page.getByText('探偵学校')).toBeVisible({ timeout: 6000 });

  // 初期は ch1。中央ステップカード「デッキ構成」をクリック
  await page.getByText('デッキ構成').first().click();

  // viewer ヘッダ「ステップ 1 / 2」が出る
  await expect(page.locator('text=/ステップ 1 \\/ 2/')).toBeVisible();
  // STEP タイトル
  await expect(page.locator('text=/STEP 1/')).toBeVisible();
  // 「次へ →」ボタン
  await expect(page.getByRole('button', { name: /次へ/ })).toBeVisible();
});

test('TUTORIAL: 「次へ」で進行 + cleared を localStorage persist', async ({ page }) => {
  await page.goto('/#tutorial');
  await expect(page.getByText('探偵学校')).toBeVisible({ timeout: 6000 });
  await page.getByText('デッキ構成').first().click();

  // 「次へ →」で ch1-1 cleared、ステップ 2/2 へ
  await page.getByRole('button', { name: /次へ/ }).click();
  await expect(page.locator('text=/ステップ 2 \\/ 2/')).toBeVisible();

  const cleared = await page.evaluate(() => {
    const raw = localStorage.getItem('conan.meta.v1.settings');
    if (!raw) return [];
    return JSON.parse(raw)?.state?.settings?.tutorialClearedStepIds ?? [];
  });
  expect(cleared).toContain('ch1-1');
});

test('TUTORIAL: ch2 キャラカードの番号注釈が viewer 内に表示', async ({ page }) => {
  await page.goto('/#tutorial');
  await expect(page.getByText('探偵学校')).toBeVisible({ timeout: 6000 });
  // 左の章リストから ch2 を選択
  await page.getByText('カードの読み方').first().click();
  // 中央のステップカード「キャラカード」を開く
  await page.getByText('キャラカード').first().click();
  // viewer 内に CardAnnotated の番号注釈ラベル
  await expect(page.locator('text=/AP \\(攻撃力\\)/')).toBeVisible();
  await expect(page.locator('text=/LP \\(推理=証拠枚数\\)/')).toBeVisible();
});

test('TUTORIAL: ch7 疾風ステップを開くと KeywordCard 表示', async ({ page }) => {
  await page.goto('/#tutorial');
  await expect(page.getByText('探偵学校')).toBeVisible({ timeout: 6000 });
  await page.getByText('キーワード能力').first().click();
  await page.getByText('疾風 N').first().click();
  // viewer が開く (ステップ 1 / 6)
  await expect(page.locator('text=/ステップ 1 \\/ 6/')).toBeVisible();
  // KeywordCard の例文 (viewer 内のみ出現する固有文字列)
  await expect(page.locator('text=/効果が起動/')).toBeVisible();
});

test('TUTORIAL: Esc で viewer クローズ → ハブに戻る', async ({ page }) => {
  await page.goto('/#tutorial');
  await expect(page.getByText('探偵学校')).toBeVisible({ timeout: 6000 });
  await page.getByText('デッキ構成').first().click();
  await expect(page.locator('text=/ステップ 1 \\/ 2/')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('text=/ステップ 1 \\/ 2/')).not.toBeVisible();
  // ハブの章概要 CTA が見える
  await expect(page.getByText('章を最初から学ぶ ▸')).toBeVisible();
});

// ── Phase 17: 実対戦フォーマット流用 / 横事件 / region / ガイド実戦 ──

test('TUTORIAL: ch1-2 場のエリアで実 Playmat 盤面スナップショットを表示', async ({ page }) => {
  await page.goto('/#tutorial');
  await expect(page.getByText('探偵学校')).toBeVisible({ timeout: 6000 });
  // ch1 既定。中央ステップカード「場のエリア」を「開く」(nth=1)
  await page.locator('text=開く').nth(1).click();
  await expect(page.locator('text=/ステップ 2 \\/ 2/')).toBeVisible();
  // 実 Playmat のゾーン (.case-area) が viewer 内に描画される
  await expect(page.locator('.tutorial-board-snapshot .case-area').first()).toBeVisible();
  // 右ペインのゾーン一覧
  await expect(page.locator('text=/現場 — キャラ最大 5 枚/')).toBeVisible();
});

test('TUTORIAL: ch2-3 事件カードが横向き (width > height) で表示', async ({ page }) => {
  await page.goto('/#tutorial');
  await expect(page.getByText('探偵学校')).toBeVisible({ timeout: 6000 });
  await page.getByText('カードの読み方').first().click();
  await page.locator('text=開く').nth(2).click(); // 事件カード (3 番目)
  await expect(page.locator('text=/ステップ 3 \\/ 4/')).toBeVisible();
  const card = page.locator('.tutorial-annotated-card');
  await expect(card).toBeVisible();
  const box = await card.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThan(box!.height); // 横向き
});

test('TUTORIAL: ch2-1 キャラカードに region 注釈 + パーツ一覧が出る', async ({ page }) => {
  await page.goto('/#tutorial');
  await expect(page.getByText('探偵学校')).toBeVisible({ timeout: 6000 });
  await page.getByText('カードの読み方').first().click();
  await page.locator('text=開く').nth(0).click(); // キャラカード
  // カード上の region ボックス (data-region) が複数描画される
  expect(await page.locator('.tutorial-annotated-card [data-region]').count()).toBeGreaterThanOrEqual(5);
  // 右ペインのパーツ一覧 (AP / LP)
  await expect(page.locator('text=/AP \\(攻撃力\\)/')).toBeVisible();
});

test('TUTORIAL: ch3 「この章を実戦で試す」で実戦起動 + ガイド overlay 表示', async ({ page }) => {
  await page.goto('/#tutorial');
  await expect(page.getByText('探偵学校')).toBeVisible({ timeout: 6000 });
  await page.getByText('ゲーム開始からターン進行').first().click();
  await page.locator('text=開く').nth(0).click(); // ch3-1
  await expect(page.getByText('この章を実戦で試す')).toBeVisible();
  await page.getByText('この章を実戦で試す').click();
  await expect(page).toHaveURL(/#match/);
  // src の TutorialOverlay が該当 step で表示される
  await expect(page.locator('.tutorial-overlay')).toBeVisible({ timeout: 8000 });
});
