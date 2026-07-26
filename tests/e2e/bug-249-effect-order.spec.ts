import { expect, test, type Page } from '@playwright/test';
import {
  buildGameState,
  dispatchAction,
  expectNoConsoleErrors,
  getGameState,
  setupGamePage,
  waitForActionEnd,
  waitForPhase,
  type GameStateLike,
} from './helpers';

type AnyState = Record<string, unknown>;

async function primeHumanAction(page: Page): Promise<void> {
  await page.evaluate(() => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const store = (window as unknown as {
      __game: { store: { getState: () => { setSpectatorMode: (value: boolean) => void; setAiPaused: (value: boolean) => void } } };
    }).__game.store.getState();
    store.setSpectatorMode(false);
    store.setAiPaused(true);
  });
}

/**
 * This is only a legal board setup.  The effect entries under test must come
 * from the public action declaration below; no pending effect is injected.
 */
function applyB03006Board(state: GameStateLike): void {
  const game = state as unknown as AnyState;
  const players = game.players as { self: AnyState; opp: AnyState };
  const character = (cardId: string, uid: string, state = 'active', stackedCards = 0) => ({
    cardId,
    uid,
    state,
    isNamed: false,
    enterOrder: 1,
    setCards: [],
    stackedCards,
    keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null,
    lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false },
    declaredUseCount: {},
  });

  players.self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
  players.self.scene = [character('B03006', 'team', 'active', 5)];
  players.self.hand = [];
  // Keep reserve cards: both real effects consume a card, and normal engine
  // processing must not end the match through the independent deck-out rule.
  players.self.deck = ['D08003', 'D08004', 'D08005', 'D08006'];
  players.self.evidence = [];
  players.self.remove = [];
  players.opp.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
  players.opp.scene = [character('B03006', 'target', 'sleep')];
  players.opp.hand = [];
  players.opp.deck = [];
  players.opp.evidence = [];
  players.opp.remove = [];
  game.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
}

test('BUG-249: B03006 public action declaration opens owner order, then guard/contact only after stable confirm', async ({ page }) => {
  const { errors } = await setupGamePage(page);
  await primeHumanAction(page);
  await buildGameState(page, applyB03006Board);

  // The public UI dispatch creates both a3/a4 from B03006's actual action:declare hook.
  expect(await dispatchAction(page, { type: 'actionDeclareChar', byUid: 'team', targetUid: 'target' })).toEqual({ ok: true });
  await waitForPhase(page, 'guard-window');

  const panel = page.locator('.effect-stack-panel.open');
  await expect(panel).toBeVisible();
  await expect(panel.locator('.effect-stack-entry')).toHaveCount(2);
  await expect(panel.locator('.entry-ability')).toHaveText(['a3', 'a4']);

  // The action flow is held in its guard window until the effect owner decides.
  await expect(page.getByTestId('cid-picker-modal')).toBeHidden();

  // Avoid the snapshot-derived test id.  These are the visible owner controls.
  await panel.locator('.effect-stack-entry').first().locator('button.reorder-btn').last().click();
  await panel.locator('button.effect-stack-confirm').click();

  // Opponent has no guard candidate. Its real guard/contact pass leaves the
  // human contact window ready for the public action API.
  await waitForPhase(page, 'action-2');
  const afterOrder = await getGameState(page);
  expect((afterOrder as unknown as { pendingEffects: Array<{ state: string; source: { abilityId?: string } }> }).pendingEffects)
    .toEqual(expect.arrayContaining([
      expect.objectContaining({ state: 'resolved', source: expect.objectContaining({ abilityId: 'a3' }) }),
      expect.objectContaining({ state: 'resolved', source: expect.objectContaining({ abilityId: 'a4' }) }),
    ]));
  expect((afterOrder.players.self as unknown as { evidence: Array<{ cardId: string }>; hand: string[] }).evidence.map((card) => card.cardId))
    .toEqual(['D08003']);
  expect((afterOrder.players.self as unknown as { hand: string[] }).hand).toEqual(['D08004']);

  const actionId = await page.evaluate(() => (window as unknown as {
    __game: { getState: () => { activeActionId: string | null } };
  }).__game.getState().activeActionId);
  expect(actionId).not.toBeNull();
  if (actionId === null) throw new Error('expected an active action after owner-order confirmation');
  expect(await dispatchAction(page, { type: 'actionContact', actionId, player: 'self', choice: { kind: 'pass' } })).toEqual({ ok: true });
  expect(await dispatchAction(page, { type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(await dispatchAction(page, { type: 'actionJudge', actionId })).toEqual({ ok: true });
  expect(await dispatchAction(page, { type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(await dispatchAction(page, { type: 'actionAdvance', actionId })).toEqual({ ok: true });
  await waitForActionEnd(page);
  expectNoConsoleErrors(errors);
});
