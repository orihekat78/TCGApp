import { test, expect, type Page } from '@playwright/test';
import { setupGamePage } from './helpers';

type ReplacementFixture = {
  sourceUid: string;
  targetUid: string;
};

async function openRealSetCardReplacement(page: Page): Promise<ReplacementFixture> {
  return page.evaluate(async () => {
    const loadMutate = new Function('return import("/src/engine/mutate/index.ts")') as () => Promise<{
      mutate: {
        scene: {
          enter: (state: unknown, player: 'self' | 'opp', cardId: string, opts: Record<string, never>) => { uid: string };
          removeToRemove: (state: unknown, uid: string, cause: 'effect') => { deferred?: boolean };
        };
        char: {
          setCard: (state: unknown, hostUid: string, cardId: string, faceUp: boolean) => void;
        };
      };
    }>;
    const loadProduce = new Function('return import("/src/engine/produce.ts")') as () => Promise<{
      produce: (state: unknown, recipe: (draft: unknown) => void) => unknown;
    }>;
    const loadSurface = new Function('return import("/src/ui/state/surface-pending.ts")') as () => Promise<{
      surfacePendingSideChannels: (getStore: () => unknown) => void;
    }>;
    const [{ mutate }, { produce }, { surfacePendingSideChannels }] = await Promise.all([
      loadMutate(),
      loadProduce(),
      loadSurface(),
    ]);
    const app = (window as unknown as {
      __game: {
        createSampleGameState: () => unknown;
        setGameState: (state: unknown) => boolean;
        store: {
          getState: () => {
            resetMatchSessionState: () => void;
            setSpectatorMode: (value: boolean) => void;
            setAiPaused: (value: boolean) => void;
            dispatch: (mutator: (state: unknown) => unknown) => boolean;
            pendingSetCardReplacement: {
              decisionId?: string;
              fromUid: string;
              setCardInstanceId: string;
              candidates: { uid: string; cardId: string }[];
              source: { cardId?: string; abilityId?: string; uid: string };
              resume?: { kind: string };
            } | null;
          };
        };
      };
    }).__game;
    const store = app.store;
    store.getState().resetMatchSessionState();
    store.getState().setSpectatorMode(false);
    store.getState().setAiPaused(true);
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';

    const state = app.createSampleGameState() as {
      turn: { player: 'self' | 'opp' };
      players: {
        self: {
          scene: { uid: string; setCards: { cardId: string; instanceId?: string }[] }[];
          remove: string[];
        };
        opp: {
          scene: { uid: string; setCards: { cardId: string; instanceId?: string }[] }[];
          remove: string[];
        };
      };
      pendingEffects: unknown[];
      gameResult?: unknown;
    };
    state.turn.player = 'opp';
    state.players.self.scene = [];
    state.players.opp.scene = [];
    state.players.self.remove = [];
    state.players.opp.remove = [];
    state.pendingEffects = [];
    delete state.gameResult;

    const source = mutate.scene.enter(state, 'self', 'D03003', {});
    const target = mutate.scene.enter(state, 'self', 'D03003', {});
    mutate.char.setCard(state, source.uid, 'B02052', true);
    const instanceId = state.players.self.scene
      .find((card) => card.uid === source.uid)?.setCards[0]?.instanceId;
    if (!instanceId || !app.setGameState(state)) {
      throw new Error('failed to commit canonical B02052 fixture');
    }

    let deferred = false;
    const committed = store.getState().dispatch((current) => produce(current, (draft) => {
      deferred = mutate.scene.removeToRemove(draft, source.uid, 'effect').deferred === true;
    }));
    if (!committed || !deferred) {
      throw new Error('failed to defer canonical B02052 host leave');
    }
    surfacePendingSideChannels(() => store.getState());
    const pending = store.getState().pendingSetCardReplacement;
    if (!pending
      || pending.fromUid !== source.uid
      || pending.setCardInstanceId !== instanceId
      || pending.candidates.length !== 1
      || pending.candidates[0]?.uid !== target.uid
      || pending.source.cardId !== 'B02052'
      || pending.source.abilityId !== 'a3'
      || pending.resume?.kind !== 'scene-remove') {
      throw new Error('failed to open canonical B02052 set-card replacement');
    }
    if (!/^decision:\d+$/.test(pending.decisionId ?? '')) {
      throw new Error('replacement decision identity was not surfaced');
    }
    return { sourceUid: source.uid, targetUid: target.uid };
  });
}

async function replacementSnapshot(page: Page, fixture: ReplacementFixture) {
  return page.evaluate(({ sourceUid, targetUid }) => {
    const ui = (window as unknown as {
      __game: {
        getState: () => {
          pendingSetCardReplacement: unknown;
          gameState: {
            players: {
              self: {
                scene: { uid: string; setCards: { cardId: string }[] }[];
                remove: string[];
              };
            };
          };
        };
      };
    }).__game.getState();
    return {
      pending: ui.pendingSetCardReplacement !== null,
      sourcePresent: ui.gameState.players.self.scene.some((card) => card.uid === sourceUid),
      targetSetCards: ui.gameState.players.self.scene
        .find((card) => card.uid === targetUid)?.setCards.map((entry) => entry.cardId) ?? [],
      remove: ui.gameState.players.self.remove,
    };
  }, fixture);
}

test('set-card replacement modal offers valid destinations and decline', async ({ page }) => {
  const { errors } = await setupGamePage(page);
  const fixture = await openRealSetCardReplacement(page);
  await expect(page.locator('[data-testid="set-card-replacement-modal"]')).toBeVisible();
  await expect(page.locator('[data-testid="set-card-replacement-decline"]')).toBeVisible();
  await page.locator('[data-testid="set-card-replacement-decline"]').click();
  await expect(page.locator('[data-testid="set-card-replacement-modal"]')).toBeHidden();
  expect(await replacementSnapshot(page, fixture)).toEqual({
    pending: false,
    sourcePresent: false,
    targetSetCards: [],
    remove: ['B02052', 'D03003'],
  });
  expect(errors).toEqual([]);
});

test('set-card replacement candidate selector resolves the chosen uid', async ({ page }) => {
  const { errors } = await setupGamePage(page);
  const fixture = await openRealSetCardReplacement(page);
  const candidate = page.getByTestId(`set-card-replacement-${fixture.targetUid}`);
  await expect(candidate).toBeVisible();
  await candidate.click();
  await expect(page.getByTestId('set-card-replacement-modal')).toBeHidden();
  expect(await replacementSnapshot(page, fixture)).toEqual({
    pending: false,
    sourcePresent: false,
    targetSetCards: ['B02052'],
    remove: ['D03003'],
  });
  expect(errors).toEqual([]);
});
