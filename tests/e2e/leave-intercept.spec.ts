import { test, expect } from '@playwright/test';
import { setupGamePage, buildGameState } from './helpers';

test('leave intercept modal resolves a human decision', async ({ page }) => {
  const { errors } = await setupGamePage(page);
  await buildGameState(page, (gs) => { (gs as unknown as Record<string, unknown>).pendingEffects = []; });
  await page.evaluate(() => {
    const w = window as unknown as { __game: { store: { getState: () => { setPendingLeaveIntercept: (v: unknown) => void } } } };
    w.__game.store.getState().setPendingLeaveIntercept({ player: 'self', targetUid: 'target', interceptorUid: 'interceptor', actionId: 'ax' });
  });
  await expect(page.locator('[data-testid="leave-intercept-modal"]')).toBeVisible();
  await page.locator('[data-testid="leave-intercept-no"]').click();
  await expect(page.locator('[data-testid="leave-intercept-modal"]')).toBeHidden();
  expect(errors).toEqual([]);
});
