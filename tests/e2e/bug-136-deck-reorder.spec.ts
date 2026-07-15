// E2E regression: BUG-136 — deckToBottomBound「残りを好きな順番でデッキの下に移す」順序選択 modal
//
// 実機 UI 経路 (modal 表示 → 並べ替え操作 → 確定 → deck 底ブロック再配置) を検証する。
// engine 側の side-channel set / deckReorderResolve は unit test (bug-136-deck-reorder.test.ts) で
// カバー済。本 spec は UI → dispatch → engine の経路 (DeckReorderModalHost の ▲▼ 並べ替え +
// deck-reorder-confirm-btn → deck 反映) を実機で踏む。
//
// rules: 13-keywords.md §捜査X (「好きな順番でデッキの下に移す」), 26-qa-deck-refresh.md
import { test, expect } from '@playwright/test';
import { setupGamePage, buildGameState, getGameState } from './helpers';

test.describe('BUG-136 — deckToBottomBound 順序選択 modal (実機)', () => {
  test('modal 表示 → ▲ で並べ替え → 確定 → deck 底ブロックが選んだ順に', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await page.evaluate(() => {
      (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    });

    // self.deck = [D08001(rest), D08003, D08007, D08013] — 底ブロック (下 3 枚) を並べ替え対象にする。
    await buildGameState(page, (gs) => {
      const self = (gs as unknown as { players: { self: { deck: string[] } } }).players.self;
      self.deck = ['D08001', 'D08003', 'D08007', 'D08013'];
      (gs as unknown as { turn: { number: number; player: string; phase: string; isFirstPlayerFirstTurn: boolean } }).turn =
        { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    });

    // pendingDeckReorder を set (engine が human 所有 & 2 枚以上で set するのと同値、unit test 済)。
    await page.evaluate(() => {
      const w = window as unknown as { __game: { getState: () => { setPendingDeckReorder: (p: unknown) => void } } };
      w.__game.getState().setPendingDeckReorder({ player: 'self', cardIds: ['D08003', 'D08007', 'D08013'] });
    });

    const modal = page.locator('[data-testid="deck-reorder-modal"]');
    await expect(modal).toBeVisible();
    const panelBox = await modal.locator('.souza-modal').boundingBox();
    const viewport = page.viewportSize();
    expect(panelBox).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect(panelBox!.x).toBeGreaterThanOrEqual(0);
    expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(viewport!.width);

    // 初期 order = [D08003(0), D08007(1), D08013(2)]。
    // row2 を ▲ で 1 つ上へ → [D08003, D08013, D08007]、row1 を ▲ で 1 つ上へ → [D08013, D08003, D08007]。
    await page.locator('[data-testid="deck-reorder-up-2"]').click();
    await page.locator('[data-testid="deck-reorder-up-1"]').click();
    await page.locator('[data-testid="deck-reorder-confirm-btn"]').click();

    // modal が閉じる
    await expect(modal).toHaveCount(0);

    // deck 底ブロックが [D08013, D08003, D08007] に並べ替わっている (rest=D08001 は不変)。
    await page.waitForFunction(() => {
      const w = window as unknown as { __game: { getState: () => { gameState: { players: { self: { deck: string[] } } } } } };
      const deck = w.__game.getState().gameState.players.self.deck;
      return deck.length === 4 && deck[1] === 'D08013' && deck[2] === 'D08003' && deck[3] === 'D08007';
    });
    const gs = await getGameState(page);
    const deck = (gs as unknown as { players: { self: { deck: string[] } } }).players.self.deck;
    expect(deck).toEqual(['D08001', 'D08013', 'D08003', 'D08007']);

    // console error 0
    expect(errors).toEqual([]);
  });

  test('drag で並べ替え (HTML5 drag): row0 を row2 へ → 末尾へ移動', async ({ page }) => {
    await setupGamePage(page);
    await page.evaluate(() => {
      (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    });
    await buildGameState(page, (gs) => {
      const self = (gs as unknown as { players: { self: { deck: string[] } } }).players.self;
      self.deck = ['D08001', 'D08003', 'D08007', 'D08013'];
      (gs as unknown as { turn: { number: number; player: string; phase: string; isFirstPlayerFirstTurn: boolean } }).turn =
        { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    });
    await page.evaluate(() => {
      const w = window as unknown as { __game: { getState: () => { setPendingDeckReorder: (p: unknown) => void } } };
      w.__game.getState().setPendingDeckReorder({ player: 'self', cardIds: ['D08003', 'D08007', 'D08013'] });
    });

    await expect(page.locator('[data-testid="deck-reorder-modal"]')).toBeVisible();
    // row0 (D08003) を row2 (D08013) 位置へ drag → [D08007, D08013, D08003]
    await page.locator('[data-testid="deck-reorder-row-0"]').dragTo(page.locator('[data-testid="deck-reorder-row-2"]'));
    await page.locator('[data-testid="deck-reorder-confirm-btn"]').click();

    await page.waitForFunction(() => {
      const w = window as unknown as { __game: { getState: () => { gameState: { players: { self: { deck: string[] } } } } } };
      const deck = w.__game.getState().gameState.players.self.deck;
      return deck.length === 4 && deck[3] === 'D08003';
    });
    const gs = await getGameState(page);
    const deck = (gs as unknown as { players: { self: { deck: string[] } } }).players.self.deck;
    // D08003 が末尾 (最下) へ移動したことを確認 (drag が move() を呼んだ証拠)。
    expect(deck[3]).toBe('D08003');
    expect(deck[0]).toBe('D08001'); // rest 不変
  });
});
