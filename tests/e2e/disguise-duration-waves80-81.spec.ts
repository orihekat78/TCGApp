import { test, expect, type Page } from '@playwright/test';
import { buildGameState, expectNoConsoleErrors, getGameState, setupGamePage } from './helpers';

type AnyState = Record<string, unknown>;

async function setHuman(page: Page, side: 'self' | 'opp'): Promise<void> {
  await page.evaluate((human) => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = human;
    const game = (window as unknown as {
      __game: { store: { getState: () => { setSpectatorMode: (value: boolean) => void } } };
    }).__game;
    game.store.getState().setSpectatorMode(false);
  }, side);
}

function buildContact(gs: AnyState, incoming: 'B02047' | 'B02086P'): void {
  const makeChar = (cardId: string, uid: string, state: 'active' | 'sleep') => ({
    cardId, uid, state, isNamed: false, enterOrder: 1, enterOrderThisTurn: 1,
    setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null, lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {},
  });
  const players = gs.players as { self: AnyState; opp: AnyState };
  players.opp.case = {
    cardId: 'D03016', status: '事件編', requiredEvidence: 7, colors: ['白'], declaredUseCount: {},
  };
  players.opp.file = Array.from({ length: 6 }, () => ({ type: 'card-back', cardId: 'D08005' }));
  players.opp.hand = [incoming];
  players.opp.deck = ['D08005', 'D08006'];
  players.opp.scene = [makeChar('B01050', 'opp-actor', 'sleep')];
  players.opp.remove = [];
  players.self.hand = ['D08007', 'D08008'];
  players.self.deck = ['D08009', 'D08010'];
  players.self.scene = [makeChar('D03002', 'self-attacker', 'active')];
  players.self.remove = [];
  gs.pendingEffects = [];
  gs.turn = { number: 25, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
}

async function disguiseFromDefender(page: Page, cardId: string): Promise<string> {
  return page.evaluate((incoming) => {
    const game = (window as unknown as {
      __game: {
        dispatch: (action: unknown) => { ok: boolean; reason?: string };
        getState: () => { gameState: { players: { self: { scene: Array<{ uid: string }> }; opp: { scene: Array<{ uid: string }> } } }; activeActionId: string | null };
        getActionContext: (id: string) => { phase: string; firstUid?: string; secondUid?: string } | null;
      };
    }).__game;
    const requireOk = (result: { ok: boolean; reason?: string }, label: string) => {
      if (!result.ok) throw new Error(`${label}: ${result.reason ?? 'rejected'}`);
    };
    requireOk(game.dispatch({
      type: 'actionDeclareChar', byUid: 'self-attacker', targetUid: 'opp-actor',
    }), 'declare');
    const actionId = game.getState().activeActionId;
    if (!actionId) throw new Error('missing action id');
    requireOk(game.dispatch({ type: 'actionGuard', actionId, guarderUid: null }), 'guard');
    for (let step = 0; step < 14; step += 1) {
      const context = game.getActionContext(actionId);
      if (!context) throw new Error('contact ended before disguise');
      if (context.phase === 'action-1' || context.phase === 'action-2' || context.phase === 'action-1-redo') {
        const uid = context.phase === 'action-2' ? context.secondUid : context.firstUid;
        const selfOwns = game.getState().gameState.players.self.scene.some(card => card.uid === uid);
        if (!selfOwns && uid === 'opp-actor') {
          requireOk(game.dispatch({
            type: 'actionContact', actionId, player: 'opp',
            choice: { kind: 'disguise', cardId: incoming },
          }), 'disguise');
          return actionId;
        }
        requireOk(game.dispatch({
          type: 'actionContact', actionId, player: selfOwns ? 'self' : 'opp', choice: { kind: 'pass' },
        }), 'pass');
        requireOk(game.dispatch({ type: 'actionAdvance', actionId }), 'advance after pass');
      } else {
        requireOk(game.dispatch({ type: 'actionAdvance', actionId }), 'advance');
      }
    }
    throw new Error('self disguise window not reached');
  }, cardId);
}

async function finishAction(page: Page, actionId: string): Promise<void> {
  await page.evaluate((id) => {
    const game = (window as unknown as {
      __game: {
        dispatch: (action: unknown) => { ok: boolean; reason?: string };
        getState: () => { gameState: { players: { self: { scene: Array<{ uid: string }> }; opp: { scene: Array<{ uid: string }> } } }; activeActionId: string | null };
        getActionContext: (id: string) => { phase: string; firstUid?: string; secondUid?: string } | null;
      };
    }).__game;
    const requireOk = (result: { ok: boolean; reason?: string }, label: string) => {
      if (!result.ok) throw new Error(`${label}: ${result.reason ?? 'rejected'}`);
    };
    for (let step = 0; step < 24 && game.getState().activeActionId === id; step += 1) {
      const context = game.getActionContext(id);
      if (!context) break;
      if (context.phase === 'action-1' || context.phase === 'action-2' || context.phase === 'action-1-redo') {
        const uid = context.phase === 'action-2' ? context.secondUid : context.firstUid;
        const selfOwns = game.getState().gameState.players.self.scene.some(card => card.uid === uid);
        const passed = game.dispatch({
          type: 'actionContact', actionId: id, player: selfOwns ? 'self' : 'opp', choice: { kind: 'pass' },
        });
        if (!passed.ok) requireOk(game.dispatch({ type: 'actionAdvance', actionId: id }), 'advance acted');
      } else if (context.phase === 'judge') {
        const judged = game.dispatch({ type: 'actionJudge', actionId: id });
        if (!judged.ok) requireOk(game.dispatch({ type: 'actionAdvance', actionId: id }), 'advance judged');
      } else {
        requireOk(game.dispatch({ type: 'actionAdvance', actionId: id }), 'advance');
      }
    }
    if (game.getState().activeActionId !== null) throw new Error('action did not finish');
  }, actionId);
}

test.describe('Waves80-81 disguise duration UI', () => {
  test('B02086P opponent decline modal protects this action and clears at action end', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await setHuman(page, 'self');
    await buildGameState(page, buildContact, 'B02086P');
    const actionId = await disguiseFromDefender(page, 'B02086P');

    const optional = page.getByTestId('optional-picker-modal');
    await expect(optional).toBeVisible();
    await expect(optional).toContainText('ベルモット');
    await page.getByTestId('opt-run-no').click();
    await expect(optional).toBeHidden();
    await finishAction(page, actionId);

    const after = await getGameState(page) as unknown as {
      players: { opp: { scene: Array<{ uid: string; cardId: string; turnEffects: Record<string, unknown> }> } };
    };
    const defender = after.players.opp.scene.find(card => card.uid === 'opp-actor');
    expect(defender?.cardId).toBe('B02086P');
    expect(defender?.turnEffects.contactImmune_action).toBeUndefined();
    expectNoConsoleErrors(errors);
  });

  test('B02047 valid replacement survives contact without stale immunity', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await setHuman(page, 'self');
    await buildGameState(page, buildContact, 'B02047');
    const actionId = await disguiseFromDefender(page, 'B02047');
    await finishAction(page, actionId);

    const after = await getGameState(page) as unknown as {
      players: { opp: { scene: Array<{ uid: string; cardId: string; turnEffects: Record<string, unknown> }> } };
    };
    const defender = after.players.opp.scene.find(card => card.uid === 'opp-actor');
    expect(defender?.cardId).toBe('B02047');
    expect(defender?.turnEffects.contactImmune_action).toBeUndefined();
    expect(defender?.turnEffects.contactImmune).toBe(false);
    expectNoConsoleErrors(errors);
  });
});
