import { test, expect } from '@playwright/test';
import { buildGameState, setupGamePage } from './helpers';

test.describe('BUG-236 card detail modal priority', () => {
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
