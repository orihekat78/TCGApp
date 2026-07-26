import { expect, test, type Page } from '@playwright/test';
import { buildGameState, expectNoConsoleErrors, getGameState, setupGamePage } from './helpers';

/**
 * A face-up evidence source makes the declared-source choice use the common
 * selection modal.  The two equal B06103 copies then prove that the modal
 * preserves a hand occurrence UID instead of degrading it to a card ID.
 */
async function primeHuman(page: Page): Promise<void> {
  await page.evaluate(() => {
    (globalThis as { __humanPlayerSide?: 'self' }).__humanPlayerSide = 'self';
    const store = (window as unknown as {
      __game: { store: { getState: () => { setSpectatorMode: (value: boolean) => void; setAiPaused: (value: boolean) => void } } };
    }).__game.store.getState();
    store.setSpectatorMode(false);
    store.setAiPaused(true);
  });
}

async function fixture(page: Page): Promise<void> {
  await buildGameState(page, (state) => {
    const base = state.players.self.scene[0]!;
    // B06103's on-hand declared ability removes a same-colour character as
    // its cost, then enters the selected hand occurrence asleep.
    state.players.self.scene = [{
      ...base,
      uid: 'declared-cost-host',
      cardId: 'B06103',
      state: 'active',
      declaredUseCount: {},
    }];
    state.players.self.hand = ['B06103', 'B06103'];
    // B10094 is deliberately legal but unselected. Its public source opens
    // the shared source modal so hand occurrences are rendered there too.
    state.players.self.evidence = [{ cardId: 'B10094', faceUp: true, origin: 'action' }];
    state.players.opp.partnerAreaCards = ['B10095'];
    // Escapes keep this browser-evaluated fixture independent of shell encoding.
    state.players.self.case.status = '\u89e3\u6c7a\u7de8';
    state.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as never;
  });
}

test('declared-source modal keeps duplicate legal hand occurrences distinct and resolves the selected second copy', async ({ page }) => {
  if (test.info().project.name === 'mobile-chromium') {
    await page.setViewportSize({ width: 851, height: 393 });
  }
  const { errors } = await setupGamePage(page);
  await primeHuman(page);
  await fixture(page);

  await page.locator('[data-action-id="declared-ability"]').click();
  const sourceModal = page.locator('.card-list-modal');
  await expect(sourceModal).toBeVisible();
  await expect(sourceModal.getByTestId('card-list-pick-hand:self:0')).toBeVisible();
  await expect(sourceModal.getByTestId('card-list-pick-hand:self:1')).toBeVisible();
  await expect(sourceModal.getByTestId('card-list-pick-evidence:self:0')).toBeVisible();

  await sourceModal.getByTestId('card-list-pick-hand:self:1').click();
  await expect(page.locator('.confirm-modal')).toBeVisible();
  await page.locator('.confirm-ok').click();

  // B06103 has exactly one legal cost target, so the normal declared flow
  // pays it deterministically after the confirmation.
  await page.waitForFunction(() => {
    const w = window as unknown as { __game: { getState: () => { gameState: { players: { self: { hand: string[] } } } } } };
    return w.__game.getState().gameState.players.self.hand.length === 1;
  });

  const state = await getGameState(page) as unknown as {
    players: { self: { hand: string[]; scene: Array<{ cardId: string; state: string }>; remove: string[] } };
    log: Array<{ action: string; target?: string }>;
  };
  // The second occurrence survives all UI hand-off points into the engine.
  expect(state.log).toContainEqual(expect.objectContaining({
    action: 'declaredAbility',
    target: 'hand:self:1:a1',
  }));
  expect(state.players.self.hand).toEqual(['B06103']);
  expect(state.players.self.remove).toContain('B06103');
  expect(state.players.self.scene).toEqual([
    expect.objectContaining({ cardId: 'B06103', state: 'sleep' }),
  ]);
  expectNoConsoleErrors(errors);
});
