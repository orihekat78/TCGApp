import { test, expect, type Page } from '@playwright/test';
import {
  buildGameState,
  dispatchAction,
  expectNoConsoleErrors,
  getActiveActionId,
  getGameState,
  setupGamePage,
  waitForActionEnd,
} from './helpers';

type AnyState = Record<string, unknown>;

async function primeHuman(page: Page): Promise<void> {
  await page.evaluate(() => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const game = (window as unknown as {
      __game: { store: { getState: () => {
        setSpectatorMode: (value: boolean) => void;
        setAiPaused: (value: boolean) => void;
      } } };
    }).__game;
    const store = game.store.getState();
    store.setSpectatorMode(false);
    store.setAiPaused(true);
  });
}

function buildWave82(gs: AnyState): void {
  const makeChar = (cardId: string, uid: string, state: 'active' | 'sleep') => ({
    cardId, uid, state, isNamed: false, enterOrder: 1, enterOrderThisTurn: 1,
    setCards: [], stackedCards: [], keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null, lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {},
  });
  const players = gs.players as { self: AnyState; opp: AnyState };
  players.self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
  players.self.case = {
    cardId: 'D06019', status: '事件編', requiredEvidence: 7,
    colors: ['緑', '白'], declaredUseCount: {},
  };
  players.self.file = Array.from({ length: 5 }, () => ({ type: 'card-back', cardId: 'D08017' }));
  players.self.hand = ['B02043'];
  players.self.deck = ['D08013'];
  players.self.scene = [makeChar('D08005', 'wave82-actor', 'active')];
  players.self.remove = [];
  players.opp.scene = [makeChar('D08006', 'wave82-target', 'sleep')];
  gs.pendingEffects = [];
  gs.turn = { number: 31, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
}

function buildWave83(gs: AnyState): void {
  const makeChar = (cardId: string, uid: string, state: 'active' | 'sleep') => ({
    cardId, uid, state, isNamed: true, enterOrder: 1, enterOrderThisTurn: 1,
    setCards: [
      { cardId: 'D08017', faceUp: false, instanceId: 'wave83-set-a' },
      { cardId: 'D08003', faceUp: true, instanceId: 'wave83-set-b' },
    ],
    stackedCards: [
      { cardId: 'D08013', instanceId: 'wave83-stack-a' },
      { cardId: 'D08007', instanceId: 'wave83-stack-b' },
    ],
    keywordOverrides: { granted: ['突撃'], disabledOriginal: false },
    apOverride: 2300, lpOverride: 3,
    turnEffects: {
      contactImmune: false, removeOnTurnEnd: true,
      apMod_wave83: 400, lpMod_wave83: 1, nameOverride: '継承名',
    },
    declaredUseCount: {},
  });
  const players = gs.players as { self: AnyState; opp: AnyState };
  players.self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
  players.self.case = {
    cardId: 'D08026', status: '事件編', requiredEvidence: 7,
    colors: ['白'], declaredUseCount: {},
  };
  players.self.file = Array.from({ length: 6 }, () => ({ type: 'card-back', cardId: 'D08017' }));
  players.self.hand = ['B03129'];
  players.self.deck = ['D08009'];
  players.self.scene = [makeChar('B03052P', 'wave83-actor', 'active')];
  players.self.remove = [];
  players.opp.scene = [{
    ...makeChar('D08006', 'wave83-target', 'sleep'),
    isNamed: false, setCards: [], stackedCards: [],
    keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null, lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false },
  }];
  gs.pendingEffects = [];
  gs.turn = { number: 32, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
}

function buildB03050(gs: AnyState): void {
  const makeChar = (cardId: string, uid: string, state: 'active' | 'sleep') => ({
    cardId, uid, state, isNamed: false, enterOrder: 1, enterOrderThisTurn: 1,
    setCards: [], stackedCards: [], keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null, lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {},
  });
  const players = gs.players as { self: AnyState; opp: AnyState };
  players.self.case = {
    cardId: 'D03016', status: '事件編', requiredEvidence: 7,
    colors: ['白'], declaredUseCount: {},
  };
  players.self.file = Array.from({ length: 5 }, () => ({ type: 'card-back', cardId: 'D08017' }));
  players.self.hand = ['B03050'];
  players.self.deck = ['D08009', 'D08010'];
  players.self.evidence = [];
  players.self.scene = [makeChar('B10058', 'wave83-b03050-defender', 'sleep')];
  players.self.remove = [];
  players.opp.hand = ['D08017'];
  players.opp.scene = [makeChar('B01098', 'wave83-b03050-attacker', 'active')];
  players.opp.remove = [];
  gs.pendingEffects = [];
  gs.turn = { number: 33, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
}

async function startB03050FirstWindow(page: Page): Promise<string> {
  return page.evaluate(() => {
    const game = (window as unknown as {
      __game: {
        dispatch: (action: unknown) => { ok: boolean; reason?: string };
        getState: () => { activeActionId: string | null };
        getActionContext: (id: string) => { phase: string; firstUid?: string; secondUid?: string } | null;
      };
    }).__game;
    const requireOk = (result: { ok: boolean; reason?: string }, label: string) => {
      if (!result.ok) throw new Error(`${label}: ${result.reason ?? 'rejected'}`);
    };
    requireOk(game.dispatch({
      type: 'actionDeclareChar',
      byUid: 'wave83-b03050-attacker',
      targetUid: 'wave83-b03050-defender',
    }), 'declare');
    const actionId = game.getState().activeActionId;
    if (!actionId) throw new Error('missing B03050 action id');
    requireOk(game.dispatch({ type: 'actionGuard', actionId, guarderUid: null }), 'guard');
    for (let step = 0; step < 8; step += 1) {
      const context = game.getActionContext(actionId);
      if (!context) throw new Error('contact ended before B03050 window');
      if (context.phase === 'action-1') {
        if (context.firstUid !== 'wave83-b03050-defender') {
          throw new Error(`B03050 is not first: ${context.firstUid ?? 'missing'}`);
        }
        return actionId;
      }
      requireOk(game.dispatch({ type: 'actionAdvance', actionId }), 'advance');
    }
    throw new Error('B03050 action-1 not reached');
  });
}

test.describe('Waves82-83 disguise public UI', () => {
  test('D06019 green+white case exposes B02043 as a legal disguise', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await primeHuman(page);
    await buildGameState(page, buildWave82);

    expect(await dispatchAction(page, {
      type: 'actionDeclareChar', byUid: 'wave82-actor', targetUid: 'wave82-target',
    })).toEqual({ ok: true });
    const candidate = page.getByTestId('cid-disg-card:self:hand:B02043#0');
    await expect(candidate).toBeVisible({ timeout: 5000 });
    await candidate.click();
    await waitForActionEnd(page);

    const state = await getGameState(page) as unknown as {
      players: { self: { scene: Array<{ uid: string; cardId: string }>; deck: string[] } };
    };
    expect(state.players.self.scene.find(card => card.uid === 'wave82-actor')?.cardId).toBe('B02043');
    expect(state.players.self.deck.at(-1)).toBe('D08005');
    expectNoConsoleErrors(errors);
  });

  test('B03129 replacing B03052P preserves state and attached occurrences', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await primeHuman(page);
    await buildGameState(page, buildWave83);

    expect(await dispatchAction(page, {
      type: 'actionDeclareChar', byUid: 'wave83-actor', targetUid: 'wave83-target',
    })).toEqual({ ok: true });
    const candidate = page.getByTestId('cid-disg-card:self:hand:B03129#0');
    await expect(candidate).toBeVisible({ timeout: 5000 });
    await candidate.click();

    await expect.poll(async () => {
      const state = await getGameState(page) as unknown as {
        players: { self: { scene: Array<{ uid: string; cardId: string }> } };
      };
      return state.players.self.scene.find(card => card.uid === 'wave83-actor')?.cardId;
    }).toBe('B03129');
    const state = await getGameState(page) as unknown as {
      players: { self: {
        scene: Array<{
          uid: string; cardId: string; state: string; isNamed: boolean;
          setCards: Array<{ cardId: string; faceUp: boolean; instanceId: string }>;
          stackedCards: Array<{ cardId: string; instanceId: string }>;
          turnEffects: Record<string, unknown>;
        }>;
        deck: string[];
      } };
    };
    const actor = state.players.self.scene.find(card => card.uid === 'wave83-actor');
    expect(actor).toMatchObject({
      cardId: 'B03129', state: 'sleep', isNamed: true,
      setCards: [
        { cardId: 'D08017', faceUp: false, instanceId: 'wave83-set-a' },
        { cardId: 'D08003', faceUp: true, instanceId: 'wave83-set-b' },
      ],
      stackedCards: [
        { cardId: 'D08013', instanceId: 'wave83-stack-a' },
        { cardId: 'D08007', instanceId: 'wave83-stack-b' },
      ],
    });
    expect(actor?.turnEffects).toMatchObject({
      removeOnTurnEnd: true, apMod_wave83: 400, lpMod_wave83: 1, nameOverride: '継承名',
    });
    expect(state.players.self.deck.at(-1)).toBe('B03052P');
    expectNoConsoleErrors(errors);
  });

  test('B03050 first-actor self-removal closes action without a second contact modal', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await primeHuman(page);
    await buildGameState(page, buildB03050);
    await startB03050FirstWindow(page);

    const disguise = page.getByTestId('cid-disg-card:self:hand:B03050#0');
    await expect(disguise).toBeVisible({ timeout: 5000 });
    await disguise.click();
    const optional = page.getByTestId('optional-picker-modal');
    await expect(optional).toBeVisible();
    await page.getByTestId('opt-run-yes').click();
    await expect(optional).toBeHidden();

    await expect.poll(() => getActiveActionId(page), { timeout: 5000 }).toBeNull();
    await expect(page.getByTestId('cid-picker-modal')).toBeHidden();
    const state = await getGameState(page) as unknown as {
      players: {
        self: { scene: Array<{ uid: string; cardId: string }>; evidence: unknown[] };
        opp: { hand: string[] };
      };
    };
    expect(state.players.self.scene.some(card => card.uid === 'wave83-b03050-defender')).toBe(false);
    expect(state.players.self.evidence).toHaveLength(1);
    expect(state.players.opp.hand).toContain('D08017');
    expectNoConsoleErrors(errors);
  });
});
