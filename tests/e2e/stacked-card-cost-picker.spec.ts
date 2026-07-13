import { test, expect, type Page } from '@playwright/test';
import { buildGameState, expectNoConsoleErrors, getGameState, setupGamePage, type GameStateLike } from './helpers';

async function setHumanSelf(page: Page): Promise<void> {
  await page.evaluate(() => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  });
}

function applyFixture(state: GameStateLike): void {
  const self = state.players.self as unknown as {
    partner: { cardId: string; state: string; location: string };
    scene: unknown[];
    hand: string[];
  };
  self.partner.cardId = 'D08001';
  self.partner.state = 'active';
  self.partner.location = 'partner-area';
  self.hand = [];
  self.scene = [{
    uid: 'agasa', cardId: 'B08003', state: 'active', isNamed: false, enterOrder: 1,
    setCards: [], stackedCards: [
      { cardId: 'B08003', instanceId: 'stack:agasa:a' },
      { cardId: 'B08003', instanceId: 'stack:agasa:b' },
      { cardId: 'B08003', instanceId: 'stack:agasa:c' },
      { cardId: 'B08003', instanceId: 'stack:agasa:d' },
    ], keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {},
  }];
  (state as unknown as { turn: { number: number; player: string; phase: string; isFirstPlayerFirstTurn: boolean } }).turn = {
    number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false,
  };
  (state as unknown as { pendingEffects: unknown[] }).pendingEffects = [];
}

test('B08003 human stacked cost picks non-first exact identities', async ({ page }) => {
  const { errors } = await setupGamePage(page);
  await setHumanSelf(page);
  await buildGameState(page, applyFixture);

  await page.locator('[data-action-id="declared-ability"]').click();
  await page.locator('[data-uid="agasa"]').click();
  await page.locator('.confirm-ok').click();

  await page.locator('[data-testid="card-list-pick-stack:agasa:b"]').click();
  await page.locator('[data-testid="card-list-pick-stack:agasa:c"]').click();
  await page.locator('[data-testid="card-list-pick-stack:agasa:d"]').click();
  await page.locator('[data-testid="card-list-pick-confirm"]').click();

  await page.waitForFunction(() => {
    const game = (window as unknown as {
      __game: { getState: () => { gameState: { players: { self: { scene: Array<{ uid: string; stackedCards: unknown[]; state: string }> } } } } };
    }).__game.getState().gameState;
    const source = game.players.self.scene.find((char) => char.uid === 'agasa');
    return source?.state === 'sleep' && source.stackedCards.length === 1;
  });
  const after = await getGameState(page);
  const source = (after.players.self as unknown as { scene: { uid: string; stackedCards: { instanceId: string }[] }[] })
    .scene.find((char) => char.uid === 'agasa')!;
  expect(source.stackedCards.map((card) => card.instanceId)).toEqual(['stack:agasa:a']);
  expectNoConsoleErrors(errors);
});

test('B08003 stacked cost cancel leaves the host unchanged', async ({ page }) => {
  const { errors } = await setupGamePage(page);
  await setHumanSelf(page);
  await buildGameState(page, applyFixture);

  await page.locator('[data-action-id="declared-ability"]').click();
  await page.locator('[data-uid="agasa"]').click();
  await page.locator('.confirm-ok').click();
  await page.locator('.card-list-modal-close').click();

  await page.waitForFunction(() => {
    const game = (window as unknown as {
      __game: { getState: () => { gameState: { players: { self: { scene: Array<{ uid: string; stackedCards: unknown[]; state: string }> } } } } };
    }).__game.getState().gameState;
    const source = game.players.self.scene.find((char) => char.uid === 'agasa');
    return source?.state === 'active' && source.stackedCards.length === 4;
  });
  expectNoConsoleErrors(errors);
});
