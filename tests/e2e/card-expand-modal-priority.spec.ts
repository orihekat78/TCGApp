import { test, expect } from '@playwright/test';
import {
  buildGameState,
  setupGamePage,
  surfaceDeckPlaceDecision,
  surfaceDeckReorderDecision,
} from './helpers';

test.describe('BUG-236 card detail modal priority', () => {
  test('deck reorder detail is explicitly above its decision and preserves the chosen order', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await buildGameState(page, (gs) => {
      gs.players.self.deck = ['D08001', 'D08003', 'D08007', 'D08013'];
    });
    await surfaceDeckReorderDecision(page, ['D08003', 'D08007', 'D08013']);

    const decision = page.getByTestId('deck-reorder-modal');
    await expect(decision).toBeVisible();
    await page.getByTestId('deck-reorder-up-2').click();
    const orderedInstances = async () => decision.locator('[data-instance-id]').evaluateAll(
      (nodes) => nodes.map((node) => node.getAttribute('data-instance-id')),
    );
    expect(await orderedInstances()).toEqual(['D08003#0', 'D08013#2', 'D08007#1']);

    await page.getByTestId('deck-reorder-row-1').getByTestId('selectable-card-tile-detail').click();
    const detail = page.locator('.card-expand-modal-backdrop');
    await expect(detail).toBeVisible();
    const layers = await page.evaluate(() => ({
      detail: Number.parseInt(getComputedStyle(document.querySelector('.card-expand-modal-backdrop')!).zIndex, 10),
      decision: Number.parseInt(getComputedStyle(document.querySelector('[data-testid="deck-reorder-modal"]')!).zIndex, 10),
    }));
    expect(layers.detail, 'card detail must explicitly outrank deck reorder').toBeGreaterThan(layers.decision);
    await page.locator('.card-expand-close').click();
    await expect(detail).toHaveCount(0);
    await expect(decision).toBeVisible();
    expect(await orderedInstances()).toEqual(['D08003#0', 'D08013#2', 'D08007#1']);
    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('deck place detail is explicitly above its decision and preserves bucket and row state', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await buildGameState(page, (gs) => {
      gs.players.self.deck = ['D08020', 'D08003', 'D08007', 'D08013'];
    });
    await surfaceDeckPlaceDecision(page, ['D08003', 'D08007', 'D08013']);

    const decision = page.getByTestId('deck-place-modal');
    await expect(decision).toBeVisible();
    await page.getByTestId('deck-place-bottom-0').click();
    await page.getByTestId('deck-place-down-0').click();
    const placedInstances = async () => decision.locator('[data-instance-id]').evaluateAll(
      (nodes) => nodes.map((node) => node.getAttribute('data-instance-id')),
    );
    expect(await placedInstances()).toEqual(['D08007#1', 'D08003#0', 'D08013#2']);
    await expect(page.getByTestId('deck-place-bottom-1')).toHaveAttribute('aria-pressed', 'true');

    await page.getByTestId('deck-place-row-1').getByTestId('selectable-card-tile-detail').click();
    const detail = page.locator('.card-expand-modal-backdrop');
    await expect(detail).toBeVisible();
    const layers = await page.evaluate(() => ({
      detail: Number.parseInt(getComputedStyle(document.querySelector('.card-expand-modal-backdrop')!).zIndex, 10),
      decision: Number.parseInt(getComputedStyle(document.querySelector('[data-testid="deck-place-modal"]')!).zIndex, 10),
    }));
    expect(layers.detail, 'card detail must explicitly outrank deck place').toBeGreaterThan(layers.decision);
    await page.locator('.card-expand-close').click();
    await expect(detail).toHaveCount(0);
    await expect(decision).toBeVisible();
    expect(await placedInstances()).toEqual(['D08007#1', 'D08003#0', 'D08013#2']);
    await expect(page.getByTestId('deck-place-bottom-1')).toHaveAttribute('aria-pressed', 'true');
    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('a detail opened inside choose-intercept escapes its overlay after the fixed HUD removal', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await buildGameState(page, (gs) => {
      gs.players.self.hand = ['D08015'];
    });
    await page.evaluate(() => {
      const game = (window as unknown as {
        __game: { store: { getState: () => { setPendingChooseIntercept: (pending: unknown) => void } } };
      }).__game;
      game.store.getState().setPendingChooseIntercept({
        player: 'self',
        protector: { uid: 'protector', cardId: 'B04003', abilityId: 'a1' },
        targetUid: 'target',
      });
    });

    const intercept = page.getByTestId('choose-intercept-modal');
    const hud = page.getByTestId('spectator-hud');
    await expect(intercept).toBeVisible();
    await expect(hud).toHaveCount(0);
    await intercept.getByTestId('selectable-card-tile-detail').click();

    const detail = page.locator('.card-expand-modal-backdrop');
    await expect(detail).toBeVisible();
    expect(await detail.evaluate((element) => element.closest('.cp-overlay') === null)).toBe(true);

    await page.locator('.card-expand-close').click();
    await expect(detail).toHaveCount(0);
    await expect(intercept).toBeVisible();
    await intercept.getByTestId('choose-intercept-decline').click();
    await expect(intercept).toHaveCount(0);
    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('an asynchronously appearing mandatory mulligan stays above an open card detail', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await buildGameState(page, (gs) => {
      gs.players.self.hand = ['D08015'];
    });
    await page.evaluate(() => {
      const game = (window as unknown as {
        __game: { store: { getState: () => { setPendingChooseIntercept: (pending: unknown) => void } } };
      }).__game;
      game.store.getState().setPendingChooseIntercept({
        player: 'self', protector: { uid: 'protector', cardId: 'B04003', abilityId: 'a1' }, targetUid: 'target',
      });
    });
    await page.getByTestId('choose-intercept-modal').getByTestId('selectable-card-tile-detail').click();
    const detail = page.locator('.card-expand-modal-backdrop');
    await expect(detail).toBeVisible();

    await page.evaluate(async () => {
      const loadMulligan = new Function('return import("/src/ui/hooks/useMulligan.ts")') as () => Promise<{
        useMulliganStore: { getState: () => { _setCurrent: (request: unknown) => void } };
      }>;
      const { useMulliganStore } = await loadMulligan();
      useMulliganStore.getState()._setCurrent({ player: 'self', hand: ['D08015'] });
    });

    const mulligan = page.locator('.mulligan-modal-backdrop');
    await expect(mulligan).toBeVisible();
    const layers = await page.evaluate(() => ({
      detail: Number.parseInt(getComputedStyle(document.querySelector('.card-expand-modal-backdrop')!).zIndex, 10),
      mulligan: Number.parseInt(getComputedStyle(document.querySelector('.mulligan-modal-backdrop')!).zIndex, 10),
    }));
    expect(layers.mulligan, 'mandatory progression must outrank optional card details').toBeGreaterThan(layers.detail);

    await mulligan.getByRole('button', { name: '引き直しなし' }).click();
    await expect(mulligan).toHaveCount(0);
    await expect(detail).toBeVisible();
    await page.locator('.card-expand-close').click();
    await page.getByTestId('choose-intercept-modal').getByTestId('choose-intercept-decline').click();
    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('the detail close button stays clickable after the fixed CPU HUD is removed', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await buildGameState(page, (gs) => {
      gs.players.self.hand = ['D08015'];
    });

    await page.locator('.hand-mini-card[data-card-id="D08015"]').click();
    await page.getByTestId('hand-card-magnifier-D08015').click();

    const modal = page.locator('.card-expand-modal-backdrop');
    const close = page.locator('.card-expand-close');
    const hud = page.getByTestId('spectator-hud');
    await expect(modal).toBeVisible();
    await expect(close).toBeVisible();
    await expect(hud).toHaveCount(0);

    await close.click();
    await expect(modal).toHaveCount(0);
    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('detail modal still closes by backdrop and Escape', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await buildGameState(page, (gs) => {
      gs.players.self.hand = ['D08015'];
    });

    await page.locator('.hand-mini-card[data-card-id="D08015"]').click();
    const magnifier = page.getByTestId('hand-card-magnifier-D08015');
    await expect(magnifier).toBeEnabled();
    await magnifier.focus();
    await expect(magnifier).toBeFocused();
    await page.keyboard.press('Enter');
    const modal = page.locator('.card-expand-modal-backdrop');
    await expect(modal).toBeVisible();
    await modal.click({ position: { x: 4, y: 4 } });
    await expect(modal).toHaveCount(0);

    await magnifier.click();
    await expect(modal).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(modal).toHaveCount(0);
    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
  });
});
