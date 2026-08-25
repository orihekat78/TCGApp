import { expect, test, type Page } from '@playwright/test';
import {
  buildGameState,
  dispatchAction,
  expectNoConsoleErrors,
  getGameState,
  setupGamePage,
} from './helpers';

type AnyState = Record<string, unknown>;

async function primeHuman(page: Page): Promise<void> {
  await page.evaluate(() => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const store = (window as unknown as { __game: { store: { getState: () => {
      setSpectatorMode: (value: boolean) => void;
      setAiPaused: (value: boolean) => void;
    } } } }).__game.store.getState();
    store.setSpectatorMode(false);
    store.setAiPaused(true);
  });
}

function buildB07043Choice(gs: AnyState): void {
  const makeChar = (cardId: string, uid: string, state: 'active' | 'sleep') => ({
    cardId, uid, state, isNamed: false, enterOrder: 1, enterOrderThisTurn: 1,
    setCards: [], stackedCards: [], keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null, lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {},
  });
  const players = gs.players as { self: AnyState; opp: AnyState };
  players.self.case = {
    cardId: 'D08026', status: '事件編', requiredEvidence: 7,
    colors: ['白'], declaredUseCount: {},
  };
  players.self.scene = [makeChar('B07043', 'wave168-source', 'sleep')];
  players.self.deck = ['D08017', 'B05045', 'B07030', 'D08013'];
  players.self.hand = [];
  players.opp.scene = [makeChar('B07052', 'wave168-attacker', 'active')];
  players.opp.deck = ['D08017'];
  gs.pendingEffects = [];
  gs.turn = { number: 168, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
}

function buildB07053Reveal(gs: AnyState): void {
  const players = gs.players as { self: AnyState; opp: AnyState };
  players.self.case = {
    cardId: 'D08026', status: '事件編', requiredEvidence: 7,
    colors: ['白'], declaredUseCount: {},
  };
  players.self.file = Array.from({ length: 5 }, () => ({ type: 'card-back', cardId: 'D08017' }));
  players.self.hand = ['B07053', 'B05045'];
  players.self.deck = ['D08013'];
  players.self.scene = [];
  players.opp.scene = [];
  gs.pendingEffects = [];
  gs.turn = { number: 169, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
}

test.describe('QA Waves168-169 visible decisions', () => {
  test('B07043 names all three declaration choices before forced Kaito search', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await primeHuman(page);
    await buildGameState(page, buildB07043Choice);

    await page.evaluate(() => {
      const game = (window as unknown as { __game: {
        dispatch: (action: unknown) => { ok: boolean; reason?: string };
        getState: () => { activeActionId: string | null };
      } }).__game;
      const requireOk = (result: { ok: boolean; reason?: string }, label: string) => {
        if (!result.ok) throw new Error(`${label}: ${result.reason ?? 'rejected'}`);
      };
      requireOk(game.dispatch({
        type: 'actionDeclareChar', byUid: 'wave168-attacker', targetUid: 'wave168-source',
      }), 'declare');
      const actionId = game.getState().activeActionId;
      if (!actionId) throw new Error('missing Wave168 action id');
      requireOk(game.dispatch({ type: 'actionGuard', actionId, guarderUid: null }), 'guard');
      requireOk(game.dispatch({ type: 'actionAdvance', actionId }), 'advance contact start');
      requireOk(game.dispatch({ type: 'actionAdvance', actionId }), 'advance first window');
      requireOk(game.dispatch({
        type: 'actionContact', actionId, player: 'self', choice: { kind: 'pass' },
      }), 'self pass');
      requireOk(game.dispatch({ type: 'actionAdvance', actionId }), 'advance second window');
      requireOk(game.dispatch({
        type: 'actionContact', actionId, player: 'opp', choice: { kind: 'pass' },
      }), 'opp pass');
      requireOk(game.dispatch({ type: 'actionAdvance', actionId }), 'advance judge');
      requireOk(game.dispatch({ type: 'actionJudge', actionId }), 'judge');
    });

    const modal = page.getByTestId('choice-picker-modal');
    await expect(modal).toBeVisible();
    await expect(page.getByTestId('cp-opt-0')).toHaveText('黒羽盗一');
    await expect(page.getByTestId('cp-opt-1')).toHaveText('黒羽快斗');
    await expect(page.getByTestId('cp-opt-2')).toHaveText('怪盗キッド');
    await page.getByTestId('cp-opt-1').click();

    await expect.poll(async () => (await getGameState(page)).players.self.hand).toEqual(['B05045']);
    expectNoConsoleErrors(errors);
  });

  test('B07053 displays the selected hand card publicly until the player closes it', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await primeHuman(page);
    await buildGameState(page, buildB07053Reveal);

    expect(await dispatchAction(page, { type: 'handUseCard', player: 'self', cardId: 'B07053' }))
      .toEqual({ ok: true });
    const decision = await page.evaluate(() => (window as unknown as { __game: { getState: () => {
      pendingEffectPick: { atomVerb: string; candidates: Array<{ uid: string; cardId: string }> } | null;
    } } }).__game.getState().pendingEffectPick);
    expect(decision?.atomVerb).toBe('handReveal');
    const candidate = decision!.candidates.find(item => item.cardId === 'B05045')!;
    await page.getByTestId(`effect-pick-cand-${candidate.uid}`).click();

    const reveal = page.getByTestId('public-hand-reveal-window');
    await expect(reveal).toBeVisible();
    await expect(reveal.locator('.public-hand-reveal-name')).toContainText('怪盗キッド');
    await expect(page.getByTestId('public-hand-reveal-close')).toBeFocused();
    await page.getByTestId('public-hand-reveal-close').click();
    await expect(reveal).toBeHidden();

    const state = await getGameState(page);
    expect(state.players.self.hand).toEqual(['B05045']);
    expect(state.players.self.scene.map(character => character.cardId)).toContain('B07053');
    expectNoConsoleErrors(errors);
  });
});
