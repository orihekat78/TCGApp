import { test, expect } from '@playwright/test';
import { buildGameState, setupGamePage } from './helpers';

test.describe('BUG-236 card detail modal priority', () => {
  test('a detail opened inside choose-intercept escapes its overlay and closes normally above the HUD', async ({ page }) => {
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
    await expect(hud).toBeVisible();
    await intercept.getByTestId('selectable-card-tile-detail').click();

    const detail = page.locator('.card-expand-modal-backdrop');
    await expect(detail).toBeVisible();
    expect(await detail.evaluate((element) => element.closest('.cp-overlay') === null)).toBe(true);
    const layers = await page.evaluate(() => ({
      cardDetail: Number.parseInt(getComputedStyle(document.querySelector('.card-expand-modal-backdrop')!).zIndex, 10),
      cpuHud: Number.parseInt(getComputedStyle(document.querySelector('[data-testid="spectator-hud"]')!).zIndex, 10),
    }));
    expect(layers.cardDetail).toBeGreaterThan(layers.cpuHud);

    await page.locator('.card-expand-close').click();
    await expect(detail).toHaveCount(0);
    await expect(intercept).toBeVisible();
    await intercept.getByTestId('choose-intercept-decline').click();
    await expect(intercept).toHaveCount(0);

    const pause = page.getByTestId('spectator-pause-toggle');
    await pause.click();
    await expect(pause).toHaveAttribute('aria-pressed', 'true');
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

  test('the detail close button is clickable above the CPU control HUD and returns control to the HUD', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await buildGameState(page, (gs) => {
      gs.log = [{ ts: 1, player: 'self', turn: 1, action: 'handUseCard', target: 'D08015' }];
    });

    await page.locator('.panel-log-btn').click();
    await page.locator('button[aria-label*="D08015"]').click();

    const modal = page.locator('.card-expand-modal-backdrop');
    const close = page.locator('.card-expand-close');
    const hud = page.getByTestId('spectator-hud');
    await expect(modal).toBeVisible();
    await expect(close).toBeVisible();
    await expect(hud).toBeVisible();

    const layers = await page.evaluate(() => ({
      cardDetail: Number.parseInt(getComputedStyle(document.querySelector('.card-expand-modal-backdrop')!).zIndex, 10),
      cpuHud: Number.parseInt(getComputedStyle(document.querySelector('[data-testid="spectator-hud"]')!).zIndex, 10),
    }));
    expect(layers.cardDetail, 'card detail must be above the CPU control HUD').toBeGreaterThan(layers.cpuHud);

    await close.click();
    await expect(modal).toHaveCount(0);

    const pause = page.getByTestId('spectator-pause-toggle');
    await expect(pause).toBeEnabled();
    await pause.click();
    await expect(pause).toHaveAttribute('aria-pressed', 'true');
    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('detail modal still closes by backdrop and Escape', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await buildGameState(page, (gs) => {
      gs.log = [{ ts: 1, player: 'self', turn: 1, action: 'handUseCard', target: 'D08015' }];
    });

    await page.locator('.panel-log-btn').click();
    await page.locator('button[aria-label*="D08015"]').click();
    const modal = page.locator('.card-expand-modal-backdrop');
    await expect(modal).toBeVisible();
    await modal.click({ position: { x: 4, y: 4 } });
    await expect(modal).toHaveCount(0);

    await page.locator('button[aria-label*="D08015"]').click();
    await expect(modal).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(modal).toHaveCount(0);
    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
  });
});
