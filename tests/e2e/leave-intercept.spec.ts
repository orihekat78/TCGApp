import { test, expect } from '@playwright/test';
import { setupGamePage, buildGameState } from './helpers';

test('leave intercept modal resolves a human decision', async ({ page }) => {
  const { errors } = await setupGamePage(page);
  await buildGameState(page, (gs) => {
    (gs as unknown as Record<string, unknown>).pendingEffects = [];
    gs.players.self.scene[0]!.uid = 'interceptor';
    gs.players.self.scene[1]!.uid = 'target';
  });
  await page.evaluate(() => {
    const w = window as unknown as { __game: { store: { getState: () => { setPendingLeaveIntercept: (v: unknown) => void } } } };
    w.__game.store.getState().setPendingLeaveIntercept({ player: 'self', targetUid: 'target', interceptorUid: 'interceptor', actionId: 'ax' });
  });
  await expect(page.locator('[data-testid="leave-intercept-modal"]')).toBeVisible();
  const interceptor = page.locator('[data-testid="leave-intercept-card-interceptor"]');
  const targetDetail = page.locator('[data-testid="leave-intercept-card-detail-target"]');
  await expect(interceptor.locator('img.card-art')).toBeVisible();
  await expect(targetDetail).toBeVisible();
  await targetDetail.click();
  await expect(page.locator('.card-expand-close')).toBeVisible();
  await page.locator('.card-expand-close').click();
  await expect(page.locator('[data-testid="leave-intercept-modal"]')).toBeVisible();
  await interceptor.click({ button: 'right' });
  await expect(page.locator('.card-expand-close')).toBeVisible();
  await page.locator('.card-expand-close').click();
  await page.locator('[data-testid="leave-intercept-no"]').click();
  await expect(page.locator('[data-testid="leave-intercept-modal"]')).toBeHidden();
  expect(errors).toEqual([]);
});
