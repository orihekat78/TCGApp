// BUG-136 — deckToBottomBound「残りを好きな順番でデッキの下に移す」の順序選択。
// human 所有 & 2 枚以上を底へ移したとき __pendingDeckReorderSide を set し、deckReorderResolve で
// 底ブロックを human が選んだ順に並べ替える。AI / spectator (humanSide が当該 player でない) では
// set しないため byte-equal (公開順固定 = 合法な一choice、rules/13 §捜査X / rules/26)。
//
// rules: 13-keywords.md (§捜査X「好きな順番でデッキの下に移す」), 15-abilities-effects.md, 26-qa-deck-refresh.md
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { produce } from 'immer';
import { createEmptyGameState } from '@/engine/state-factory';
import { runAtom, _drainPendingDeckReorderSide } from '@/engine/effect/atom-handlers';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import type { EffectCtx, GameState } from '@/engine/types';

const g = globalThis as { __humanPlayerSide?: 'self' | 'opp' | null; __pendingDeckReorderSide?: unknown };
const setHuman = (s: 'self' | 'opp' | null) => { g.__humanPlayerSide = s; };

function ctxWithRest(cardIds: string[]): EffectCtx {
  return {
    source: { cardId: 'SRC', uid: 'src#0', abilityId: 'a1', player: 'self', area: 'scene' },
    bindings: { $rest: cardIds.map((cardId) => ({ kind: 'card', cardId, area: 'deck', player: 'self' })) },
  } as unknown as EffectCtx;
}

beforeEach(() => {
  g.__pendingDeckReorderSide = null;
  useGameStateStore.getState().setGameState(null);
  useGameStateStore.getState().setPendingDeckReorder(null);
});
afterAll(() => setHuman(null));

describe('BUG-136 — deckToBottomBound 順序選択 side-channel', () => {
  it('human 所有 & 2 枚以上 → __pendingDeckReorderSide が底ブロックで set される', () => {
    setHuman('self');
    const s0 = produce(createEmptyGameState(), (d) => {
      d.players.self.deck = ['C', 'D', 'E', 'A', 'B']; // C,D,E が「残り」、A,B が既存底
    });
    const s1 = produce(s0, (d) => {
      runAtom(d, 'deckToBottomBound', { player: 'self', bindKey: '$rest' }, ctxWithRest(['C', 'D', 'E']));
    });
    // C,D,E が底へ → deck = [A, B, C, D, E]
    expect(s1.players.self.deck).toEqual(['A', 'B', 'C', 'D', 'E']);
    const side = _drainPendingDeckReorderSide();
    expect(side).toEqual({ player: 'self', cardIds: ['C', 'D', 'E'] });
    setHuman(null);
  });

  it('AI / spectator (humanSide=null) → side-channel を set しない (byte-equal)', () => {
    setHuman(null);
    const s0 = produce(createEmptyGameState(), (d) => { d.players.self.deck = ['C', 'D', 'E', 'A', 'B']; });
    produce(s0, (d) => { runAtom(d, 'deckToBottomBound', { player: 'self', bindKey: '$rest' }, ctxWithRest(['C', 'D', 'E'])); });
    expect(_drainPendingDeckReorderSide()).toBeNull();
  });

  it('1 枚のみ → 順序が無意味なので set しない', () => {
    setHuman('self');
    const s0 = produce(createEmptyGameState(), (d) => { d.players.self.deck = ['C', 'A', 'B']; });
    produce(s0, (d) => { runAtom(d, 'deckToBottomBound', { player: 'self', bindKey: '$rest' }, ctxWithRest(['C'])); });
    expect(_drainPendingDeckReorderSide()).toBeNull();
    setHuman(null);
  });

  it('相手所有 (humanSide=self, player=opp) → 自分の並べ替え対象でないので set しない', () => {
    setHuman('self');
    const s0 = produce(createEmptyGameState(), (d) => { d.players.opp.deck = ['C', 'D', 'E', 'A', 'B']; });
    const ctxOpp = {
      source: { cardId: 'SRC', uid: 'o#0', abilityId: 'a1', player: 'opp', area: 'scene' },
      bindings: { $rest: ['C', 'D', 'E'].map((cardId) => ({ kind: 'card', cardId, area: 'deck', player: 'opp' })) },
    } as unknown as EffectCtx;
    produce(s0, (d) => { runAtom(d, 'deckToBottomBound', { player: 'opp', bindKey: '$rest' }, ctxOpp); });
    expect(_drainPendingDeckReorderSide()).toBeNull();
    setHuman(null);
  });
});

describe('BUG-136 — deckReorderResolve dispatch', () => {
  it('底ブロックを order で並べ替える (E,D,C 順)', () => {
    const s0 = produce(createEmptyGameState(), (d) => {
      d.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
      d.players.self.deck = ['A', 'B', 'C', 'D', 'E'];
    });
    useGameStateStore.getState().setGameState(s0);
    useGameStateStore.getState().setPendingDeckReorder({ player: 'self', cardIds: ['C', 'D', 'E'] });

    const r = dispatchEngineAction({ type: 'deckReorderResolve', order: ['E', 'D', 'C'] });
    expect(r.ok).toBe(true);
    const after = useGameStateStore.getState();
    expect(after.gameState!.players.self.deck).toEqual(['A', 'B', 'E', 'D', 'C']);
    expect(after.pendingDeckReorder).toBeNull(); // 解決で消化
  });

  it('order が底ブロックの permutation でない場合は何もしない (防御)', () => {
    const s0 = produce(createEmptyGameState(), (d) => {
      d.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
      d.players.self.deck = ['A', 'B', 'C', 'D', 'E'];
    });
    useGameStateStore.getState().setGameState(s0);
    useGameStateStore.getState().setPendingDeckReorder({ player: 'self', cardIds: ['C', 'D', 'E'] });

    dispatchEngineAction({ type: 'deckReorderResolve', order: ['X', 'Y', 'Z'] }); // 不正
    const after = useGameStateStore.getState();
    expect(after.gameState!.players.self.deck).toEqual(['A', 'B', 'C', 'D', 'E']); // 不変
  });
});

// 水平展開: 捜査X (souza) も「(defender の)好きな順番でデッキの下に移す」(rules/13) — 同じ side-channel を共有。
describe('BUG-136 水平展開 — souza (捜査X) も順序選択を surface', () => {
  // souza は defender=opp 相対 (souzaX.ts)。AI が souza 使用 (source.player='opp') → defender=self=human。
  const ctxAiUser = {
    source: { cardId: 'SRC', uid: 'o#0', abilityId: 'a1', player: 'opp', area: 'scene' },
    bindings: {},
  } as unknown as EffectCtx;

  it('defender が human & 2 枚以上 → souza が __pendingDeckReorderSide を set (底=移した top)', () => {
    setHuman('self');
    const s0 = produce(createEmptyGameState(), (d) => { d.players.self.deck = ['T1', 'T2', 'T3', 'B1', 'B2']; });
    // AI(opp) が souza X=3 を self(human) のデッキに対して使用 (player:'opp' = source の相手 = self)
    const s1 = produce(s0, (d) => { runAtom(d, 'souza', { player: 'opp', x: 3 }, ctxAiUser); });
    // top 3 (T1,T2,T3) が底へ → deck = [B1, B2, T1, T2, T3]
    expect(s1.players.self.deck).toEqual(['B1', 'B2', 'T1', 'T2', 'T3']);
    expect(_drainPendingDeckReorderSide()).toEqual({ player: 'self', cardIds: ['T1', 'T2', 'T3'] });
    setHuman(null);
  });

  it('AI defender (humanSide=null) → set しない (byte-equal)', () => {
    setHuman(null);
    const s0 = produce(createEmptyGameState(), (d) => { d.players.self.deck = ['T1', 'T2', 'T3', 'B1']; });
    produce(s0, (d) => { runAtom(d, 'souza', { player: 'opp', x: 3 }, ctxAiUser); });
    expect(_drainPendingDeckReorderSide()).toBeNull();
  });
});
