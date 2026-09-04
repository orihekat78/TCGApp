import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetCardDefRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate/index';
import { runAtom, _drainPendingDeckReorderSide } from '@/engine/effect/atom-handlers';
import { run as runEffect } from '@/engine/effect/resolver';
import { applyDeckReorderAndContinuation } from '@/engine/effect/apply-pick';
import { deckOccurrenceAuthority } from '@/engine/effect/deck-occurrence-authority';
import type { Candidate, CardDef, Effect, EffectCtx, GameState } from '@/engine/types';
import type { PendingEffectPickSide } from '@/engine/effect/pending-state';

const HOST = card('HOST', 5);
const L5 = card('L5', 5);
const L4 = card('L4', 4);
const L1 = card('L1', 1);

const globals = globalThis as {
  __humanPlayerSide?: 'self' | 'opp' | null;
  __pendingDeckReorderSide?: unknown;
  __pendingEffectPickQueue?: PendingEffectPickSide[];
};

function card(id: string, level: number): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['赤'], level,
    ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  };
}

function base(): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  return state;
}

function ctxFor(state: GameState): EffectCtx {
  const source = mutate.scene.enter(state, 'self', 'HOST', {});
  return {
    source: { player: 'self', uid: source.uid, cardId: 'HOST', abilityId: 'a1', area: 'scene' },
    bindings: {},
    dyn: { runtimePickOwnerKnown: true, runtimeHumanPlayer: 'self' },
  };
}

beforeEach(() => {
  resetCardDefRegistry();
  for (const def of [HOST, L5, L4, L1]) registerCardDef(def);
  globals.__humanPlayerSide = 'self';
  globals.__pendingDeckReorderSide = null;
  globals.__pendingEffectPickQueue = [];
});

afterAll(() => {
  globals.__humanPlayerSide = null;
  globals.__pendingDeckReorderSide = null;
  globals.__pendingEffectPickQueue = [];
});

describe('post-fix deck reorder continuation', () => {
  it('resumes the B08057 conditional/sceneToDeck suffix after a legacy reorder confirm', () => {
    const state = base();
    const ctx = ctxFor(state);
    mutate.scene.enter(state, 'opp', 'L1', {});
    state.players.self.deck = ['HOST', 'L5', 'L4', 'L1'];
    ctx.bindings['$moved'] = [1, 2, 3].map(index => {
      const authority = deckOccurrenceAuthority(state, 'self', index);
      if (!authority) throw new Error(`missing deck occurrence authority at ${index}`);
      return authority;
    });
    const effect: Effect = {
      kind: 'sequence',
      steps: [
        { kind: 'atom', verb: 'deckBottomReorderBound', args: { player: 'self', bindKey: '$moved' } },
        {
          kind: 'conditional',
          if: { kind: 'boundCountCompare', bindKey: '$moved', cmp: 'eq', n: 3 },
          then: { kind: 'atom', verb: 'sceneToDeck', args: { player: 'self', side: 'opp', max: 1, pos: 'bottom' } },
        },
      ],
    };

    runEffect(state, effect, ctx);
    const pending = _drainPendingDeckReorderSide();
    expect(pending?.continuation).toBeDefined();

    applyDeckReorderAndContinuation(state, pending!, ['L1', 'L4', 'L5']);

    expect(state.players.self.deck).toEqual(['HOST', 'L1', 'L4', 'L5']);
    expect(globals.__pendingEffectPickQueue).toHaveLength(1);
    expect(globals.__pendingEffectPickQueue?.[0]?.atomVerb).toBe('sceneToDeck');
  });
});

describe('post-fix zero-candidate sceneEnter scope', () => {
  it('surfaces the explicit optional decision only for the human hand area', () => {
    const handState = base();
    const handCtx = ctxFor(handState);
    runAtom(handState, 'sceneEnter', { player: 'self', from: 'hand', max: 1, viaEffect: true }, handCtx);
    expect(globals.__pendingEffectPickQueue).toHaveLength(1);
    expect(globals.__pendingEffectPickQueue?.[0]).toMatchObject({ atomVerb: 'sceneEnter', candidates: [], nMin: 0 });

    for (const area of ['remove', 'deck', 'evidence'] as const) {
      globals.__pendingEffectPickQueue = [];
      const state = base();
      const ctx = ctxFor(state);
      runAtom(state, 'sceneEnter', { player: 'self', from: area, max: 1, viaEffect: true }, ctx);
      expect(globals.__pendingEffectPickQueue, `${area} keeps legacy no-pending behavior`).toHaveLength(0);
      expect(ctx.dyn?.chainStepNoApply, `${area} keeps legacy chain-break behavior`).toBe(true);
    }
  });
});
