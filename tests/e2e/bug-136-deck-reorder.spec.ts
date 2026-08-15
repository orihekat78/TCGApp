// E2E regression: BUG-136 — deckToBottomBound「残りを好きな順番でデッキの下に移す」順序選択 modal
//
// 実機 UI 経路 (modal 表示 → 並べ替え操作 → 確定 → deck 底ブロック再配置) を検証する。
// engine 側の実カード/resolver ownership は user-bug-wave-ui.spec.ts の B04026 公開経路でカバー。
// 本 spec は engine-owned authority を使い、UI → dispatch → engine の並べ替え操作と重複occurrenceを
// 独立して実機検証する。
//
// rules: 13-keywords.md §捜査X (「好きな順番でデッキの下に移す」), 26-qa-deck-refresh.md
import { test, expect } from '@playwright/test';
import {
  setupGamePage,
  buildGameState,
  getGameState,
  surfaceDeckReorderDecision,
} from './helpers';

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

    await surfaceDeckReorderDecision(page, ['D08003', 'D08007', 'D08013']);

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
    const { errors } = await setupGamePage(page);
    await page.evaluate(() => {
      (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    });
    await buildGameState(page, (gs) => {
      const self = (gs as unknown as { players: { self: { deck: string[] } } }).players.self;
      self.deck = ['D08001', 'D08003', 'D08013', 'D08007', 'D08003'];
      (gs as unknown as { turn: { number: number; player: string; phase: string; isFirstPlayerFirstTurn: boolean } }).turn =
        { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    });
    await surfaceDeckReorderDecision(page, ['D08003', 'D08007', 'D08003']);

    await expect(page.locator('[data-testid="deck-reorder-modal"]')).toBeVisible();
    const rows = page.locator('[data-testid^="deck-reorder-row-"]');
    const instanceOrder = async (): Promise<string[]> => rows.locator('[data-instance-id]').evaluateAll(
      (nodes) => nodes.map((node) => node.getAttribute('data-instance-id') ?? ''),
    );
    expect(await instanceOrder()).toEqual(['D08003#0', 'D08007#1', 'D08003#2']);
    // 非連続occurrenceの先頭D08003を末尾へ。もう1枚のD08003と区別して並べ替える。
    test.skip(test.info().project.use.isMobile === true,
      'HTML5 drag is a desktop-only enhancement; the mobile landscape path is covered by the 44px arrow controls below.');
    await page.locator('[data-testid="deck-reorder-row-0"]').dragTo(page.locator('[data-testid="deck-reorder-row-2"]'));
    expect(await instanceOrder()).toEqual(['D08007#1', 'D08003#2', 'D08003#0']);
    await page.locator('[data-testid="deck-reorder-confirm-btn"]').click();

    await page.waitForFunction(() => {
      const w = window as unknown as { __game: { getState: () => { gameState: { players: { self: { deck: string[] } } } } } };
      const deck = w.__game.getState().gameState.players.self.deck;
      return deck.length === 5 && deck[2] === 'D08007' && deck[4] === 'D08003';
    });
    const gs = await getGameState(page);
    const deck = (gs as unknown as { players: { self: { deck: string[] } } }).players.self.deck;
    expect(deck).toEqual(['D08001', 'D08013', 'D08007', 'D08003', 'D08003']);
    expect(errors).toEqual([]);
  });
});
