// E2E: 突撃バッジ (user 指摘, 2026-06-01)
//   - 名乗りバッジ同様、突撃 / 突撃[キャラ] / 突撃[事件] / 迅速 が付与されたキャラにバッジ表示。
//   - D11019: リムーブ黄20枚で登場キャラに突撃[事件] 付与 → 「突事」バッジ表示。
//   - 条件未達 (黄0) では非表示。
//
// 注: buildGameState の modifier はブラウザ側で文字列化実行されるためクロージャ不可。
//     リムーブ黄枚数は arg (第3引数) で渡す。

import { test, expect, type Page } from '@playwright/test';
import { setupGamePage, buildGameState, dispatchAction } from './helpers';

async function prime(page: Page): Promise<void> {
  await page.evaluate(() => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const w = window as unknown as { __game: { store: { getState: () => { setSpectatorMode: (v: boolean) => void } } } };
    w.__game.store.getState().setSpectatorMode(false);
  });
}

type AnyState = Record<string, unknown>;

// arg = リムーブする黄カード枚数 (クロージャ不可のため arg で受ける)
function applyFixture(gs: AnyState, removeYellow: number): void {
  const players = gs.players as { self: AnyState };
  const self = players.self;
  self.partner = { cardId: 'D11001', state: 'active', location: 'partner-area' };
  self.case = { cardId: 'D11021', status: '事件編', requiredEvidence: 7, colors: ['黄'], declaredUseCount: {} };
  const fb = { type: 'card-back', cardId: 'D11017' };
  self.file = [fb, fb, fb, fb, fb];
  self.hand = ['D11019'];
  self.deck = ['D11013'];
  self.remove = Array.from({ length: removeYellow }, () => 'D11013'); // 黄
  self.scene = [];
  self.evidence = [];
  gs.pendingEffects = [];
  gs.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
}

test('突撃[事件] バッジ: リムーブ黄20枚で「突事」バッジ表示', async ({ page }) => {
  await setupGamePage(page);
  await prime(page);
  await buildGameState<number>(page, applyFixture, 20);

  await dispatchAction(page, { type: 'handUseCard', player: 'self', cardId: 'D11019' });

  await expect
    .poll(async () => page.locator('.charge-badge', { hasText: '突事' }).count(), { timeout: 8000 })
    .toBeGreaterThan(0);
});

test('突撃[事件] バッジ: リムーブ黄0枚では非表示 (条件未達)', async ({ page }) => {
  await setupGamePage(page);
  await prime(page);
  await buildGameState<number>(page, applyFixture, 0);

  await dispatchAction(page, { type: 'handUseCard', player: 'self', cardId: 'D11019' });

  await page.locator('[data-testid="deck-reveal-overlay"]').waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(200);
  expect(await page.locator('.charge-badge').count(), '条件未達では突撃バッジ非表示').toBe(0);
});
