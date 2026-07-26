import { beforeEach, describe, expect, it } from 'vitest';
import { B10006 } from '@/cards/ct-p10/B10006';
import { pay } from '@/engine/cost/pay';
import { evalCond } from '@/engine/cond/eval';
import { validateCards } from '@/engine/effect/validate';
import { mutate } from '@/engine/mutate';
import { event } from '@/engine/event';
import { run as runEffect } from '@/engine/effect/resolver';
import { runAllUntilEmpty } from '@/engine/resolve';
import { endTurn } from '@/engine/flow/turn';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { char as charRead } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { runAutoPhase } from '@/engine/flow/auto-phase';
import { candidates } from '@/engine/target/candidates';
import { makeCtx, sceneChar } from '../../helpers/fixtures';
import type { CardDef, EffectCtx, GameState } from '@/engine/types';

const kudo: CardDef = { id: 'KUDO', no: 'T/KUDO', kind: 'character', names: ['工藤新一'], colors: [], level: 1, ap: 1, lp: 1, traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const originalWrongName: CardDef = { id: 'KAITO', no: 'T/KAITO', kind: 'character', names: ['怪盗キッド'], colors: [], level: 1, ap: 1, lp: 1, traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const blueBlackCase: CardDef = { id: 'CASE', no: 'T/CASE', kind: 'case', names: ['CASE'], colors: ['青', '黒'], traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };

function liveState(ids: string[], copies = 1): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case.colors = ['青', '黒'];
  state.players.self.file = Array.from({ length: 5 }, (_, i) => ({ type: 'card-back', cardId: `file:${i}` }));
  state.players.self.hand = ids;
  state.players.self.scene = Array.from({ length: copies }, (_, i) => sceneChar('B10006', `ran-${i}`));
  return state;
}

function reveal(state: GameState, cardId: string): void {
  const ctx: EffectCtx = { source: { player: 'self', uid: 'reveal', cardId: 'SOURCE', abilityId: 'a1', area: 'scene' }, bindings: {} };
  runEffect(state, { kind: 'atom', verb: 'handReveal', args: { player: 'self', target: [cardId] } } as never, ctx);
  runAllUntilEmpty(state);
}

function revealAsDeclaredCost(state: GameState, cardId: string): void {
  const ctx: EffectCtx = { source: { player: 'self', uid: 'declared', cardId: 'SOURCE', abilityId: 'a1', area: 'scene' }, bindings: {} };
  pay(state, {
    kind: 'revealFromHand', n: 1,
    target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' },
  } as never, ctx);
  runAllUntilEmpty(state);
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  [B10006, kudo, originalWrongName, blueBlackCase].forEach(register);
  registerTriggeredListener();
});

describe('B10006', () => {
  it('validates and always enters asleep', () => {
    expect(validateCards([B10006]).ok).toBe(true);
    const state = createEmptyGameState();
    expect(mutate.scene.enter(state, 'self', 'B10006', {}).state).toBe('sleep');
  });

  it('is selectable by blue card filters', () => {
    const state = createEmptyGameState();
    state.players.self.hand = ['B10006'];

    expect(candidates(state, { kind: 'all', query: { area: 'hand', side: 'self', filter: { color: '青' } } }, makeCtx()))
      .toHaveLength(1);
  });

  it('accepts a self effect or declared-cost reveal of either official name only', () => {
    const matcher = B10006.abilities[2]!.trigger!.matcherCondition!;
    const state = createEmptyGameState();
    const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'u', cardId: 'B10006' }, triggerPayload: { player: 'self', byPlayer: 'self', cause: 'effect', revealed: ['KUDO'] } });
    expect(evalCond(state, matcher, ctx)).toBe(true);
    expect(evalCond(state, matcher, makeCtx({ ...ctx, triggerPayload: { player: 'self', byPlayer: 'opp', cause: 'effect', revealed: ['KID'] } }))).toBe(false);
    expect(evalCond(state, matcher, makeCtx({ ...ctx, triggerPayload: { player: 'self', byPlayer: 'self', cause: 'cost', revealed: ['KUDO'] } }))).toBe(true);
    expect(evalCond(state, matcher, makeCtx({ ...ctx, triggerPayload: { player: 'self', byPlayer: 'self', cause: 'effect', revealed: ['KAITO'] } }))).toBe(false);
  });

  it('keeps its entry sleep through auto phase while ordinary effects may activate it', () => {
    const state = createEmptyGameState();
    state.turn.player = 'self';
    const c = mutate.scene.enter(state, 'self', 'B10006', {});
    runAutoPhase(state, 'self');
    expect(c.state).toBe('sleep');
    mutate.scene.setState(state, c.uid, 'active');
    expect(c.state).toBe('active');
  });

  it('adds exactly 1000 AP through the live hand-reveal trigger', () => {
    const state = liveState(['KUDO']);

    reveal(state, 'KUDO');

    expect(charRead.ap(state, 'ran-0')).toBe(7000);
    expect(state.players.self.scene[0]!.turnEffects.apMod_turn).toBe(1000);
  });

  it('also accepts the official Mouri Ran name', () => {
    const state = liveState(['B10006']);

    reveal(state, 'B10006');

    expect(charRead.ap(state, 'ran-0')).toBe(7000);
  });

  it('applies each of its two turn triggers to every duplicate independently', () => {
    const state = liveState(['KUDO', 'KUDO', 'KUDO'], 2);

    reveal(state, 'KUDO');
    reveal(state, 'KUDO');
    reveal(state, 'KUDO');

    for (const id of ['ran-0', 'ran-1']) {
      expect(charRead.ap(state, id)).toBe(8000);
      expect(state.players.self.scene.find((char) => char.uid === id)!.declaredUseCount.a3).toBe(2);
    }
  });

  it('clears the two-trigger AP bonus at turn end', () => {
    const state = liveState(['KUDO', 'KUDO']);
    reveal(state, 'KUDO');
    reveal(state, 'KUDO');
    expect(charRead.ap(state, 'ran-0')).toBe(8000);

    endTurn(state, 'self');

    expect(charRead.ap(state, 'ran-0')).toBe(6000);
    expect(state.players.self.scene[0]!.turnEffects.apMod_turn).toBeUndefined();
  });

  it('fires from a declared ability cost and remains disabled for the original non-official name', () => {
    const byCost = liveState(['KUDO']);
    revealAsDeclaredCost(byCost, 'KUDO');
    expect(charRead.ap(byCost, 'ran-0')).toBe(7000);

    const original = liveState(['KAITO']);
    reveal(original, 'KAITO');
    expect(charRead.ap(original, 'ran-0')).toBe(6000);
    expect(original.players.self.scene[0]!.declaredUseCount.a3).toBeUndefined();
  });
});
