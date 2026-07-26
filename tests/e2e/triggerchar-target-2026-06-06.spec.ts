// E2E: triggerChar→target ($trigger.uid) の実機 text-faithfulness 検証。
//
// B05080 羽田秀吉 a2「【ターン1】相手の現場のキャラが推理したとき、手札を1枚リムーブしてもよい。
//   そうした場合、ターン終了時までそのキャラをLP-1する。」
//   - 相手 (opp) のキャラ推理 → 手札リムーブ pick が surface (skip 可)。
//   - 手札を選ぶ → discard + 「そのキャラ (=推理した相手)」を LP-1。
//   - skip (pickedUid:null) → chain break で LP-1 しない (「そうした場合」)。
//
// seam: __game.setGameState。
import { test, expect, type Page } from '@playwright/test';
import { setupGamePage, buildGameState, getGameState, dispatchAction } from './helpers';

type AnyState = Record<string, unknown>;

async function setHumanSelf(page: Page): Promise<void> {
  await page.evaluate(() => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const w = window as unknown as { __game: { store: { getState: () => { setSpectatorMode: (v: boolean) => void; setAiPaused: (v: boolean) => void } } } };
    const store = w.__game.store.getState();
    store.setSpectatorMode(false);
    store.setAiPaused(true);
  });
}

async function getPendingPick(page: Page): Promise<{ candidates: { uid: string; cardId: string }[]; atomVerb: string } | null> {
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

// opp が推理する盤面 (turn=opp)、self に B05080。page.evaluate 内実行のため inline。
function build(gs: AnyState, activeMisread = false): void {
  const mkC = (cardId: string, uid: string, state = 'active') => ({ cardId, uid, state, isNamed: false, enterOrder: 1, enterOrderThisTurn: 1, setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {} });
  const self = (gs.players as AnyState).self as AnyState;
  const opp = (gs.players as AnyState).opp as AnyState;
  self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
  self.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 7, colors: ['赤'], declaredUseCount: {} };
  self.scene = [mkC('B05080', 'hyd#1', activeMisread ? 'active' : 'sleep')];
  self.hand = ['D08005']; // discard 用
  self.deck = ['D08006']; self.evidence = []; self.remove = []; self.file = [];
  opp.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
  opp.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 6, colors: ['青'], declaredUseCount: {} };
  opp.scene = [mkC('D08013', 'enemy#1')]; // 吉田歩美 Lv4 lp:1 (推理する相手キャラ)
  opp.deck = ['D08005', 'D08006', 'D08009']; opp.hand = []; opp.evidence = []; opp.remove = []; opp.file = [];
  gs.pendingEffects = [];
  gs.turn = { number: 6, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
}

test.describe('triggerChar→target B05080 (2026-06-06)', () => {
  test('B05080の捨札決定をsleep直後に完了してからmisreadと証拠取得へ進む', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await setHumanSelf(page);
    await buildGameState(page, build, true);

    expect(await dispatchAction(page, { type: 'reasoning', uid: 'enemy#1' })).toMatchObject({ ok: true });

    await expect.poll(async () => (await getPendingPick(page))?.atomVerb ?? null).toBe('discard');
    expect(await page.evaluate(() => {
      const w = window as unknown as { __game: { getState: () => { pendingMisread: unknown; pendingEffectPick: unknown; gameState: { players: { opp: { evidence: unknown[] } } } } } };
      const state = w.__game.getState();
      return { hasMisread: state.pendingMisread !== null, hasEffectPick: state.pendingEffectPick !== null, evidence: state.gameState.players.opp.evidence.length };
    })).toEqual({ hasMisread: false, hasEffectPick: true, evidence: 0 });

    const initialDiscardPick = await getPendingPick(page);
    const initialDiscard = initialDiscardPick?.candidates.find((candidate) => candidate.cardId === 'D08005');
    expect(initialDiscard).toBeTruthy();
    expect(await dispatchAction(page, {
      type: 'effectPickResolve', pickedUid: initialDiscard!.uid,
    })).toMatchObject({ ok: true });

    await expect.poll(async () => page.evaluate(() => {
      const w = window as unknown as { __game: { getState: () => { pendingMisread: unknown } } };
      return w.__game.getState().pendingMisread !== null;
    })).toBe(true);

    expect(await page.evaluate(() => {
      const w = window as unknown as { __game: { getState: () => { pendingMisread: unknown; pendingEffectPick: unknown; gameState: { players: { opp: { evidence: unknown[] } } } } } };
      const state = w.__game.getState();
      return { hasMisread: state.pendingMisread !== null, hasEffectPick: state.pendingEffectPick !== null, evidence: state.gameState.players.opp.evidence.length };
    })).toEqual({ hasMisread: true, hasEffectPick: false, evidence: 0 });

    const _discardPick = await getPendingPick(page);
    const discard = _discardPick?.candidates.find((candidate) => candidate.cardId === 'D08005');
    expect(discard, 'B05080の後続効果はミスリード待ちへ先回りしない').toBeUndefined();
    expect(await dispatchAction(page, {
      type: 'misreadResolve', picks: [{ uid: 'hyd#1', x: 1 }],
    })).toMatchObject({ ok: true });
    expect(await page.evaluate(() => {
      const state = (window as unknown as { __game: { getState: () => Record<string, unknown> } }).__game.getState();
      return [
        'pendingMisread', 'pendingEffectPick', 'pendingEffectChoice', 'pendingEffectOptional',
        'pendingEffectRepeatOptional', 'pendingDeckReorder', 'pendingDeckPlace', 'pendingRps',
      ].every((key) => state[key] == null);
    }), '全human decisionが解決後に0件').toBe(true);
    expect(await dispatchAction(page, { type: 'endTurn', player: 'opp' }), '別の合法アクションを実行可能').toMatchObject({ ok: true });
    expect(errors).toEqual([]);
  });

  test('する: 相手推理→手札リムーブ pick→discard + そのキャラ(enemy#1) LP-1', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await setHumanSelf(page);
    await buildGameState(page, build);

    const lpBefore = await lpOf(page, 'enemy#1');
    expect(await dispatchAction(page, { type: 'reasoning', uid: 'enemy#1' })).toMatchObject({ ok: true });

    await expect.poll(async () => (await getPendingPick(page))?.atomVerb ?? null).toBe('discard');
    const pick = await getPendingPick(page);
    expect(pick, '手札リムーブ pick が surface').not.toBeNull();
    expect(pick!.atomVerb, 'atomVerb=discard').toBe('discard');
    expect(pick!.candidates.map((c) => c.cardId), '候補に自分の手札 D08005').toContain('D08005');

    expect(await dispatchAction(page, {
      type: 'effectPickResolve', pickedUid: pick!.candidates.find((c) => c.cardId === 'D08005')!.uid,
    })).toMatchObject({ ok: true });

    const after = await getGameState(page);
    expect((after.players.self as { hand: string[] }).hand, '手札 D08005 リムーブ済').not.toContain('D08005');
    expect((await lpOf(page, 'enemy#1')) - lpBefore, 'そのキャラ (推理した相手) を LP-1').toBe(-1);
    expect(errors).toEqual([]);
  });

  test('しない: 手札リムーブ pick を skip → chain break で LP-1 しない', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await setHumanSelf(page);
    await buildGameState(page, build);

    const lpBefore = await lpOf(page, 'enemy#1');
    expect(await dispatchAction(page, { type: 'reasoning', uid: 'enemy#1' })).toMatchObject({ ok: true });
    await expect.poll(async () => (await getPendingPick(page))?.atomVerb ?? null).toBe('discard');

    // skip (pickedUid:null) = 「しない」
    expect(await dispatchAction(page, { type: 'effectPickResolve', pickedUid: null })).toMatchObject({ ok: true });

    const after = await getGameState(page);
    expect((after.players.self as { hand: string[] }).hand, '手札はそのまま (skip)').toContain('D08005');
    expect((await lpOf(page, 'enemy#1')) - lpBefore, 'skip なら LP-1 しない (「そうした場合」)').toBe(0);
    expect(errors).toEqual([]);
  });
});
