// E2E: set-card 除去 (charRemoveSetCard) の実機 text-faithfulness 検証。
//
// B08034 工藤優作 a2「【ターン1】自分の現場のキャラが推理したとき、自分の現場のキャラに裏向きでセットされている
//   カードを1枚リムーブしてもよい。そうした場合、カードを1枚引く。」
//   - 推理 → setCard 保持キャラ (holder) を pick (skip 可)。
//   - holder を選ぶ → setCard リムーブ + 1ドロー。
//   - skip → chain break で ドローなし。
//
// seam: __game.setGameState。
import { test, expect, type Page } from '@playwright/test';
import { setupGamePage, buildGameState, getGameState, dispatchAction } from './helpers';

type AnyState = Record<string, unknown>;

async function setHumanSelf(page: Page): Promise<void> {
  await page.evaluate(() => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const w = window as unknown as { __game: { store: { getState: () => { setSpectatorMode: (v: boolean) => void } } } };
    w.__game.store.getState().setSpectatorMode(false);
  });
}

async function getPendingPick(page: Page): Promise<{ candidates: { uid: string }[]; atomVerb: string } | null> {
  return page.evaluate(() => {
    const w = window as unknown as { __game: { getState: () => { pendingEffectPick: unknown } } };
    return w.__game.getState().pendingEffectPick as never;
  });
}

function build(gs: AnyState): void {
  const mkC = (cardId: string, uid: string, setCards: unknown[] = []) => ({ cardId, uid, state: 'active', isNamed: false, enterOrder: 1, enterOrderThisTurn: 1, setCards, stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {} });
  const self = (gs.players as AnyState).self as AnyState;
  self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
  self.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 7, colors: ['白'], declaredUseCount: {} };
  // B08034 (推理する) + holder (D08009 に setCard 1枚)
  self.scene = [mkC('B08034', 'kudo#1'), mkC('D08009', 'holder#1', [{ cardId: 'D08003', faceUp: false }])];
  self.deck = ['e1', 'e2', 'draw1', 'x']; self.hand = []; self.evidence = []; self.remove = []; self.file = [];
  gs.pendingEffects = [];
  gs.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
}

test.describe('set-card 除去 B08034 (2026-06-06)', () => {
  test('する: 推理→setCard保持キャラ pick→setCard リムーブ + 1ドロー', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await setHumanSelf(page);
    await buildGameState(page, build);

    await dispatchAction(page, { type: 'reasoning', uid: 'kudo#1' });

    const pick = await getPendingPick(page);
    expect(pick, 'charRemoveSetCard pick が surface').not.toBeNull();
    expect(pick!.atomVerb, 'atomVerb=charRemoveSetCard').toBe('charRemoveSetCard');
    expect(pick!.candidates.map((c) => c.uid), '候補は setCard 保持キャラ (holder#1) のみ').toEqual(['holder#1']);

    await dispatchAction(page, { type: 'effectPickResolve', pickedUid: 'holder#1' });

    const after = await getGameState(page);
    const self = after.players.self as { scene: { uid: string; setCards: unknown[] }[]; remove: string[]; hand: string[] };
    expect(self.scene.find((c) => c.uid === 'holder#1')?.setCards.length, 'setCard リムーブ済 (0枚)').toBe(0);
    expect(self.remove, 'setCard (D08003) がリムーブエリアへ').toContain('D08003');
    expect(self.hand, 'そうした場合 1ドロー (draw1)').toContain('draw1');
    expect(errors).toEqual([]);
  });

  test('しない: charRemoveSetCard pick を skip → chain break で 1ドローしない', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await setHumanSelf(page);
    await buildGameState(page, build);

    await dispatchAction(page, { type: 'reasoning', uid: 'kudo#1' });
    expect(await getPendingPick(page), 'pick surface').not.toBeNull();

    await dispatchAction(page, { type: 'effectPickResolve', pickedUid: null }); // skip

    const after = await getGameState(page);
    const self = after.players.self as { scene: { uid: string; setCards: unknown[] }[]; hand: string[] };
    expect(self.scene.find((c) => c.uid === 'holder#1')?.setCards.length, 'skip なら setCard 残る').toBe(1);
    expect(self.hand, 'skip なら ドローなし (draw1 来ない)').not.toContain('draw1');
    expect(errors).toEqual([]);
  });
});
