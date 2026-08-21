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

test('real simultaneous reactions resolve through owner order at 851x393', async ({ page }) => {
  await page.setViewportSize({ width: 851, height: 393 });
  const { errors } = await setupGamePage(page);
  await page.evaluate(async () => {
    const w = window as unknown as {
      __game: {
        createSampleGameState: () => unknown;
        dispatch: (action: unknown) => { ok: boolean; reason?: string };
        getState: () => unknown;
        setGameState: (state: unknown, options?: { preserveRuntime?: boolean }) => boolean;
        store: { getState: () => {
          pendingEffectPick: { decisionId?: string } | null;
          resetMatchSessionState: () => void;
          setAiPaused: (paused: boolean) => void;
          setSpectatorMode: (spectator: boolean) => void;
        } };
        testApi: Promise<{
          persistPendingRuntimeState: (state: unknown) => void;
          produce: (state: unknown, recipe: (draft: unknown) => void) => unknown;
          resetPendingRuntimeState: () => void;
          runAtom: (state: unknown, verb: string, args: unknown, ctx: unknown) => void;
          surfacePendingSideChannels: (getStore: () => unknown) => void;
        }>;
      };
    };
    const store = w.__game.store.getState();
    const {
      persistPendingRuntimeState,
      produce,
      resetPendingRuntimeState,
      runAtom,
      surfacePendingSideChannels,
    } = await w.__game.testApi;
    store.resetMatchSessionState();
    store.setSpectatorMode(false);
    store.setAiPaused(true);
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'opp';

    const makeChar = (uid: string, cardId: string) => ({
      cardId,
      uid,
      state: 'active',
      isNamed: false,
      enterOrder: 1,
      setCards: [],
      stackedCards: 0,
      keywordOverrides: { granted: [], disabledOriginal: false },
      apOverride: null,
      lpOverride: null,
      turnEffects: { contactImmune: false, removeOnTurnEnd: false },
      declaredUseCount: {},
    });
    const state = w.__game.createSampleGameState() as {
      turn: { number: number; player: 'self' | 'opp'; phase: string; isFirstPlayerFirstTurn: boolean };
      players: {
        self: { scene: unknown[]; hand: string[]; remove: string[] };
        opp: { scene: unknown[]; hand: string[]; remove: string[] };
      };
      pendingEffects: unknown[];
      gameResult?: unknown;
    };
    state.turn = { number: 4, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.scene = [
      makeChar('target-1', 'B04003'),
      makeChar('target-2', 'B04003'),
      makeChar('hirota-1', 'B08081'),
      makeChar('hirota-2', 'B08081'),
    ];
    state.players.opp.scene = [makeChar('source', 'B04003')];
    state.players.opp.hand = ['B01001', 'B01001'];
    state.players.opp.remove = [];
    state.pendingEffects = [];
    delete state.gameResult;

    resetPendingRuntimeState();
    const next = produce(state, (draft) => {
      runAtom(
        draft,
        'sceneSetState',
        { player: 'self', side: 'either', state: 'sleep', max: 2 },
        {
          source: {
            player: 'opp', cardId: 'B04003', uid: 'source',
            abilityId: 'e2e-owner-order', area: 'scene',
          },
          bindings: {},
        },
      );
      persistPendingRuntimeState(draft);
    });
    if (!w.__game.setGameState(next, { preserveRuntime: true })) {
      throw new Error('failed to install real choose-intercept fixture');
    }
    surfacePendingSideChannels(() => w.__game.store.getState());
    const pick = w.__game.store.getState().pendingEffectPick;
    if (!pick?.decisionId) throw new Error('real effect pick was not surfaced');

    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const result = w.__game.dispatch({
      type: 'effectPickResolve',
      decisionId: pick.decisionId,
      pickedUid: 'target-1',
      pickedUids: ['target-1', 'target-2'],
    });
    if (!result.ok) throw new Error(`effectPickResolve failed: ${result.reason ?? 'unknown'}`);
  });

  const modal = page.getByTestId('choose-intercept-order-modal');
  await expect(modal).toBeVisible();
  await expect(modal.getByRole('heading')).toHaveText('同時に発動した能力の解決順を選んでください');
  const firstChoice = modal.getByTestId('choose-intercept-order-hirota-1-target-1');
  await expect(firstChoice).toBeVisible();
  await expect(modal.getByTestId('choose-intercept-order-hirota-2-target-1')).toBeVisible();
  await expect(firstChoice).toBeFocused();

  await page.evaluate(() => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'opp';
  });
  await firstChoice.click();

  const responseModal = page.getByTestId('choose-intercept-modal');
  await expect(responseModal).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const state = (window as unknown as {
      __game: { getState: () => { pendingChooseIntercept: unknown } };
    }).__game.getState();
    return state.pendingChooseIntercept;
  })).toMatchObject({ kind: 'response', protector: { uid: 'hirota-1' }, targetUid: 'target-1' });
  await page.getByTestId('choose-intercept-discard-0').click();

  await expect.poll(() => page.evaluate(() => {
    const state = (window as unknown as {
      __game: { getState: () => { pendingChooseIntercept: unknown } };
    }).__game.getState();
    return state.pendingChooseIntercept;
  })).toMatchObject({ kind: 'response', protector: { uid: 'hirota-2' }, targetUid: 'target-1' });
  await page.getByTestId('choose-intercept-discard-0').click();

  await expect(modal).toBeHidden();
  await expect(responseModal).toBeHidden();
  await expect.poll(() => page.evaluate(() => {
    const ui = (window as unknown as {
      __game: { getState: () => {
        pendingChooseIntercept: unknown;
        gameState: {
          pendingRuntimeState?: unknown;
          players: {
            self: { scene: { uid: string; state: string; turnEffects: { chooseInterceptBatchWitnesses?: unknown } }[] };
            opp: { hand: string[]; remove: string[] };
          };
        };
      } };
    }).__game.getState();
    return {
      pending: ui.pendingChooseIntercept,
      targets: ui.gameState.players.self.scene
        .filter(card => card.uid.startsWith('target-'))
        .map(card => card.state),
      hand: ui.gameState.players.opp.hand,
      remove: ui.gameState.players.opp.remove,
      runtimePending: ui.gameState.pendingRuntimeState !== undefined,
      witnessPending: ui.gameState.players.self.scene.some(
        card => card.turnEffects.chooseInterceptBatchWitnesses !== undefined,
      ),
    };
  })).toEqual({
    pending: null,
    targets: ['sleep', 'sleep'],
    hand: [],
    remove: ['B01001', 'B01001'],
    runtimePending: false,
    witnessPending: false,
  });
  expectNoConsoleErrors(errors);
});
