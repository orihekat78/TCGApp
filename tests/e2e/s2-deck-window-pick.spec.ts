// E2E: S2 deck cluster — B01022「少年探偵団」の human 実機検証 (T3 Playwright ゲート)。
//
// 検証点 (画面処理 = カードテキスト文言):
//   1. handUseCard B01022 (青 case + パートナー青 + FILE6 + 手札は B01022 のみ = 手札0 QA 経路で
//      discard 不発) → DeckRevealOverlay (公開 6 枚) + CardListModal 'deck' が自動で開く
//   2. modal 候補 = window 内の「レベル4以下の[少年探偵団]」のみ:
//      D08015(lv3)+D08013(lv4) は選べる / D08009(lv5)・D08011(lv6) は候補に出ない /
//      D08017(lv2、デッキ 7 枚目 = window 外) も候補に出ない
//   3. 2 枚選択 → 完了 → 両方が現場に登場、デッキは 5 枚 (残り 4 が下へ + 深部 1)、
//      window 外の D08017 はデッキに残る
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
  self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' }; // 青 —【パートナー青】成立
  self.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 7, colors: ['青'], declaredUseCount: {} };
  const fb = { type: 'card-back', cardId: 'D08017' };
  self.file = [fb, fb, fb, fb, fb, fb]; // FILE 6 >= B01022 level6
  self.hand = ['B01022']; // 使用後 手札0 → 「手札を1枚リムーブ」は不発で以降解決 (公式Q&A)
  // fixture は【登場時】trigger を持たない少年探偵団を採用 (B04009 lv3 / B09017 lv4 / B05018 lv2)
  // — D08013/D08015 等は実効果 (draw/証拠) が発火してデッキ枚数 assert を汚すため不適 (実測)。
  // window = 上6: [B04009(lv3✓), D08009(lv5), D08011(lv6), D08003(lv8), B09017(lv4✓), D08009]
  // idx6 = B05018 (lv2✓ trait 一致だが window 外 decoy)
  self.deck = ['B04009', 'D08009', 'D08011', 'D08003', 'B09017', 'D08009', 'B05018'];
  self.scene = [];
  self.evidence = [];
  self.remove = ['D08017']; // リフレッシュ安全弁
  gs.pendingEffects = [];
  gs.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
}

test('S2: B01022 — 公開6枚 window から filter 一致 2 枚を multi-pick で登場、残りはデッキ下', async ({ page }) => {
  const { errors } = await setupGamePage(page);
  await prime(page);
  await buildGameState(page, fx);

  await dispatchAction(page, { type: 'handUseCard', player: 'self', cardId: 'B01022' });

  // DeckRevealOverlay (公開演出) が hold — CardListModal 'deck' が自動 open
  // Deck window decision is owned by CardListModal; the reveal overlay must not cover it.
  await expect(page.getByTestId('deck-reveal-overlay')).toHaveCount(0);
  await expect(page.locator('.card-list-modal')).toBeVisible({ timeout: 6000 });

  // 候補: B04009 (deck idx0) と B09017 (deck idx4) のみ click 可能
  const pickA = page.getByTestId('card-list-pick-card:self:deck:B04009#0');
  const pickB = page.getByTestId('card-list-pick-card:self:deck:B09017#4');
  await expect(pickA).toBeVisible({ timeout: 6000 });
  await expect(pickB).toBeVisible();
  // 候補外 (lv5/lv6/lv8/window 外) は pick cell が存在しない
  await expect(page.getByTestId('card-list-pick-card:self:deck:D08009#1')).toHaveCount(0);
  await expect(page.getByTestId('card-list-pick-card:self:deck:D08011#2')).toHaveCount(0);
  await expect(page.getByTestId('card-list-pick-card:self:deck:B05018#6')).toHaveCount(0);

  // 2 枚選択 → 完了
  await pickA.click();
  await pickB.click();
  await page.getByTestId('card-list-pick-confirm').click();

  // 現場に 2 枚登場
  await expect
    .poll(async () => {
      const gs = await getGameState(page);
      return (gs.players.self as { scene: { cardId: string }[] }).scene.map((c) => c.cardId).sort();
    }, { timeout: 6000 })
    .toEqual(['B04009', 'B09017']);

  // デッキ: 7 - 2 = 5 枚 (残り window 4 枚が下へ + 深部 D08017)。window 外 D08017 は残存。
  const gs = await getGameState(page);
  const deck = (gs.players.self as { deck: string[] }).deck;
  expect(deck.length).toBe(5);
  expect(deck).toContain('B05018');
  // 使用済イベントはリムーブへ
  expect((gs.players.self as { remove: string[] }).remove).toContain('B01022');
  // 手札 0 のまま (discard 不発)
  expect((gs.players.self as { hand: string[] }).hand).toEqual([]);

  // console error 0
  expect(errors).toEqual([]);
});
