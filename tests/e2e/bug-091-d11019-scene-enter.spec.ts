// E2E regression: BUG-091 — D11019「15の受難」a1 で deckRevealUntil が matched した
// レベル4以下【黄】キャラが現場に登場する (旧バグ: $matched binding キー不一致で sceneEnter
// silent no-op → 登場せず)。
//
// 根本原因: deckRevealUntil は ctx.bindings['$matched'] ($込み) に格納するが resolveBindRef は
//   '$matched.cardId' を 'matched' ($無し) で lookup していた。fallback を追加して解決。

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
  self.case = { cardId: 'D11021', status: '事件編', requiredEvidence: 7, colors: ['黄'], declaredUseCount: {} };
  const fb = { type: 'card-back', cardId: 'D11017' };
  self.file = [fb, fb, fb, fb, fb]; // FILE 5 >= level4 (D11019 使用可)
  self.hand = ['D11019'];
  // D11020 = 黄イベント (kind≠character → 非マッチ) → D11013 (黄 lv2 character → マッチ)
  self.deck = ['D11020', 'D11013', 'D11017', 'D11017'];
  self.scene = [];
  self.evidence = [];
  self.remove = [];
  gs.pendingEffects = [];
  gs.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
}

test('BUG-091: D11019 a1 で matched 黄キャラ(D11013)が現場に登場する', async ({ page }) => {
  const { errors } = await setupGamePage(page);
  await prime(page);
  await buildGameState(page, fx);

  await dispatchAction(page, { type: 'handUseCard', player: 'self', cardId: 'D11019' });

  // 修正後: matched した D11013 が現場に登場する
  await expect
    .poll(async () => {
      const gs = await getGameState(page);
      return ((gs.players.self as { scene: { cardId: string }[] }).scene).map((c) => c.cardId);
    }, { timeout: 6000 })
    .toContain('D11013');

  expect(errors, 'console error 0').toEqual([]);
});
