// E2E: DeckRevealOverlay の演出 (user 指摘 #1, 2026-06-01)
//   - 公開カードを「カード画像つき」で表示 (旧: カード名テキストのみ)
//   - matched カードに「登場!」badge
//   - reveal → toBottom (残りをデッキ下へ) → shuffle (デッキシャッフル) の phase 進行
//
// 検証カード: D11019「15の受難」(deckRevealUntil → sceneEnter)

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

function fx(gs: AnyState): void {
  const players = gs.players as { self: AnyState };
  const self = players.self;
  self.partner = { cardId: 'D11001', state: 'active', location: 'partner-area' };
  self.case = { cardId: 'D11021', status: '事件編', requiredEvidence: 7, colors: ['黄'], declaredUseCount: {} };
  const fb = { type: 'card-back', cardId: 'D11017' };
  self.file = [fb, fb, fb, fb, fb];
  self.hand = ['D11019'];
  self.deck = ['D11020', 'D11013', 'D11017', 'D11017']; // D11020(非マッチ) → D11013(マッチ)
  self.scene = [];
  self.evidence = [];
  self.remove = [];
  gs.pendingEffects = [];
  gs.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
}

test('DeckRevealOverlay: カード画像 + 登場 badge + phase 進行 (reveal→shuffle)', async ({ page }) => {
  const { errors } = await setupGamePage(page);
  await prime(page);
  await buildGameState(page, fx);

  await dispatchAction(page, { type: 'handUseCard', player: 'self', cardId: 'D11019' });

  // reveal phase: overlay + カード画像 (旧バグ: テキストのみで img=0 だった)
  await page.locator('[data-testid="deck-reveal-overlay"]').waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('img.deck-reveal-card-art').first().waitFor({ state: 'visible', timeout: 3000 });
  const imgCount = await page.locator('[data-testid="deck-reveal-overlay"] img.deck-reveal-card-art').count();
  expect(imgCount, 'カード画像が表示される').toBeGreaterThan(0);
  expect(await page.locator('.deck-reveal-match-badge').count(), 'matched に登場 badge').toBe(1);

  // phase 進行: shuffle phase で shuffle 演出が表示される (デッキシャッフルの可視化)
  await page.locator('[data-testid="deck-reveal-shuffle"]').waitFor({ state: 'visible', timeout: 6000 });

  // 演出完了後 overlay は自動で消える
  await page.locator('[data-testid="deck-reveal-overlay"]').waitFor({ state: 'detached', timeout: 5000 });

  expect(errors, 'console error 0').toEqual([]);
});

test('BUG-331 Investigation: public reveal moves to bottom without a false shuffle phase', async ({ page }) => {
  const { errors } = await setupGamePage(page);
  await prime(page);
  await buildGameState(page, (gs: AnyState) => {
    const players = gs.players as { self: AnyState; opp: AnyState };
    players.self.scene = [{
      cardId: 'B01084', uid: 'souza-source', state: 'sleep', isNamed: false,
      enterOrder: 1, setCards: [], stackedCards: 0,
      keywordOverrides: { granted: [], disabledOriginal: false },
      apOverride: null, lpOverride: null,
      turnEffects: { contactImmune: false, removeOnTurnEnd: false },
      declaredUseCount: {},
    }];
    players.self.deck = Array.from({ length: 12 }, () => 'D08015');
    players.opp.deck = Array.from({ length: 12 }, (_value, index) => index === 0 ? 'D08017' : 'D08015');
    gs.pendingEffects = [];
    gs.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  });

  expect(await dispatchAction(page, { type: 'endTurn', player: 'self' })).toEqual({ ok: true });
  const overlay = page.getByTestId('deck-reveal-overlay');
  await expect(overlay).toBeVisible();
  await expect(page.getByTestId('deck-reveal-header')).toContainText('デッキの下', { timeout: 3_000 });
  await page.waitForTimeout(1_200);
  await expect(page.getByTestId('deck-reveal-shuffle')).toHaveCount(0);
  await expect(overlay).toHaveCount(0);
  expect(errors, 'console error 0').toEqual([]);
});
