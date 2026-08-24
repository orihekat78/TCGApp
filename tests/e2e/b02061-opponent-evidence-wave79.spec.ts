import { test, expect, type Page } from '@playwright/test';
import {
  buildGameState,
  dispatchAction,
  expectCharHasKeyword,
  expectCharNotHasKeyword,
  expectNoConsoleErrors,
  getGameState,
  setupGamePage,
} from './helpers';

type AnyState = Record<string, unknown>;

async function setHumanSelf(page: Page): Promise<void> {
  await page.evaluate(() => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const game = (window as unknown as {
      __game: { store: { getState: () => { setSpectatorMode: (value: boolean) => void } } };
    }).__game;
    game.store.getState().setSpectatorMode(false);
  });
}

function buildB02061(gs: AnyState): void {
  const makeChar = (cardId: string, uid: string) => ({
    cardId, uid, state: 'active', isNamed: false, enterOrder: 1, enterOrderThisTurn: 1,
    setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null, lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {},
  });
  const players = gs.players as { self: AnyState; opp: AnyState };
  players.self.case = {
    cardId: 'D08026', status: '事件編', requiredEvidence: 7, colors: ['赤'], declaredUseCount: {},
  };
  players.self.file = Array.from({ length: 6 }, () => ({ type: 'card-back', cardId: 'D08005' }));
  players.self.hand = ['B02061'];
  players.self.deck = ['D08005', 'D08006'];
  players.self.evidence = [];
  players.self.remove = [];
  players.self.scene = [makeChar('B01069', 'self-red-target'), makeChar('D08003', 'self-decoy')];
  players.opp.deck = ['D08007', 'D08008'];
  players.opp.evidence = [];
  players.opp.remove = [];
  players.opp.scene = [];
  gs.pendingEffects = [];
  gs.turn = { number: 21, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
}

test.describe('Wave79 B02061 public optional evidence', () => {
  test('accept moves hidden opponent top evidence and grants only the valid red target', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await setHumanSelf(page);
    await buildGameState(page, buildB02061);

    expect(await dispatchAction(page, {
      type: 'handUseCard', player: 'self', cardId: 'B02061',
    })).toEqual({ ok: true });
    const optional = page.getByTestId('optional-picker-modal');
    await expect(optional).toBeVisible();
    await expect(optional).toContainText('世良真純');
    await page.getByTestId('opt-run-yes').click();

    const target = page.getByTestId('scene-card-pick-self-red-target');
    await expect(target).toBeVisible();
    await expect(page.getByTestId('scene-card-pick-self-decoy')).toHaveCount(0);
    await target.click();
    await expect(target).toHaveCount(0);

    const after = await getGameState(page) as unknown as {
      players: { opp: { deck: string[]; evidence: Array<{ cardId: string; faceUp: boolean }> } };
    };
    expect(after.players.opp.deck).toEqual(['D08008']);
    expect(after.players.opp.evidence).toEqual([
      expect.objectContaining({ cardId: 'D08007', faceUp: false }),
    ]);
    await expectCharHasKeyword(page, 'self-red-target', '突撃[事件]');
    expectNoConsoleErrors(errors);
  });

  test('decline preserves opponent deck and grants no Assault', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await setHumanSelf(page);
    await buildGameState(page, buildB02061);

    expect(await dispatchAction(page, {
      type: 'handUseCard', player: 'self', cardId: 'B02061',
    })).toEqual({ ok: true });
    await expect(page.getByTestId('optional-picker-modal')).toBeVisible();
    await page.getByTestId('opt-run-no').click();
    await expect(page.getByTestId('optional-picker-modal')).toBeHidden();
    await expect(page.getByTestId('effect-picker-modal')).toHaveCount(0);

    const after = await getGameState(page) as unknown as {
      players: { opp: { deck: string[]; evidence: unknown[] } };
    };
    expect(after.players.opp.deck).toEqual(['D08007', 'D08008']);
    expect(after.players.opp.evidence).toEqual([]);
    await expectCharNotHasKeyword(page, 'self-red-target', '突撃[事件]');
    expectNoConsoleErrors(errors);
  });
});
