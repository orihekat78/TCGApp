import { test, expect } from '@playwright/test';
import { setupGamePage, buildGameState } from './helpers';

test('set-card choice modal keeps identities hidden and clears after selection', async ({ page }) => {
  const { errors } = await setupGamePage(page);
  await buildGameState(page, (gs) => {
    (gs as unknown as Record<string, unknown>).pendingEffects = [];
  });
  await page.evaluate(() => {
    const w = window as unknown as { __game: { store: { getState: () => { setPendingSetCardChoice: (v: unknown) => void } } } };
    w.__game.store.getState().setPendingSetCardChoice({
      player: 'self', hostUid: 'opaque-host',
      entries: [{ instanceId: 'set:1', ordinal: 1 }, { instanceId: 'set:2', ordinal: 2 }],
      source: { cardId: 'B02039', abilityId: 'a1', uid: 'yusaku' },
    });
  });
  await expect(page.locator('[data-testid="set-card-choice-modal"]')).toBeVisible();
  await expect(page.locator('[data-testid="set-card-choice-1"]')).toHaveText('Set card 1');
  await expect(page.locator('[data-testid="set-card-choice-modal"]')).not.toContainText('SECRET');
  await page.locator('[data-testid="set-card-choice-2"]').click();
  await expect(page.locator('[data-testid="set-card-choice-modal"]')).toBeHidden();
  expect(errors).toEqual([]);
});
