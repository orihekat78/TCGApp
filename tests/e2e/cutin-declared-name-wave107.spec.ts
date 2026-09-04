import { expect, test, type Page } from '@playwright/test';
import {
  buildGameState,
  dispatchAction,
  expectActorRemoved,
  expectNoConsoleErrors,
  getActiveActionId,
  setupGamePage,
  waitForActionEnd,
  waitForPhase,
  type GameStateLike,
} from './helpers';

const COMBINED_NAME = '松田陣平＆萩原研二';

function buildBoard(page: Page, mixed = false): Promise<void> {
  return buildGameState(page, (state: GameStateLike, hasDisguise: boolean) => {
    const actor = state.players.self.scene.find(card => card.uid === 'self-2');
    const target = state.players.opp.scene.find(card => card.uid === 'opp-2');
    if (!actor || !target) throw new Error('Wave107 contact fixture is incomplete');
    actor.cardId = 'B10065';
    actor.apOverride = 8000;
    actor.state = 'active';
    actor.isNamed = false;
    target.apOverride = 6000;
    for (const card of state.players.opp.scene) card.state = 'sleep';
    state.players.self.hand = hasDisguise ? ['B03129', 'B09052'] : ['B09052'];
    if (hasDisguise) {
      state.players.self.file = Array.from({ length: 6 }, () => ({
        type: 'card-back' as const,
        cardId: 'D08017',
      }));
    }
    state.players.opp.hand = [];
  }, mixed);
}

test('B09052 cut-in collects a combined registered name before resolving AP', async ({ page }) => {
  const { errors } = await setupGamePage(page);
  await buildBoard(page);
  await dispatchAction(page, { type: 'actionDeclareChar', byUid: 'self-2', targetUid: 'opp-2' });
  const actionId = await getActiveActionId(page);
  if (!actionId) throw new Error('Wave107 action was not created');

  await waitForPhase(page, 'action-2');
  const card = page.locator('.hand-card--pickable[data-card-id="B09052"]');
  await expect(card).toBeVisible({ timeout: 5000 });
  await card.click();

  const modal = page.getByTestId('declare-card-name-modal');
  await expect(modal).toBeVisible();
  await expect(modal.getByTestId('declare-card-name-prompt')).toContainText('い、いつの間に!?');
  await expect(modal.getByTestId('declare-card-name-prompt')).toContainText('AP＋1000');
  await expect(modal.getByTestId('declare-card-name-domain-guidance')).toContainText('登録済みのカード名');
  await modal.getByTestId('declare-card-name-input').fill(COMBINED_NAME);
  await modal.getByTestId('declare-card-name-confirm').click();

  await waitForActionEnd(page);
  await expectActorRemoved(page, 'opp-2', 'opp');
  expectNoConsoleErrors(errors);
});

test('B09052 cut-in name cancellation preserves the contact decision and hand', async ({ page }) => {
  const { errors } = await setupGamePage(page);
  await buildBoard(page);
  await dispatchAction(page, { type: 'actionDeclareChar', byUid: 'self-2', targetUid: 'opp-2' });
  await waitForPhase(page, 'action-2');
  const before = await page.evaluate(() => JSON.stringify((window as unknown as {
    __game: { getState: () => { gameState: unknown } };
  }).__game.getState().gameState));

  await page.locator('.hand-card--pickable[data-card-id="B09052"]').click();
  const modal = page.getByTestId('declare-card-name-modal');
  await expect(modal).toBeVisible();
  await modal.getByTestId('declare-card-name-cancel').click();

  await expect(modal).toBeHidden();
  await waitForPhase(page, 'action-2');
  await expect(page.locator('.hand-card--pickable[data-card-id="B09052"]')).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.stringify((window as unknown as {
    __game: { getState: () => { gameState: unknown } };
  }).__game.getState().gameState))).toBe(before);
  expectNoConsoleErrors(errors);
});

test('B09052 mixed cut-in/disguise picker also collects the registered name', async ({ page }) => {
  const { errors } = await setupGamePage(page);
  await buildBoard(page, true);
  await dispatchAction(page, { type: 'actionDeclareChar', byUid: 'self-2', targetUid: 'opp-2' });
  await expect(page.getByTestId('cid-cutin-card:self:hand:B09052#1')).toBeVisible({ timeout: 5000 });
  await page.getByTestId('cid-cutin-card:self:hand:B09052#1').click();

  const modal = page.getByTestId('declare-card-name-modal');
  await expect(modal).toBeVisible();
  await modal.getByTestId('declare-card-name-input').fill(COMBINED_NAME);
  await modal.getByTestId('declare-card-name-confirm').click();

  await waitForActionEnd(page);
  await expectActorRemoved(page, 'opp-2', 'opp');
  expectNoConsoleErrors(errors);
});

test('B09052 mixed picker Escape restores the same contact choice', async ({ page }) => {
  const { errors } = await setupGamePage(page);
  await buildBoard(page, true);
  await dispatchAction(page, { type: 'actionDeclareChar', byUid: 'self-2', targetUid: 'opp-2' });
  const cutin = page.getByTestId('cid-cutin-card:self:hand:B09052#1');
  await expect(cutin).toBeVisible({ timeout: 5000 });
  const before = await page.evaluate(() => JSON.stringify((window as unknown as {
    __game: { getState: () => { gameState: unknown } };
  }).__game.getState().gameState));
  await cutin.click();

  const modal = page.getByTestId('declare-card-name-modal');
  await expect(modal).toBeVisible();
  await expect(modal.getByTestId('declare-card-name-input')).toBeFocused();
  await page.keyboard.press('Escape');

  await expect(modal).toBeHidden();
  await expect(page.getByTestId('cid-picker-modal')).toBeVisible();
  const restoredCutin = page.getByTestId('cid-cutin-card:self:hand:B09052#1');
  await expect(restoredCutin).toBeVisible();
  await expect(restoredCutin).toBeFocused();
  await expect.poll(() => page.evaluate(() => JSON.stringify((window as unknown as {
    __game: { getState: () => { gameState: unknown } };
  }).__game.getState().gameState))).toBe(before);
  expectNoConsoleErrors(errors);
});

test('terminal reset while B09052 name is pending cannot dispatch stale contact state', async ({ page }) => {
  const { errors } = await setupGamePage(page);
  await buildBoard(page);
  await dispatchAction(page, { type: 'actionDeclareChar', byUid: 'self-2', targetUid: 'opp-2' });
  await waitForPhase(page, 'action-2');
  await page.locator('.hand-card--pickable[data-card-id="B09052"]').click();
  const modal = page.getByTestId('declare-card-name-modal');
  await expect(modal).toBeVisible();

  await page.evaluate(async () => {
    const { resetMatchSession } = await (window as unknown as {
      __game: { testApi: Promise<{ resetMatchSession: () => void }> };
    }).__game.testApi;
    resetMatchSession();
  });

  await expect(modal).toBeHidden();
  await expect.poll(() => page.evaluate(() => {
    const state = (window as unknown as {
      __game: { getState: () => { gameState: unknown; activeActionId: string | null } };
    }).__game.getState();
    return { gameState: state.gameState, activeActionId: state.activeActionId };
  })).toEqual({ gameState: null, activeActionId: null });
  expectNoConsoleErrors(errors);
});
