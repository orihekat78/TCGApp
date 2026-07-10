// E2E: mini-wave #5 P2 — B05047「【登場時】自分のデッキのカードを上から2枚見て、好きな順番で
// デッキの上か下に移す。（上と下に1枚ずつ移せる）」の human 実機検証。
//
// 検証点 (画面処理 = カードテキスト文言):
//   1. handUseCard B05047 (白 case + FILE7) → 登場 → enter trigger → DeckPlaceModal が開く
//   2. modal は「見た 2 枚」だけを行として表示 (デッキ 3 枚目は出ない = window 制限)
//   3. row0 を「下」に割当て確定 → deck が [row1, 残り, row0] になる (上と下に1枚ずつ)
//   4. console error 0

import { test, expect, type Page } from '@playwright/test';
import { setupGamePage, buildGameState, getGameState, dispatchAction } from './helpers';

async function prime(page: Page): Promise<void> {
  await page.evaluate(() => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const w = window as unknown as { __game: { store: { getState: () => { setSpectatorMode: (v: boolean) => void } } } };
    w.__game.store.getState().setSpectatorMode(false);
  });
}

type AnyState = Record<string, unknown>;

function fx(gs: AnyState): void {
  const players = gs.players as { self: AnyState; opp: AnyState };
  const self = players.self;
  self.partner = { cardId: 'D11001', state: 'active', location: 'partner-area' };
  // B05047 は【白】lv7 — 白 case + FILE7 で手札使用可
  self.case = { cardId: 'D11021', status: '事件編', requiredEvidence: 7, colors: ['白'], declaredUseCount: {} };
  const fb = { type: 'card-back', cardId: 'D11017' };
  self.file = [fb, fb, fb, fb, fb, fb, fb]; // FILE 7 >= level7
  self.hand = ['B05047'];
  self.deck = ['D11020', 'D11013', 'D11017']; // 上2枚 = D11020, D11013 が振り分け対象
  self.scene = [];
  self.evidence = [];
  self.remove = [];
  gs.pendingEffects = [];
  gs.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
}

test('mini-wave #5: B05047 登場時 → DeckPlaceModal で上/下振り分けが deck に反映される', async ({ page }) => {
  const { errors } = await setupGamePage(page);
  await prime(page);
  await buildGameState(page, fx);

  await dispatchAction(page, { type: 'handUseCard', player: 'self', cardId: 'B05047' });

  // 登場 + enter trigger → modal 表示
  const modal = page.getByTestId('deck-place-modal');
  await expect(modal).toBeVisible({ timeout: 6000 });

  // window 制限: 行は見た 2 枚のみ (3 枚目 D11017 は出ない)
  await expect(page.getByTestId('deck-place-row-0')).toBeVisible();
  await expect(page.getByTestId('deck-place-row-1')).toBeVisible();
  await expect(page.getByTestId('deck-place-row-2')).toHaveCount(0);

  // row0 (D11020) を「下」へ、row1 (D11013) は既定「上」のまま → 確定
  await page.getByTestId('deck-place-bottom-0').click();
  await page.getByTestId('deck-place-confirm-btn').click();

  await expect(modal).toHaveCount(0, { timeout: 6000 });

  // deck = [D11013(上), D11017(元3枚目), D11020(下)] — 「上と下に1枚ずつ」が語義通り反映
  await expect
    .poll(async () => {
      const gs = await getGameState(page);
      return (gs.players.self as { deck: string[] }).deck;
    }, { timeout: 6000 })
    .toEqual(['D11013', 'D11017', 'D11020']);

  // B05047 は現場に居る (登場自体の確認)
  const gs = await getGameState(page);
  expect((gs.players.self as { scene: { cardId: string }[] }).scene.map(c => c.cardId)).toContain('B05047');

  expect(errors, 'console error 0').toEqual([]);
});
