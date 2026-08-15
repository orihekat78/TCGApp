import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetCardDefRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate/index';
import { resolve } from '@/engine/resolve/index';
import { run as runEffect } from '@/engine/effect/resolver';
import { applyDeckReorderAndContinuation } from '@/engine/effect/apply-pick';
import { _drainPendingDeckReorderSide } from '@/engine/effect/atom-handlers';
import { deckOccurrenceAuthority } from '@/engine/effect/deck-occurrence-authority';
import type { Candidate, CardDef, Effect, EffectCtx, EffectStackEntry, GameState } from '@/engine/types';

const globals = globalThis as {
  __humanPlayerSide?: 'self' | 'opp' | null;
  __pendingDeckReorderSide?: unknown;
  __pendingEffectPickQueue?: unknown[];
};

function card(id: string): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['赤'], level: 1,
    ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  };
}

function base(): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  return state;
}

function deckCandidates(state: GameState, ids: string[]): Candidate[] {
  const used = new Set<number>();
  return ids.map((id) => {
    const index = state.players.self.deck.findIndex((cardId, candidateIndex) => (
      cardId === id && !used.has(candidateIndex)
    ));
    const occurrence = deckOccurrenceAuthority(state, 'self', index);
    if (!occurrence) throw new Error(`missing deck occurrence for ${id}`);
    used.add(index);
    return occurrence;
  });
}

function entry(state: GameState, id: string, bindKey: string, ids: string[]): EffectStackEntry {
  return {
    id,
    source: { player: 'self', cardId: 'HOST', uid: 'host' },
    triggeredBy: { hook: 'manual' },
    triggeredAt: { turn: state.turn.number, phase: state.turn.phase, nano: 0 },
    effect: { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey } },
    bindings: {
      [bindKey]: deckCandidates(state, ids),
    },
    state: 'pending',
  };
}

function ctxWithSource(state: GameState): EffectCtx {
  const host = mutate.scene.enter(state, 'self', 'HOST', {});
  return {
    source: { player: 'self', uid: host.uid, cardId: 'HOST', abilityId: 'a1', area: 'scene' },
    bindings: {},
    dyn: { runtimePickOwnerKnown: true, runtimeHumanPlayer: 'self' },
  };
}

function charCandidate(cardId: string, uid: string): Candidate {
  return { kind: 'char', cardId, uid, player: 'self', area: 'scene' } as Candidate;
}

function ctxLossEffect(pause: Effect): Effect {
  return {
    kind: 'sequence',
    steps: [
      {
        kind: 'parallel',
        steps: [{
          kind: 'sequence',
          steps: [
            {
              kind: 'custom',
              fn: (_state, branchCtx) => {
                branchCtx.bindings = {
                  ...branchCtx.bindings,
                  $target: [charCandidate('A', 'branch-a')],
                };
              },
            },
            pause,
          ],
        }],
      },
      {
        kind: 'custom',
        fn: (state, outerCtx) => {
          const target = outerCtx.bindings.$target?.[0] as { cardId?: string } | undefined;
          state.players.self.hand.push(target?.cardId ?? 'MISSING');
        },
      },
    ],
  };
}

beforeEach(() => {
  resetCardDefRegistry();
  for (const id of ['HOST', 'A', 'B']) registerCardDef(card(id));
  globals.__humanPlayerSide = 'self';
  globals.__pendingDeckReorderSide = null;
  globals.__pendingEffectPickQueue = [];
});

afterAll(() => {
  globals.__humanPlayerSide = null;
  globals.__pendingDeckReorderSide = null;
  globals.__pendingEffectPickQueue = [];
});

describe('reorder boundary: effect stack', () => {
  it('keeps the first pending reorder, then surfaces the next stack entry after confirm', () => {
    const state = base();
    state.players.self.deck = ['A1', 'A2', 'B1', 'B2', 'TAIL'];
    resolve.queue(state, entry(state, 'first', '$first', ['A1', 'A2']));
    resolve.queue(state, entry(state, 'second', '$second', ['B1', 'B2']));
    state.pendingEffects.forEach((item, order) => {
      item.ownerChosenOrder = order;
      item.ownerOrderConfirmed = true;
    });

    resolve.runAllUntilEmpty(state);

    const first = _drainPendingDeckReorderSide();
    expect(first?.cardIds).toEqual(['A1', 'A2']);
    expect(state.pendingEffects.map(item => item.state)).toEqual(['resolved', 'pending']);

    applyDeckReorderAndContinuation(state, first!, ['A2', 'A1']);

    const second = _drainPendingDeckReorderSide();
    expect(second?.cardIds).toEqual(['B1', 'B2']);
    expect(state.players.self.deck).toEqual(['B1', 'B2', 'TAIL', 'A2', 'A1']);
    expect(state.pendingEffects.map(item => item.state)).toEqual(['resolved', 'resolved']);
  });
});

describe('reorder boundary: resolver containers', () => {
  it('pauses parallel at reorder and resumes its remaining step only after confirm', () => {
    const state = base();
    const ctx = ctxWithSource(state);
    state.players.self.deck = ['TAIL', 'P1', 'P2'];
    ctx.bindings['$moved'] = deckCandidates(state, ['P1', 'P2']);
    const effect: Effect = {
      kind: 'parallel',
      steps: [
        { kind: 'atom', verb: 'deckBottomReorderBound', args: { player: 'self', bindKey: '$moved' } },
        { kind: 'atom', verb: 'charModifyAP', args: { uid: ctx.source.uid, delta: 100, scope: 'turn' } },
      ],
    };

    runEffect(state, effect, ctx);
    const pending = _drainPendingDeckReorderSide();
    expect(state.players.self.scene[0]?.turnEffects['apMod_turn']).toBeUndefined();

    applyDeckReorderAndContinuation(state, pending!, ['P2', 'P1']);

    expect(state.players.self.scene[0]?.turnEffects['apMod_turn']).toBe(100);
  });

  it('preserves current and remaining $each values across repeated reorder pauses', () => {
    const state = base();
    const ctx = ctxWithSource(state);
    const first = mutate.scene.enter(state, 'self', 'A', {});
    const second = mutate.scene.enter(state, 'self', 'B', {});
    state.players.self.deck = ['TAIL', 'P1', 'P2'];
    ctx.bindings['$targets'] = [first, second].map(char => ({
      kind: 'char', uid: char.uid, cardId: char.cardId, player: 'self', area: 'scene',
    } as Candidate));
    ctx.bindings['$moved'] = deckCandidates(state, ['P1', 'P2']);
    const effect: Effect = {
      kind: 'forEach',
      over: { kind: 'fromBound', bindKey: '$targets' },
      do: {
        kind: 'sequence',
        steps: [
          { kind: 'atom', verb: 'deckBottomReorderBound', args: { player: 'self', bindKey: '$moved' } },
          { kind: 'atom', verb: 'charModifyAP', args: { uid: '$each.uid', delta: 100, scope: 'turn' } },
        ],
      },
    };

    runEffect(state, effect, ctx);
    const pending1 = _drainPendingDeckReorderSide();
    expect(state.players.self.scene.find(char => char.uid === first.uid)?.turnEffects['apMod_turn']).toBeUndefined();
    expect(state.players.self.scene.find(char => char.uid === second.uid)?.turnEffects['apMod_turn']).toBeUndefined();

    applyDeckReorderAndContinuation(state, pending1!, ['P2', 'P1']);
    const pending2 = _drainPendingDeckReorderSide();
    expect(state.players.self.scene.find(char => char.uid === first.uid)?.turnEffects['apMod_turn']).toBe(100);
    expect(state.players.self.scene.find(char => char.uid === second.uid)?.turnEffects['apMod_turn']).toBeUndefined();
    expect(pending2).not.toBeNull();

    applyDeckReorderAndContinuation(state, pending2!, ['P1', 'P2']);
    expect(state.players.self.scene.find(char => char.uid === second.uid)?.turnEffects['apMod_turn']).toBe(100);
    expect(_drainPendingDeckReorderSide()).toBeNull();
  });

  it('restores the outer context after a nested parallel reorder pause', () => {
    const state = base();
    const ctx = ctxWithSource(state);
    state.players.self.deck = ['TAIL', 'P1', 'P2'];
    ctx.bindings.$target = [charCandidate('B', 'outer-b')];
    ctx.bindings.$moved = deckCandidates(state, ['P1', 'P2']);

    runEffect(state, ctxLossEffect({
      kind: 'atom',
      verb: 'deckBottomReorderBound',
      args: { player: 'self', bindKey: '$moved' },
    }), ctx);
    const pending = _drainPendingDeckReorderSide();

    applyDeckReorderAndContinuation(state, pending!, ['P2', 'P1']);

    expect(state.players.self.hand).toEqual(['B']);
  });
});
