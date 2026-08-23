// BUG-136 — deckToBottomBound「残りを好きな順番でデッキの下に移す」の順序選択。
// human 所有 & 2 枚以上を底へ移したとき __pendingDeckReorderSide を set し、deckReorderResolve で
// 底ブロックを human が選んだ順に並べ替える。AI / spectator (humanSide が当該 player でない) では
// set しないため byte-equal (公開順固定 = 合法な一choice、rules/13 §捜査X / rules/26)。
//
// rules: 13-keywords.md (§捜査X「好きな順番でデッキの下に移す」), 15-abilities-effects.md, 26-qa-deck-refresh.md
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { produce } from 'immer';
import { createEmptyGameState } from '@/engine/state-factory';
import {
  runAtom,
  _drainPendingDeckReorderSide,
  _drainPendingDeckRevealSide,
  _peekPendingDeckRevealSide,
} from '@/engine/effect/atom-handlers';
import { queuePendingDeckRevealSide } from '@/engine/effect/atom-handlers/_shared';
import {
  hydratePendingRuntimeState,
  persistPendingRuntimeState,
  resetPendingRuntimeState,
} from '@/engine/effect/runtime-state';
import { dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { bindPendingDecision } from '@/ui/hooks/useEngineDispatch/types';
import { useGameStateStore } from '@/ui/state/store';
import type { EffectCtx, GameState } from '@/engine/types';
import { cardOccurrenceUid, cardOccurrenceWitness } from '@/engine/target/card-occurrence';
import { mutate } from '@/engine/mutate';

const g = globalThis as { __humanPlayerSide?: 'self' | 'opp' | null; __pendingDeckReorderSide?: unknown };
const setHuman = (s: 'self' | 'opp' | null) => { g.__humanPlayerSide = s; };

function ctxWithRest(state: GameState, cardIds: string[], player: 'self' | 'opp' = 'self'): EffectCtx {
  const witness = cardOccurrenceWitness(state, player, 'deck');
  const deck = state.players[player].deck;
  const usedIndexes = new Set<number>();
  return {
    source: { cardId: 'SRC', uid: 'src#0', abilityId: 'a1', player, area: 'scene' },
    bindings: { $rest: cardIds.map((cardId) => {
      const index = deck.findIndex((value, candidateIndex) => (
        value === cardId && !usedIndexes.has(candidateIndex)
      ));
      if (index < 0) throw new Error(`missing exact deck occurrence: ${cardId}`);
      usedIndexes.add(index);
      return {
        kind: 'card', cardId, area: 'deck', player, index,
        uid: cardOccurrenceUid(player, 'deck', cardId, index),
        occurrenceWitness: witness,
      };
    }) },
  } as unknown as EffectCtx;
}

function surfaceDeckReorder(state: GameState) {
  persistPendingRuntimeState(state);
  expect(useGameStateStore.getState().setGameState(state, { preserveRuntime: true })).toBe(true);
  surfacePendingSideChannels();
  return useGameStateStore.getState().pendingDeckReorder!;
}

beforeEach(() => {
  resetPendingRuntimeState();
  g.__pendingDeckReorderSide = null;
  useGameStateStore.getState().setGameState(null);
  useGameStateStore.getState().setPendingDeckReorder(null);
});
afterAll(() => setHuman(null));

describe('BUG-136 — deckToBottomBound 順序選択 side-channel', () => {
  it('human 所有 & 2 枚以上 → confirmまでdeck不変でreorder pendingがsetされる', () => {
    setHuman('self');
    const s0 = produce(createEmptyGameState(), (d) => {
      d.players.self.deck = ['C', 'D', 'E', 'A', 'B']; // C,D,E が「残り」、A,B が既存底
    });
    const s1 = produce(s0, (d) => {
      runAtom(d, 'deckToBottomBound', { player: 'self', bindKey: '$rest' }, ctxWithRest(d, ['C', 'D', 'E']));
    });
    expect(s1.players.self.deck).toEqual(['C', 'D', 'E', 'A', 'B']);
    const side = _drainPendingDeckReorderSide();
    expect(side).toMatchObject({
      player: 'self',
      cardIds: ['C', 'D', 'E'],
      deckSnapshot: ['C', 'D', 'E', 'A', 'B'],
      occurrences: [
        { cardId: 'C', index: 0 },
        { cardId: 'D', index: 1 },
        { cardId: 'E', index: 2 },
      ],
    });
    setHuman(null);
  });

  it('AI / spectator (humanSide=null) → side-channel を set しない (byte-equal)', () => {
    setHuman(null);
    const s0 = produce(createEmptyGameState(), (d) => { d.players.self.deck = ['C', 'D', 'E', 'A', 'B']; });
    produce(s0, (d) => { runAtom(d, 'deckToBottomBound', { player: 'self', bindKey: '$rest' }, ctxWithRest(d, ['C', 'D', 'E'])); });
    expect(_drainPendingDeckReorderSide()).toBeNull();
  });

  it('1 枚のみ → 順序が無意味なので set しない', () => {
    setHuman('self');
    const s0 = produce(createEmptyGameState(), (d) => { d.players.self.deck = ['C', 'A', 'B']; });
    produce(s0, (d) => { runAtom(d, 'deckToBottomBound', { player: 'self', bindKey: '$rest' }, ctxWithRest(d, ['C'])); });
    expect(_drainPendingDeckReorderSide()).toBeNull();
    setHuman(null);
  });

  it('order:preserve はhuman所有でもmodalを出さずbinding順で即時に底へ移す', () => {
    setHuman('self');
    const s0 = produce(createEmptyGameState(), (d) => { d.players.self.deck = ['C', 'D', 'E', 'A', 'B']; });
    const s1 = produce(s0, (d) => {
      runAtom(d, 'deckToBottomBound', { player: 'self', bindKey: '$rest', order: 'preserve' }, ctxWithRest(d, ['C', 'D', 'E']));
    });

    expect(s1.players.self.deck).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(_drainPendingDeckReorderSide()).toBeNull();
    setHuman(null);
  });

  it('相手所有 (humanSide=self, player=opp) → 自分の並べ替え対象でないので set しない', () => {
    setHuman('self');
    const s0 = produce(createEmptyGameState(), (d) => { d.players.opp.deck = ['C', 'D', 'E', 'A', 'B']; });
    produce(s0, (d) => {
      runAtom(d, 'deckToBottomBound', { player: 'opp', bindKey: '$rest' }, ctxWithRest(d, ['C', 'D', 'E'], 'opp'));
    });
    expect(_drainPendingDeckReorderSide()).toBeNull();
    setHuman(null);
  });
});

describe('BUG-136 — deckReorderResolve dispatch', () => {
  it('底ブロックを order で並べ替える (E,D,C 順)', () => {
    setHuman('self');
    const state = createEmptyGameState();
    state.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    state.players.self.deck = ['A', 'B', 'C', 'D', 'E'];
    runAtom(state, 'deckToBottomBound', { player: 'self', bindKey: '$rest' }, ctxWithRest(state, ['C', 'D', 'E']));
    const pending = surfaceDeckReorder(state);
    const r = dispatchEngineAction(bindPendingDecision(pending, { type: 'deckReorderResolve', order: ['E', 'D', 'C'] }));
    expect(r.ok).toBe(true);
    const after = useGameStateStore.getState();
    expect(after.gameState!.players.self.deck).toEqual(['A', 'B', 'E', 'D', 'C']);
    expect(after.pendingDeckReorder).toBeNull(); // 解決で消化
  });

  it('order が底ブロックの permutation でない場合は何もしない (防御)', () => {
    setHuman('self');
    const state = createEmptyGameState();
    state.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    state.players.self.deck = ['A', 'B', 'C', 'D', 'E'];
    runAtom(state, 'deckToBottomBound', { player: 'self', bindKey: '$rest' }, ctxWithRest(state, ['C', 'D', 'E']));
    const pending = surfaceDeckReorder(state);
    const result = dispatchEngineAction(bindPendingDecision(pending, { type: 'deckReorderResolve', order: ['X', 'Y', 'Z'] })); // 不正
    const after = useGameStateStore.getState();
    expect(result.ok).toBe(false);
    expect(after.gameState!.players.self.deck).toEqual(['A', 'B', 'C', 'D', 'E']); // 不変
  });

  it('same-ID deck snapshot restored after an epoch change cannot reuse the stale reorder authority', () => {
    setHuman('self');
    const state = createEmptyGameState();
    state.players.self.deck = ['A', 'B', 'C', 'D', 'E'];
    runAtom(state, 'deckToBottomBound', { player: 'self', bindKey: '$rest' }, ctxWithRest(state, ['C', 'D', 'E']));

    mutate.deck.draw(state, 'self', 1);
    expect(state.players.self.hand.pop()).toBe('A');
    mutate.deck.toTop(state, 'self', ['A']);
    expect(state.players.self.deck).toEqual(['A', 'B', 'C', 'D', 'E']);

    const pending = surfaceDeckReorder(state);
    const before = JSON.stringify(useGameStateStore.getState().gameState);
    const result = dispatchEngineAction(bindPendingDecision(pending, {
      type: 'deckReorderResolve', order: ['E', 'D', 'C'],
    }));

    expect(result.ok).toBe(false);
    expect(JSON.stringify(useGameStateStore.getState().gameState)).toBe(before);
  });
});

describe('BUG-136 horizontal — deckBottomReorderBound exact authority', () => {
  it('pins the current bottom occurrences and deck epoch before surfacing a human reorder', () => {
    setHuman('self');
    const state = createEmptyGameState();
    state.players.self.deck = ['TAIL', 'MOVED', 'MOVED'];
    const ctx = ctxWithRest(state, ['MOVED', 'MOVED']);

    runAtom(state, 'deckBottomReorderBound', { player: 'self', bindKey: '$rest' }, ctx);

    expect(_drainPendingDeckReorderSide()).toMatchObject({
      player: 'self',
      cardIds: ['MOVED', 'MOVED'],
      deckSnapshot: ['TAIL', 'MOVED', 'MOVED'],
      occurrences: [
        { cardId: 'MOVED', index: 1 },
        { cardId: 'MOVED', index: 2 },
      ],
      occurrenceWitness: cardOccurrenceWitness(state, 'self', 'deck'),
      ctx: { source: ctx.source },
    });
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
    expect(_drainPendingDeckRevealSide()).toMatchObject({
      player: 'self',
      visibility: 'public',
      viewer: 'all',
      revealed: ['T1', 'T2', 'T3'],
      matched: null,
      presentation: 'reveal-to-bottom',
      source: { cardId: 'SRC', abilityId: 'a1', uid: 'o#0' },
    });
    expect(_drainPendingDeckReorderSide()).toMatchObject({
      player: 'self',
      cardIds: ['T1', 'T2', 'T3'],
      deckSnapshot: ['B1', 'B2', 'T1', 'T2', 'T3'],
      occurrences: [
        { cardId: 'T1', index: 2 },
        { cardId: 'T2', index: 3 },
        { cardId: 'T3', index: 4 },
      ],
      occurrenceWitness: cardOccurrenceWitness(s1, 'self', 'deck'),
      ctx: { source: ctxAiUser.source },
    });
    setHuman(null);
  });

  it('AI defender (humanSide=null) → set しない (byte-equal)', () => {
    setHuman(null);
    const s0 = produce(createEmptyGameState(), (d) => { d.players.self.deck = ['T1', 'T2', 'T3', 'B1']; });
    produce(s0, (d) => { runAtom(d, 'souza', { player: 'opp', x: 3 }, ctxAiUser); });
    expect(_drainPendingDeckRevealSide()).toBeNull();
    expect(_drainPendingDeckReorderSide()).toBeNull();
  });

  it('JSON roundtrip preserves the public reveal and exact reorder authority together', () => {
    setHuman('self');
    const state = structuredClone(produce(createEmptyGameState(), (draft) => {
      draft.players.self.deck = ['T1', 'T2', 'T3', 'B1', 'B2'];
      runAtom(draft, 'souza', { player: 'opp', x: 3 }, ctxAiUser);
    }));
    persistPendingRuntimeState(state);
    const restored = JSON.parse(JSON.stringify(state)) as GameState;
    resetPendingRuntimeState();

    expect(hydratePendingRuntimeState(restored)).toBe(true);
    expect(_peekPendingDeckRevealSide()).toMatchObject({
      player: 'self', visibility: 'public', viewer: 'all',
      revealed: ['T1', 'T2', 'T3'], presentation: 'reveal-to-bottom',
    });
    expect(_drainPendingDeckReorderSide()).toMatchObject({
      player: 'self',
      cardIds: ['T1', 'T2', 'T3'],
      occurrences: [
        { cardId: 'T1', index: 2 },
        { cardId: 'T2', index: 3 },
        { cardId: 'T3', index: 4 },
      ],
      occurrenceWitness: expect.any(String),
    });
  });
});

describe('BUG-331 — reveal presentation follows the actual bottom operation', () => {
  it.each([
    { visibility: 'public' as const, viewer: 'all' as const },
    { visibility: 'private' as const, viewer: 'self' as const },
  ])('marks an empty $visibility remainder as reveal-complete', ({ visibility, viewer }) => {
    setHuman('self');
    const state = createEmptyGameState();
    const ctx = {
      source: { cardId: 'SRC', uid: 'o#0', abilityId: 'a1', player: 'self', area: 'scene' },
      bindings: { $rest: [] },
    } as EffectCtx;
    queuePendingDeckRevealSide({
      player: 'self', visibility, viewer, revealed: ['MATCH'], matched: 'MATCH',
      source: { cardId: 'SRC', uid: 'o#0', abilityId: 'a1' },
    });

    produce(state, (draft) => {
      runAtom(draft, 'deckToBottomBound', { player: 'self', bindKey: '$rest' }, ctx);
    });

    expect(_drainPendingDeckRevealSide()).toMatchObject({ presentation: 'reveal-complete' });
  });

  it.each([
    { order: 'preserve' as const, presentation: 'reveal-to-bottom' },
    { order: 'shuffle' as const, presentation: 'reveal-to-bottom-randomized' },
  ])('$order bottom operation marks the matching reveal as $presentation', ({ order, presentation }) => {
    setHuman(null);
    const state = createEmptyGameState();
    state.players.self.deck = ['A', 'B', 'TAIL'];
    const ctx = ctxWithRest(state, ['A', 'B']);
    queuePendingDeckRevealSide({
      player: 'self', visibility: 'public', viewer: 'all',
      revealed: ['A', 'B'], matched: null,
      source: { cardId: 'SRC', uid: 'src#0', abilityId: 'a1' },
    });

    produce(state, (draft) => {
      runAtom(draft, 'deckToBottomBound', { player: 'self', bindKey: '$rest', order }, ctx);
    });

    expect(_drainPendingDeckRevealSide()).toMatchObject({ presentation });
  });

  it('marks only the newest reveal with the exact player/source identity', () => {
    setHuman(null);
    queuePendingDeckRevealSide({
      player: 'self', visibility: 'public', viewer: 'all', revealed: ['OLD'], matched: null,
      source: { cardId: 'OTHER', uid: 'other#1', abilityId: 'a1' },
    });
    const state = createEmptyGameState();
    state.players.self.deck = ['A', 'B', 'TAIL'];
    const ctx = ctxWithRest(state, ['A', 'B']);
    queuePendingDeckRevealSide({
      player: 'self', visibility: 'public', viewer: 'all', revealed: ['A', 'B'], matched: null,
      source: { cardId: 'SRC', uid: 'src#0', abilityId: 'a1' },
    });

    produce(state, (draft) => {
      runAtom(draft, 'deckToBottomBound', { player: 'self', bindKey: '$rest', order: 'preserve' }, ctx);
    });

    expect(_drainPendingDeckRevealSide()?.presentation).toBeUndefined();
    expect(_drainPendingDeckRevealSide()?.presentation).toBe('reveal-to-bottom');
  });

  it('restores the legacy full-shuffle presentation when deckShuffle actually runs', () => {
    setHuman(null);
    const state = createEmptyGameState();
    state.players.self.deck = ['A', 'B', 'TAIL'];
    const ctx = ctxWithRest(state, ['A', 'B']);
    queuePendingDeckRevealSide({
      player: 'self', visibility: 'public', viewer: 'all', revealed: ['A', 'B'], matched: null,
      source: { cardId: 'SRC', uid: 'src#0', abilityId: 'a1' },
    });

    produce(state, (draft) => {
      runAtom(draft, 'deckToBottomBound', { player: 'self', bindKey: '$rest', order: 'preserve' }, ctx);
      runAtom(draft, 'deckShuffle', { player: 'self' }, ctx);
    });

    expect(_drainPendingDeckRevealSide()?.presentation).toBeUndefined();
  });
});
