// E2E: optional-decision (「〜してもよい」= pendingEffectOptional) の実機 text-faithfulness 検証。
//
// B05019 中道和志「自分の現場の[毛利小五郎]が推理したとき、このキャラをリムーブしてもよい。
//   そうした場合、LP0のキャラを1枚まで選び、ターン終了時までLP＋1する。」
//   - [毛利小五郎] 推理 → optional が surface (store.pendingEffectOptional)。
//   - する (optionalResolve run:true) → 中道和志 リムーブ + LP0キャラ pick (LP1 decoy 除外) → LP+1。
//   - しない (run:false) → 何も起こらない。
//
// seam: __game.setGameState (reasoning-hook spec / effect-pick spec と同パターン)。
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

async function getPendingOptional(page: Page): Promise<{ player: string; source: { cardId: string; abilityId: string; uid: string } } | null> {
  return page.evaluate(() => {
    const w = window as unknown as { __game: { getState: () => { pendingEffectOptional: unknown } } };
    return w.__game.getState().pendingEffectOptional as never;
  });
}

async function getPendingPick(page: Page): Promise<{ candidates: { uid: string }[]; atomVerb: string } | null> {
  return page.evaluate(() => {
    const w = window as unknown as { __game: { getState: () => { pendingEffectPick: unknown } } };
    return w.__game.getState().pendingEffectPick as never;
  });
}

async function lpOf(page: Page, uid: string): Promise<number> {
  return page.evaluate((u) => {
    const w = window as unknown as { __game: { getState: () => { gameState: unknown }; read: { char: { lp: (s: unknown, uid: string) => number } } } };
    return w.__game.read.char.lp(w.__game.getState().gameState, u);
  }, uid);
}

function build(gs: AnyState): void {
  // page.evaluate 内で実行されるため helper を参照できない (inline 必須)
  const mkC = (cardId: string, uid: string, state = 'active') => ({ cardId, uid, state, isNamed: false, enterOrder: 1, enterOrderThisTurn: 1, setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {} });
  const self = (gs.players as AnyState).self as AnyState;
  self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
  self.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 7, colors: ['青'], declaredUseCount: {} };
  self.hand = []; self.evidence = []; self.remove = []; self.file = [];
  // 中道和志(B05019) + 毛利小五郎(D01005, 推理する) + LP0キャラ(D08009) + LP1 decoy(D08013)
  self.scene = [mkC('B05019', 'naka#1'), mkC('D01005', 'kog#1'), mkC('D08009', 'lp0#1'), mkC('D08013', 'lp1#1')];
  self.deck = ['D08005'];
  gs.pendingEffects = [];
  gs.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
}

test.describe('optional-decision B05019 (2026-06-06)', () => {
  test('する: [毛利小五郎]推理→optional surface→中道和志リムーブ+LP0キャラ(D08009)にLP+1 / LP1 decoy除外', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await setHumanSelf(page);
    await buildGameState(page, build);

    const lp0Before = await lpOf(page, 'lp0#1');
    const lp1Before = await lpOf(page, 'lp1#1');

    await dispatchAction(page, { type: 'reasoning', uid: 'kog#1' });

    // optional が surface (「〜してもよい」)
    const opt = await getPendingOptional(page);
    expect(opt, 'pendingEffectOptional が surface').not.toBeNull();
    expect(opt!.source, 'source = B05019 / a1 / 中道和志').toMatchObject({ cardId: 'B05019', abilityId: 'a1', uid: 'naka#1' });

    // する → 中道和志 リムーブ + LP0キャラ pick surface
    await dispatchAction(page, { type: 'optionalResolve', run: true });

    const pick = await getPendingPick(page);
    expect(pick, 'する 後に LP0キャラ pick が surface').not.toBeNull();
    expect(pick!.atomVerb, 'atomVerb=charModifyLP').toBe('charModifyLP');
    const uids = pick!.candidates.map((c) => c.uid);
    expect(uids, '候補に LP0キャラ(lp0#1) を含む').toContain('lp0#1');
    expect(uids, 'LP1 decoy(lp1#1) は候補外 (LP0 のみ)').not.toContain('lp1#1');

    await dispatchAction(page, { type: 'effectPickResolve', pickedUid: 'lp0#1' });

    const after = await getGameState(page);
    const scene = (after.players.self as { scene: { uid: string }[] }).scene;
    expect(scene.find((c) => c.uid === 'naka#1'), '中道和志 はリムーブされた').toBeUndefined();
    expect((await lpOf(page, 'lp0#1')) - lp0Before, 'LP0キャラに LP+1').toBe(1);
    expect((await lpOf(page, 'lp1#1')) - lp1Before, 'LP1 decoy は不変').toBe(0);
    expect(errors).toEqual([]);
  });

  test('しない: optional を run:false で解決 → 何も起こらない (中道和志 残存・LP0 不変)', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await setHumanSelf(page);
    await buildGameState(page, build);

    const lp0Before = await lpOf(page, 'lp0#1');
    await dispatchAction(page, { type: 'reasoning', uid: 'kog#1' });
    expect(await getPendingOptional(page), 'optional surface').not.toBeNull();

    await dispatchAction(page, { type: 'optionalResolve', run: false });

    expect(await getPendingOptional(page), 'しない 後は pendingEffectOptional クリア').toBeNull();
    const after = await getGameState(page);
    const scene = (after.players.self as { scene: { uid: string }[] }).scene;
    expect(scene.find((c) => c.uid === 'naka#1'), '中道和志 は残る').toBeTruthy();
    expect((await lpOf(page, 'lp0#1')) - lp0Before, 'LP0 は不変').toBe(0);
    expect(errors).toEqual([]);
  });
});
