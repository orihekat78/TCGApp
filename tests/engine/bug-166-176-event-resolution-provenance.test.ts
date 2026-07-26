import { beforeEach, describe, expect, it } from 'vitest';
import { evalCond } from '@/engine/cond/eval';
import { applyChoiceAndContinuation } from '@/engine/effect/apply-pick';
import {
  _clearPendingEffectChoiceSide,
  _drainPendingEffectChoiceSide,
  resolveEffectPicks,
} from '@/engine/effect/resolve-picks';
import { run as runEffect } from '@/engine/effect/resolver';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, EffectCtx, GameState } from '@/engine/types';

type ResolutionKind = 'normal-event' | 'cutin' | 'hirameki';

function eventDef(id: string, color = '黄'): CardDef {
  return {
    id,
    no: id,
    kind: 'event',
    names: [id],
    colors: [color],
    level: 1,
    traits: [],
    rarity: 'C',
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
  };
}

function ctx(cardId: string, resolutionKind?: ResolutionKind): EffectCtx {
  return {
    source: {
      player: 'self',
      area: 'hand',
      cardId,
      ...(resolutionKind ? { resolutionKind } : {}),
    },
    bindings: {},
    rng: () => 0,
  } as unknown as EffectCtx;
}

function withRemove(ids: string[]): GameState {
  const state = createEmptyGameState();
  state.players.self.remove = ids;
  state.players.self.deck = [];
  return state;
}

describe('BUG-166/176 resolving-card provenance', () => {
  beforeEach(() => {
    _clearPendingEffectChoiceSide();
    resetDefRegistry();
    registerCardDef(eventDef('EVENT'));
    registerCardDef(eventDef('CUTIN', '黒'));
    registerCardDef(eventDef('OTHER', '青'));
  });

  it('excludes a resolving normal event from remove conditions', () => {
    const state = withRemove(['OTHER', 'EVENT']);
    expect(evalCond(state, { kind: 'removeCountAtLeast', player: 'self', n: 2 }, ctx('EVENT', 'normal-event'))).toBe(false);
    expect(evalCond(state, { kind: 'removeColorAtLeast', player: 'self', color: '黄', n: 1 }, ctx('EVENT', 'normal-event'))).toBe(false);
  });

  it('keeps a resolving hirameki excluded until its effect finishes', () => {
    const state = withRemove(['OTHER', 'EVENT']);
    expect(evalCond(state, { kind: 'removeCountAtLeast', player: 'self', n: 2 }, ctx('EVENT', 'hirameki'))).toBe(false);
  });

  it('counts a cut-in because it resolves from the remove area', () => {
    const state = withRemove(['OTHER', 'CUTIN']);
    expect(evalCond(state, { kind: 'removeCountAtLeast', player: 'self', n: 2 }, ctx('CUTIN', 'cutin'))).toBe(true);
    expect(evalCond(state, { kind: 'removeColorAtLeast', player: 'self', color: '黒', n: 1 }, ctx('CUTIN', 'cutin'))).toBe(true);
  });

  it('does not subtract an event merely because it is the context source', () => {
    const state = withRemove(['OTHER', 'EVENT']);
    expect(evalCond(state, { kind: 'removeCountAtLeast', player: 'self', n: 2 }, ctx('EVENT'))).toBe(true);
    expect(evalCond(state, { kind: 'removeColorAtLeast', player: 'self', color: '黄', n: 1 }, ctx('EVENT'))).toBe(true);
  });

  it('refreshes from a cut-in-only remove pile and completes the draw', () => {
    const state = withRemove(['CUTIN']);
    runEffect(state, { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } }, ctx('CUTIN', 'cutin'));
    expect(state.players.self.hand).toEqual(['CUTIN']);
    expect(state.players.self.remove).toEqual([]);
  });

  it('fails refresh when the only apparent remove card is the resolving normal event', () => {
    const state = withRemove(['EVENT']);
    runEffect(state, { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } }, ctx('EVENT', 'normal-event'));
    expect(state.players.self.hand).toEqual([]);
    expect(state.players.self.remove).toEqual(['EVENT']);
    expect(state.gameResult).toMatchObject({ winner: 'opp', reason: 'deck-out' });
  });

  it('keeps normal-event provenance across a human choice pause', () => {
    const state = withRemove(['EVENT']);
    const sourceCtx = ctx('EVENT', 'normal-event');
    const effect = {
      kind: 'choice',
      chooser: 'self',
      options: [
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
        { kind: 'parallel', steps: [] },
      ],
    } as const;

    resolveEffectPicks(state, effect, sourceCtx, {
      humanChooser: true,
      byPlayer: 'self',
      source: { cardId: 'EVENT', abilityId: 'a1' },
    });
    const pending = _drainPendingEffectChoiceSide();
    expect(pending).not.toBeNull();
    applyChoiceAndContinuation(state, pending!, 0);

    expect(state.players.self.hand).toEqual([]);
    expect(state.players.self.remove).toEqual(['EVENT']);
    expect(state.gameResult).toMatchObject({ winner: 'opp', reason: 'deck-out' });
  });
});
