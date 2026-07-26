// spec: .claude/specs/meta-ui/ (Phase 18: DeckEditor リデザイン + 同 ID 3 枚上限の UI 可視化)
// 「処理だけでなく UI 上で確認できる」ことを検証する (rules/02: 同じカード=同 ID、最大 3 枚)。

import { test, expect } from '@playwright/test';

test('DECK: 検証 OK + 40/40 + 同 ID 上限到達カードが MAX 表示 (console error 0)', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/#deck');

  // サンプルデッキ (40 枚・パートナー1・事件1) は検証 OK
  await expect(page.getByText('検証 OK')).toBeVisible({ timeout: 6000 });
  // 40 / 40 のカウント
  await expect(page.getByText('/ 40').first()).toBeVisible();
  // 同 ID が 3 枚に達したカードは MAX 表示 (パラレルを合算してグレーアウト)
  await expect(page.getByText('MAX 3').first()).toBeVisible();

  expect(errors).toEqual([]);
});

test('DECK: プールカード選択 → 詳細で「同 ID 上限」が確認できる (クリック→状態反映)', async ({ page }) => {
  await page.goto('/#deck');
  await expect(page.getByText('検証 OK')).toBeVisible({ timeout: 6000 });

  // 灰原哀 (D08005, id 0490) はサンプルデッキで 3 枚 → プールタイルは "灰原哀 3/3"
  await page.getByLabel('灰原哀 3/3').first().click();
  // 詳細パネルに同 ID 上限の注記が出る (＋ ボタンは無効)
  await expect(page.getByText('同 ID 上限')).toBeVisible();
});

test('DECK: パラレル合算の同ID上限が UI で機能する (追加→兄弟絵柄もMAX→4枚目ブロック)', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/#deck');
  await expect(page.getByText('検証 OK')).toBeVisible({ timeout: 6000 });

  // 毛利蘭は D08023×2 のみ採用 = cardId 0096 が 2/3。
  // 同 cardId の全印刷が合算で "2/3" 表示 (パラレル合算の可視化)。
  const at2 = page.getByLabel('毛利蘭 2/3');
  const variantCount = await at2.count();
  expect(variantCount).toBeGreaterThanOrEqual(2);
  await page.screenshot({ path: '.tmp/verify-id-before.png', fullPage: false });

  // 1 枚目の絵柄を選択 → 詳細パネルに "2 / 3" + ＋ 有効
  await at2.first().click();
  await expect(page.getByText('2 / 3')).toBeVisible();
  // 詳細の ＋ で +1 → cardId 0096 = 3 → 全絵柄が "3/3" + MAX 表示
  await page.getByRole('button', { name: '1枚追加' }).press('Enter');
  await expect(page.getByLabel('毛利蘭 3/3')).toHaveCount(variantCount);
  await expect(page.getByText('MAX 3').first()).toBeVisible();

  // 兄弟絵柄 (別 cardNum・同 cardId) を選択 → 詳細で「同 ID 上限」+ ＋ 無効でブロックが可視
  await page.getByLabel('毛利蘭 3/3').last().click();
  await expect(page.getByText('同 ID 上限')).toBeVisible();
  await expect(page.getByRole('button', { name: '1枚追加' })).toBeDisabled();
  await page.screenshot({ path: '.tmp/verify-id-after.png', fullPage: false });

  // 4/3 にはならない (兄弟絵柄経由でも超過不可)
  await expect(page.getByLabel('毛利蘭 4/3')).toHaveCount(0);

  expect(errors).toEqual([]);
});

test('DECK migration: v1 サンプルデッキの事件混入が v2 で自動修復される (BUG-126 / review HIGH)', async ({ page }) => {
  await page.goto('/');
  // v1 (version:1) 形式の永続データを仕込む: sample-d11 に違法な事件カード D11021 が混入
  await page.evaluate(() => {
    localStorage.setItem('conan.meta.v1.decks', JSON.stringify({
      version: 1,
      state: {
        decks: [
          { id: 'sample-d08', name: '少年探偵団・標準', partner: 'D08001', modified: 0, cards: [{ num: 'D08005', count: 3 }] },
          { id: 'sample-d11', name: '警察・標準', partner: 'D11001', modified: 0, cards: [{ num: 'D11021', count: 3 }] },
        ],
      },
    }));
  });
  await page.goto('/#deck');
  await expect(page.getByText(/検証 OK|検証エラー/).first()).toBeVisible({ timeout: 6000 });
  // 警察・標準 (sample-d11) に切替 → migrate で正データに修復され、事件混入エラーが出ない
  await page.locator('select').first().selectOption('sample-d11');
  await expect(page.getByText('検証 OK')).toBeVisible();
  await expect(page.getByText('デッキに事件は入れられません')).toHaveCount(0);
});

test('DECK: デッキコードのエクスポートが表示される', async ({ page }) => {
  await page.goto('/#deck');
  await expect(page.getByText('検証 OK')).toBeVisible({ timeout: 6000 });
  await page.getByRole('button', { name: 'コード' }).click();
  await expect(page.getByText('デッキコード · 入出力')).toBeVisible();
  // エクスポート用 textarea に CONAN1: コードが入っている
  const ta = page.locator('textarea').first();
  await expect(ta).toHaveValue(/^CONAN1:/);
});

test('DECK: 右クリックでデッキとプールのカードを拡大表示できる', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/#deck');
  await expect(page.getByText('検証 OK')).toBeVisible({ timeout: 6000 });

  // 先頭はデッキ内、末尾はプール内の同一カード。
  const conan = page.getByLabel('江戸川コナン 2/3');
  await conan.first().click({ button: 'right' });
  await expect(page.getByRole('dialog', { name: 'カード拡大表示: 江戸川コナン' })).toBeVisible();
  await page.getByRole('button', { name: '閉じる' }).click();

  await conan.last().click({ button: 'right' });
  await expect(page.getByRole('dialog', { name: 'カード拡大表示: 江戸川コナン' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('DECK: 混色カードの詳細に全色を表示する', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('conan.meta.v1.decks', JSON.stringify({
      version: 3,
      state: {
        decks: [{
          id: 'color-test', name: '色表示テスト', partner: 'D08001', case: 'D08026', modified: 0,
          cards: [{ num: 'B10097', count: 1 }],
        }],
      },
    }));
  });
  await page.goto('/#deck');
  await page.getByRole('button', { name: '毛利蘭＆ベルモット 1/3' }).first().click();
  await expect(page.locator('[data-card-colors="blue,black"]')).toBeVisible();
  await expect(page.locator('[data-card-colors="blue,black"]')).toHaveText('BLUEBLACK');
});

test('DECK: 右クリックでパートナー・事件・選択候補を拡大表示できる', async ({ page }) => {
  await page.goto('/#deck');
  await expect(page.getByText('検証 OK')).toBeVisible({ timeout: 6000 });

  const partnerSlot = page.getByRole('button', { name: /パートナー/ }).first();
  await partnerSlot.click({ button: 'right' });
  await expect(page.getByRole('dialog', { name: 'カード拡大表示: 江戸川コナン' })).toBeVisible();
  await page.getByRole('button', { name: '閉じる' }).click();

  const caseSlot = page.getByRole('button', { name: /事件/ }).first();
  await caseSlot.click({ button: 'right' });
  await expect(page.getByRole('dialog', { name: 'カード拡大表示: 青の古城探索事件' })).toBeVisible();
  await page.getByRole('button', { name: '閉じる' }).click();

  await partnerSlot.click();
  await expect(page.getByText('パートナーを選択')).toBeVisible();
  const partnerCandidate = page.locator('[role="button"][aria-label="江戸川コナン"]').last();
  await partnerCandidate.click({ button: 'right' });
  await expect(page.getByRole('dialog', { name: 'カード拡大表示: 江戸川コナン' })).toBeVisible();
});

test('DECK: 枚数上限なしのカードは 4 枚以上でも追加でき、∞ 表示になる', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('conan.meta.v1.decks', JSON.stringify({
      version: 2,
      state: {
        decks: [{
          id: 'unlimited-test', name: '上限なしテスト', partner: 'D08001', case: 'D08026',
          cards: [{ num: 'PR158', count: 4 }], modified: 0,
        }],
      },
    }));
  });

  await page.goto('/#deck');
  const unlimited = page.getByLabel('犯人 4/∞');
  await expect(unlimited.first()).toBeVisible({ timeout: 6000 });
  await unlimited.first().click();
  await expect(page.getByText('4 / ∞')).toBeVisible();
  await expect(page.getByRole('button', { name: '1枚追加' })).toBeEnabled();
  await page.getByRole('button', { name: '1枚追加' }).press('Enter');
  await expect(page.getByLabel('犯人 5/∞').first()).toBeVisible();
});

test('DECK migration: v2 の標準2デッキだけを最新構成へ更新し、ユーザーデッキを保持する', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('conan.meta.v1.decks', JSON.stringify({
      version: 2,
      state: {
        decks: [
          {
            id: 'sample-d08', name: '少年探偵団・標準', partner: 'D08001', case: 'D08026', modified: 1,
            cards: [{ num: 'D11019', count: 3 }],
          },
          {
            id: 'sample-d11', name: '警察・標準', partner: 'D11001', case: 'D11021', modified: 1,
            cards: [{ num: 'D08007', count: 3 }],
          },
          {
            id: 'user-deck', name: 'ユーザーデッキ', partner: 'PR220', case: 'B06043', modified: 1,
            cards: [{ num: 'B04026', count: 3 }],
          },
        ],
      },
    }));
  });

  await page.goto('/#deck');
  const persisted = await page.evaluate(() => {
    const raw = localStorage.getItem('conan.meta.v1.decks');
    return raw ? JSON.parse(raw) : null;
  });

  expect(persisted.version).toBe(3);
  const decks = persisted.state.decks as Array<{
    id: string;
    name: string;
    partner: string;
    case: string;
    modified: number;
    cards: Array<{ num: string; count: number }>;
  }>;
  const d08 = decks.find((deck) => deck.id === 'sample-d08');
  const d11 = decks.find((deck) => deck.id === 'sample-d11');
  const user = decks.find((deck) => deck.id === 'user-deck');
  expect(d08?.cards.reduce((sum, card) => sum + card.count, 0)).toBe(40);
  expect(d08?.cards.every((card) => card.num.startsWith('D08'))).toBe(true);
  expect(d11?.cards.reduce((sum, card) => sum + card.count, 0)).toBe(40);
  expect(d11?.cards.every((card) => card.num.startsWith('D11'))).toBe(true);
  expect(user).toEqual({
    id: 'user-deck', name: 'ユーザーデッキ', partner: 'PR220', case: 'B06043', modified: 1,
    cards: [{ num: 'B04026', count: 3 }],
  });
});
