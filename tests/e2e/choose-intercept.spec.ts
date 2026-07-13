import { test, expect } from '@playwright/test';
import { setupGamePage, expectNoConsoleErrors } from './helpers';

test('choose-intercept modal renders and resolves a hand occurrence', async ({ page }) => {
  const { errors } = await setupGamePage(page);
  await page.evaluate(() => {
    const w = window as unknown as { __game: { createSampleGameState: () => unknown; store: { getState: () => { setGameState: (s: unknown) => void; setPendingChooseIntercept: (v: unknown) => void } } } };
    const state = w.__game.createSampleGameState() as { players: { self: { hand: string[] } } };
    state.players.self.hand = ['B04003'];
    const store = w.__game.store.getState();
    store.setGameState(state);
    store.setPendingChooseIntercept({ player: 'self', protector: { uid: 'p', cardId: 'B04003', abilityId: 'a1' }, targetUid: 't' });
  });
  await expect(page.getByTestId('choose-intercept-modal')).toBeVisible();
  await page.getByTestId('choose-intercept-discard-0').click();
  await expect(page.getByTestId('choose-intercept-modal')).toBeHidden();
  expectNoConsoleErrors(errors);
});
