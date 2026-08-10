import { test, expect } from '@playwright/test';
import { setupGamePage } from './helpers/setup.js';

test.describe('CPU controls after removing the fixed HUD', () => {
  test('landscape spectator keeps the removed CPU controls absent', async ({ page }) => {
    await page.setViewportSize({ width: 851, height: 393 });
    const { errors } = await setupGamePage(page);
    await page.locator('[data-testid="game-setup-spectate"]').click();
    const skip = page.locator('button.mulligan-skip');
    await expect(skip).toBeVisible();
    await skip.click();

    await expect(page.locator('#scaler')).toHaveAttribute('data-playmat-layout', 'desktop');
    await expect(page.locator('#scaler')).toHaveAttribute('data-playmat-fit', 'contained-landscape');
    await expect(page.locator('[data-testid="spectator-hud"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="mobile-ai-pause"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="mobile-ai-step"]')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('desktop match has no fixed CPU HUD', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const { errors } = await setupGamePage(page);
    await page.locator('[data-testid="game-setup-start"]').click();
    const skip = page.locator('button.mulligan-skip');
    await expect(skip).toBeVisible();
    await skip.click();

    await expect(page.locator('#scaler')).toHaveAttribute('data-playmat-layout', 'desktop');
    await expect(page.locator('[data-testid="spectator-hud"]')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});
