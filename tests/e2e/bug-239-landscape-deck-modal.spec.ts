import { test, expect } from '@playwright/test';
import {
  setupGamePage,
  buildGameState,
  getGameState,
  surfaceDeckPlaceDecision,
  surfaceDeckReorderDecision,
} from './helpers';

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
    await surfaceDeckReorderDecision(
      page,
      ['D08003', 'D08007', 'D08013', 'D08001', 'D08003', 'D08007', 'D08013', 'D08001'],
    );

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

    await page.getByTestId('deck-reorder-down-0').click();
    const expectedOccurrenceOrder = [
      'D08007#1', 'D08003#0', 'D08013#2', 'D08001#3',
      'D08003#4', 'D08007#5', 'D08001#7', 'D08013#6',
    ];
    expect(await modal.locator('[data-instance-id]').evaluateAll((tiles) => tiles.map((tile) => tile.getAttribute('data-instance-id'))))
      .toEqual(['D08007#1', 'D08003#0', 'D08013#2', 'D08001#3', 'D08003#4', 'D08007#5', 'D08013#6', 'D08001#7']);

    await page.getByTestId('deck-reorder-row-0').getByTestId('selectable-card-tile-detail').click();
    await expect(page.locator('.card-expand-modal')).toBeVisible();
    await page.locator('.card-expand-close').click();
    await expect(page.locator('.card-expand-modal')).toHaveCount(0);

    await body.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    await expect(page.getByTestId('deck-reorder-row-7')).toBeVisible();
    await expect(page.getByTestId('deck-reorder-up-7')).toBeVisible();
    await page.getByTestId('deck-reorder-up-7').click();
    await page.getByTestId('deck-reorder-row-7').getByTestId('selectable-card-tile-detail').click();
    await expect(page.locator('.card-expand-modal')).toBeVisible();
    await page.locator('.card-expand-close').click();
    await expect(page.locator('.card-expand-modal')).toHaveCount(0);
    expect(await modal.locator('[data-instance-id]').evaluateAll((tiles) => tiles.map((tile) => tile.getAttribute('data-instance-id'))))
      .toEqual(expectedOccurrenceOrder);
    await expect(page.getByTestId('deck-reorder-confirm-btn')).toBeVisible();
    await page.getByTestId('deck-reorder-confirm-btn').click();
    await expect(modal).toHaveCount(0);
    expect((await getGameState(page)).players.self.deck).toEqual([
      'D08020', 'D08007', 'D08003', 'D08013', 'D08001',
      'D08003', 'D08007', 'D08001', 'D08013',
    ]);
    expect(errors, 'console error 0').toEqual([]);
  });

  test('keeps a long deck placement decision inside the 851x393 viewport', async ({ page }) => {
    test.skip(test.info().project.use.isMobile !== true, 'mobile landscape regression only');
    const { errors } = await setupGamePage(page);
    await page.evaluate(() => {
      (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    });
    const cardIds = ['D08003', 'D08007', 'D08013', 'D08001', 'D08003', 'D08007', 'D08013', 'D08001'];
    await buildGameState(page, (gs) => {
      const self = (gs as unknown as { players: { self: { deck: string[] } } }).players.self;
      self.deck = ['D08020', 'D08003', 'D08007', 'D08013', 'D08001', 'D08003', 'D08007', 'D08013', 'D08001'];
      (gs as unknown as { turn: { number: number; player: string; phase: string; isFirstPlayerFirstTurn: boolean } }).turn =
        { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    });
    await surfaceDeckPlaceDecision(page, cardIds);

    const modal = page.getByTestId('deck-place-modal');
    const panel = modal.locator('.souza-modal');
    const body = modal.locator('.souza-body');
    await expect(modal).toBeVisible();
    const geometry = await panel.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, viewportHeight: window.innerHeight };
    });
    expect(geometry.top).toBeGreaterThanOrEqual(0);
    expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewportHeight);
    expect(await body.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);

    await page.getByTestId('deck-place-bottom-0').click();
    await page.getByTestId('deck-place-down-0').click();
    await page.getByTestId('deck-place-row-0').getByTestId('selectable-card-tile-detail').click();
    await expect(page.locator('.card-expand-modal')).toBeVisible();
    await page.locator('.card-expand-close').click();
    await expect(page.locator('.card-expand-modal')).toHaveCount(0);

    await body.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    await expect(page.getByTestId('deck-place-row-7')).toBeVisible();
    await expect(page.getByTestId('deck-place-bottom-7')).toBeVisible();
    await page.getByTestId('deck-place-bottom-7').click();
    await page.getByTestId('deck-place-row-7').getByTestId('selectable-card-tile-detail').click();
    await expect(page.locator('.card-expand-modal')).toBeVisible();
    await page.locator('.card-expand-close').click();
    await expect(page.locator('.card-expand-modal')).toHaveCount(0);
    expect(await modal.locator('[data-instance-id]').evaluateAll((tiles) => tiles.map((tile) => tile.getAttribute('data-instance-id'))))
      .toEqual(['D08007#1', 'D08003#0', 'D08013#2', 'D08001#3', 'D08003#4', 'D08007#5', 'D08013#6', 'D08001#7']);
    const finalControl = await page.getByTestId('deck-place-bottom-7').boundingBox();
    const confirm = await page.getByTestId('deck-place-confirm-btn').boundingBox();
    expect(finalControl?.width).toBeGreaterThanOrEqual(44);
    expect(finalControl?.height).toBeGreaterThanOrEqual(44);
    expect(confirm?.width).toBeGreaterThanOrEqual(44);
    expect(confirm?.height).toBeGreaterThanOrEqual(44);

    await page.getByTestId('deck-place-confirm-btn').click();
    await expect(modal).toHaveCount(0);
    expect((await getGameState(page)).players.self.deck).toEqual([
      'D08007', 'D08013', 'D08001', 'D08003', 'D08007', 'D08013',
      'D08020', 'D08003', 'D08001',
    ]);
    expect(errors, 'console error 0').toEqual([]);
  });
});
