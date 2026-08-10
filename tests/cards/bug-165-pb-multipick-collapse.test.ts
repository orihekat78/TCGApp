// BUG-165 (2026-07-02, wave-10): PB generic multi-pick collapse — n≥2 の Pattern B pick が
// 全経路 (human applyPickAndContinuation / AI drainAiEffectPicks / AI 同期 walk resolveEffectPicks)
// で先頭 1枚に collapse していた回帰テスト。
//   - apply-pick.ts generic branch: target:[resolvedCardId] (単数) → target: allCardIds (全選択)
//   - resolve-picks.ts AI 同期 generic branch: target:[pickValue] (単数) → nMax>1 は greedy nMax 枚
//     (cardIds:'$pick.cardIds' contract の「取れるだけ取る」BUG-103 と同流儀)
// 影響 shipped card: B04005 江戸川コナン a1「カードを2枚引き、手札を2枚リムーブする」が全経路で
// 1枚しかリムーブされていなかった (silent、test 無し)。handReveal ★未対応(3) (core.ts) の解消でもある。
// n:1 の挙動は byte 不変 (allCardIds = [resolvedCardId] / nMax<=1 は旧 path)。
// rules: 15-abilities-effects.md (「2枚リムーブする」= 必須・固定数)。
import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { run as runEffect } from '@/engine/effect/resolver';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { applyPickAndContinuation, drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { resolveEffectPicks, _clearPendingEffectPickQueue, _drainPendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { cards as engineCards } from '@/engine/cards/index';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { B04005 } from '@/cards/ct-p04/B04005';
import type { CardDef, Effect, EffectCtx } from '@/engine/types';
import { dispatchCurrentDecision } from '../helpers/dispatch-current-decision';
import { useGameStateStore } from '@/ui/state/store';
import { canApplyPendingPickSelection } from '@/engine/effect/pick-selection';

function ch(id: string): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: ['青'], level: 1, ap: 1000, lp: 1, traits: ['探偵'], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
}
const ctx = (): EffectCtx => ({ source: { cardId: 'SRC', uid: 'src#1', abilityId: 'a1', player: 'self', area: 'scene' }, bindings: {} });
const discard2: Effect = { kind: 'atom', verb: 'discard', args: { player: 'self', n: 2, bind: '$d' } } as never;
const exactDiscard2: Effect = {
  kind: 'atom',
  verb: 'discard',
  args: { player: 'self', n: 2, bind: '$d', minimumPolicy: 'exact' },
} as never;
const setHuman = (s: 'self' | 'opp' | null) => {
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s;
};

describe('BUG-165: PB generic multi-pick collapse (discard n:2)', () => {
  beforeEach(() => {
    resetDefRegistry();
    _resetUidCounter();
    _clearPendingEffectPickQueue();
    ['A', 'B', 'C'].forEach(id => registerCardDef(ch(id)));
    setHuman(null);
    useGameStateStore.getState().resetMatchSessionState();
  });

  it('accepts one unambiguous legacy occurrence alias but rejects an ambiguous alias atomically', () => {
    const state = createEmptyGameState();
    state.players.self.hand = ['A'];
    runEffect(state, discard2, ctx());
    runAllUntilEmpty(state);
    const pending = _drainPendingEffectPickSide()!;
    const canonical = pending.candidates[0]!;
    const ambiguous = {
      ...pending,
      candidates: [
        canonical,
        { ...canonical, uid: 'card:opp:hand:A#0', player: 'opp' as const },
      ],
    };

    expect(canApplyPendingPickSelection(pending, 'A#0')).toBe(true);
    expect(canApplyPendingPickSelection(ambiguous, 'A#0')).toBe(false);
    const before = structuredClone(state);
    expect(() => applyPickAndContinuation(state, ambiguous, 'A#0'))
      .toThrow(/unknown candidate uid/);
    expect(state).toEqual(before);

    applyPickAndContinuation(state, pending, 'A#0');
    expect(state.players.self.hand).toEqual([]);
    expect(state.players.self.remove).toEqual(['A']);
  });

  it('public dispatch rejects a below-minimum or empty mandatory pick without consuming the decision', () => {
    setHuman('self');
    const s = createEmptyGameState();
    s.players.self.hand = ['A', 'B', 'C'];
    runEffect(s, discard2, ctx());
    runAllUntilEmpty(s);
    const pending = _drainPendingEffectPickSide();
    expect(pending?.nMin).toBe(2);

    useGameStateStore.getState().setGameState(s);
    useGameStateStore.getState().setPendingEffectPick(pending);
    const surfaced = useGameStateStore.getState().pendingEffectPick!;
    const firstUid = surfaced.candidates[0]!.uid;
    const before = structuredClone(useGameStateStore.getState().gameState);

    expect(dispatchCurrentDecision({
      type: 'effectPickResolve',
      pickedUid: firstUid,
      pickedUids: [firstUid],
    })).toMatchObject({ ok: false });
    expect(useGameStateStore.getState().gameState).toEqual(before);
    expect(useGameStateStore.getState().pendingEffectPick?.decisionId).toBe(surfaced.decisionId);

    expect(dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: null }))
      .toMatchObject({ ok: false });
    expect(useGameStateStore.getState().gameState).toEqual(before);
    expect(useGameStateStore.getState().pendingEffectPick?.decisionId).toBe(surfaced.decisionId);
  });

  it('uses the persisted engine pick as authority when the public prompt is modified', () => {
    setHuman('self');
    const s = createEmptyGameState();
    s.players.self.hand = ['A', 'B', 'C'];
    s.players.self.deck = ['A'];
    runEffect(s, {
      kind: 'sequence',
      steps: [
        discard2,
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } } as never,
      ],
    }, ctx());
    runAllUntilEmpty(s);

    useGameStateStore.getState().setGameState(s);
    const canonicalSurface = useGameStateStore.getState().pendingEffectPick!;
    useGameStateStore.getState().setPendingEffectPick({
      ...canonicalSurface,
      nMin: 0,
      nMax: canonicalSurface.candidates.length,
    });
    const modified = useGameStateStore.getState().pendingEffectPick!;
    const before = structuredClone(useGameStateStore.getState().gameState);

    expect(dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: null }))
      .toEqual({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().gameState).toEqual(before);
    expect(useGameStateStore.getState().pendingEffectPick?.decisionId).toBe(modified.decisionId);
  });

  it('mandatory pick clamps its minimum to the feasible candidates and resumes the continuation', () => {
    setHuman('self');
    const s = createEmptyGameState();
    s.players.self.hand = ['A'];
    s.players.self.deck = ['B', 'C'];
    const effect: Effect = {
      kind: 'sequence',
      steps: [
        discard2,
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } } as never,
      ],
    };

    runEffect(s, effect, ctx());
    runAllUntilEmpty(s);
    const pending = _drainPendingEffectPickSide();
    expect(pending?.candidates).toHaveLength(1);

    useGameStateStore.getState().setGameState(s);
    useGameStateStore.getState().setPendingEffectPick(pending);
    const surfaced = useGameStateStore.getState().pendingEffectPick!;
    expect(surfaced.nMin).toBe(1);
    expect(surfaced.nMax).toBe(1);

    expect(dispatchCurrentDecision({
      type: 'effectPickResolve',
      pickedUid: surfaced.candidates[0]!.uid,
    })).toMatchObject({ ok: true });
    expect(useGameStateStore.getState().gameState?.players.self.remove).toEqual(['A']);
    expect(useGameStateStore.getState().gameState?.players.self.hand).toEqual(['B']);
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
  });

  it('does not partially pay an exact chain prerequisite when fewer than the requested cards exist', () => {
    setHuman('self');
    const s = createEmptyGameState();
    s.players.self.hand = ['A'];
    s.players.self.deck = ['B', 'C'];

    runEffect(s, {
      kind: 'chain',
      steps: [
        exactDiscard2,
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } } as never,
      ],
    }, ctx());
    runAllUntilEmpty(s);

    expect(_drainPendingEffectPickSide()).toBeNull();
    expect(s.players.self.hand).toEqual(['A']);
    expect(s.players.self.remove).toEqual([]);
    expect(s.players.self.deck).toEqual(['B', 'C']);
  });

  it('applies an explicit exact minimum at the producer boundary even without a chain wrapper', () => {
    setHuman('self');
    const s = createEmptyGameState();
    s.players.self.hand = ['A'];

    runEffect(s, exactDiscard2, ctx());
    runAllUntilEmpty(s);

    expect(_drainPendingEffectPickSide()).toBeNull();
    expect(s.players.self.hand).toEqual(['A']);
    expect(s.players.self.remove).toEqual([]);
  });

  it('human 経路: applyPickAndContinuation(pickedUids 2枚) → 2枚とも hand→remove + bind 2枚', () => {
    setHuman('self');
    const s = createEmptyGameState();
    s.players.self.hand = ['A', 'B', 'C'];
    const c = ctx();
    runEffect(s, discard2, c);
    runAllUntilEmpty(s);
    const pending = _drainPendingEffectPickSide();
    expect(pending?.atomVerb).toBe('discard');
    expect(pending?.nMin).toBe(2);
    const uids = pending!.candidates.slice(0, 2).map(x => x.uid);
    applyPickAndContinuation(s, pending!, uids[0]!, uids);
    setHuman(null);
    expect(s.players.self.hand, '2枚除去 (旧: 1枚 collapse)').toEqual(['C']);
    expect(s.players.self.remove.length).toBe(2);
  });

  it('AI drain 経路: drainAiEffectPicks → 2枚とも hand→remove', () => {
    const s = createEmptyGameState();
    s.players.self.hand = ['A', 'B', 'C'];
    runEffect(s, discard2, ctx());
    runAllUntilEmpty(s);
    drainAiEffectPicks(s, new HeuristicPolicy());
    expect(s.players.self.hand.length, '2枚除去').toBe(1);
    expect(s.players.self.remove.length).toBe(2);
  });

  it('AI also resolves a mandatory shortage with the maximum feasible selection', () => {
    const s = createEmptyGameState();
    s.players.self.hand = ['A'];
    s.players.self.deck = ['B', 'C'];
    runEffect(s, {
      kind: 'sequence',
      steps: [
        discard2,
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } } as never,
      ],
    }, ctx());
    runAllUntilEmpty(s);
    drainAiEffectPicks(s, new HeuristicPolicy());
    expect(s.players.self.remove).toEqual(['A']);
    expect(s.players.self.hand).toEqual(['B']);
    expect(s.players.self.deck).toEqual(['C']);
  });

  it('AI 同期 walk 経路: resolveEffectPicks → target 2枚に解決 + bind 2枚', () => {
    const s = createEmptyGameState();
    s.players.self.hand = ['A', 'B', 'C'];
    const c = ctx();
    const resolved = resolveEffectPicks(s, discard2, c, { byPlayer: 'self' });
    const args = (resolved as { args?: { target?: unknown } }).args;
    expect(Array.isArray(args?.target) && (args!.target as string[]).length, 'target 2枚 (旧: 1枚)').toBe(2);
    runEffect(s, resolved, c);
    runAllUntilEmpty(s);
    expect(s.players.self.hand.length).toBe(1);
    expect(s.players.self.remove.length).toBe(2);
    expect((c.bindings['$d'] as unknown[]).length, 'bind 2枚 (handReveal ★未対応(3) 解消)').toBe(2);
  });

  it('n:1 不変: 単一 pick は従来どおり 1枚 (byte 互換)', () => {
    const s = createEmptyGameState();
    s.players.self.hand = ['A', 'B', 'C'];
    const c = ctx();
    const resolved = resolveEffectPicks(s, { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } } as never, c, { byPlayer: 'self' });
    runEffect(s, resolved, c);
    runAllUntilEmpty(s);
    expect(s.players.self.hand.length).toBe(2);
    expect(s.players.self.remove.length).toBe(1);
  });

  it('shipped 回帰: B04005 a1【登場時】draw2 + discard2 が AI 経路で 2枚リムーブされる', () => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    registerCardDef(B04005);
    engineCards.register(B04005);
    registerTriggeredListener();
    let s = createEmptyGameState();
    s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.deck = ['A', 'B', 'C'];
    s.players.self.hand = [];
    s.players.self.remove = ['B04005'];
    s = produce(s, (d) => {
      runEffect(d, { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', cardId: 'B04005', viaEffect: true, target: { query: { area: 'remove', side: 'self' } } } } as never, ctx());
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });
    // draw2 (hand+2) → discard2 (hand-2, remove+2)
    expect(s.players.self.hand.length, 'draw2 - discard2 = 0 (旧 collapse: 1枚残留)').toBe(0);
    expect(s.players.self.remove.length, '手札から 2枚 remove').toBe(2);
  });
});
