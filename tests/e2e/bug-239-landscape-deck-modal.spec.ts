import { test, expect } from '@playwright/test';
import { setupGamePage, buildGameState } from './helpers';

test.describe('BUG-239 landscape deck decisions', () => {
  test('keeps a long deck reorder decision inside the 851x393 viewport', async ({ page }) => {
    test.skip(test.info().project.use.isMobile !== true, 'mobile landscape regression only');
    const { errors } = await setupGamePage(page);
    await page.evaluate(() => {
      (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    });
    await buildGameState(page, (gs) => {
      const self = (gs as unknown as { players: { self: { deck: string[] } } }).players.self;
      self.deck = ['D08020', 'D08003', 'D08007', 'D08013', 'D08001', 'D08003', 'D08007', 'D08013', 'D08001'];
      (gs as unknown as { turn: { number: number; player: string; phase: string; isFirstPlayerFirstTurn: boolean } }).turn =
        { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    });
    await page.evaluate((cardIds) => {
      const w = window as unknown as { __game: { getState: () => { setPendingDeckReorder: (p: unknown) => void } } };
      w.__game.getState().setPendingDeckReorder({ player: 'self', cardIds });
    }, ['D08003', 'D08007', 'D08013', 'D08001', 'D08003', 'D08007', 'D08013', 'D08001']);

    const modal = page.getByTestId('deck-reorder-modal');
    const panel = modal.locator('.souza-modal');
    const body = modal.locator('.souza-body');
    await expect(modal).toBeVisible();
    await expect(page.getByTestId('deck-reorder-row-0')).toBeVisible();
    await expect(page.getByTestId('deck-reorder-confirm-btn')).toBeVisible();

    const geometry = await panel.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, viewportHeight: window.innerHeight };
    });
    expect(geometry.top).toBeGreaterThanOrEqual(0);
    expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewportHeight);
    expect(await body.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);

    await page.getByTestId('deck-reorder-row-0').getByTestId('selectable-card-tile-detail').click();
    await expect(page.locator('.card-expand-modal')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.card-expand-modal')).toHaveCount(0);

    await page.getByTestId('deck-reorder-down-0').click();
    await body.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    await expect(page.getByTestId('deck-reorder-confirm-btn')).toBeVisible();
    await page.getByTestId('deck-reorder-confirm-btn').click();
    await expect(modal).toHaveCount(0);
    expect(errors, 'console error 0').toEqual([]);
  });
});
