import { test, expect } from '@playwright/test';
import { setupGamePage, buildGameState } from './helpers';

test('set-card replacement modal offers valid destinations and decline', async ({ page }) => {
  const { errors } = await setupGamePage(page);
  await buildGameState(page, (gs) => { (gs as unknown as Record<string, unknown>).pendingEffects = []; });
  await page.evaluate(() => {
    const w = window as unknown as { __game: { store: { getState: () => { setPendingSetCardReplacement: (v: unknown) => void } } } };
    w.__game.store.getState().setPendingSetCardReplacement({
      player: 'self', fromUid: 'host', setCardInstanceId: 'set:1',
      candidates: [{ uid: 'target', cardId: 'D08001' }], source: { cardId: 'B02052', abilityId: 'a3', uid: 'host' },
    });
  });
  await expect(page.locator('[data-testid="set-card-replacement-modal"]')).toBeVisible();
  await expect(page.locator('[data-testid="set-card-replacement-decline"]')).toBeVisible();
  await page.locator('[data-testid="set-card-replacement-decline"]').click();
  await expect(page.locator('[data-testid="set-card-replacement-modal"]')).toBeHidden();
  expect(errors).toEqual([]);
});

test('set-card replacement candidate selector resolves the chosen uid', async ({ page }) => {
  const { errors } = await setupGamePage(page);
  await buildGameState(page, (gs) => { (gs as unknown as Record<string, unknown>).pendingEffects = []; });
  await page.evaluate(() => {
    const w = window as unknown as { __game: { store: { getState: () => { setPendingSetCardReplacement: (v: unknown) => void } } } };
    w.__game.store.getState().setPendingSetCardReplacement({
      player: 'self', fromUid: 'host', setCardInstanceId: 'set:1',
      candidates: [{ uid: 'target', cardId: 'D08001' }], source: { cardId: 'B02052', abilityId: 'a3', uid: 'host' },
    });
  });
  const candidate = page.getByTestId('set-card-replacement-target');
  await expect(candidate).toBeVisible();
  await candidate.click();
  await expect(page.getByTestId('set-card-replacement-modal')).toBeHidden();
  expect(errors).toEqual([]);
});
