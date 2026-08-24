import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { B02052 } from '@/cards/ct-p02/B02052';
import { B06008 } from '@/cards/ct-p06/B06008';
import { D10009 } from '@/cards/ct-d10/D10009';
import { applySetCardReplacementDetailed } from '@/engine/effect/apply-pick';
import { _drainPendingSetCardReplacementSide, _clearPendingSetCardReplacementSide } from '@/engine/effect/pending-state';
import { hydratePendingRuntimeState, persistPendingRuntimeState, resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { run as runEffect } from '@/engine/effect/resolver';
import { event } from '@/engine/event';
import { mutate } from '@/engine/mutate';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, Effect, EffectCtx, GameState } from '@/engine/types';

function character(id: string, traits: string[] = []): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['青'], level: 1,
    ap: 1000, lp: 1, traits, keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  };
}

const REPLACEMENT_HOST = character('STACK-REPLACEMENT-HOST', ['怪盗']);
const DRAW = character('STACK-REPLACEMENT-DRAW');
const DRAW_A = character('STACK-REPLACEMENT-DRAW-A');
const DRAW_B = character('STACK-REPLACEMENT-DRAW-B');
const DRAW_SPARE = character('STACK-REPLACEMENT-DRAW-SPARE');

function resolvedFirstStep(effect: Effect, args: Record<string, unknown>): Effect {
  if (effect.kind !== 'chain' || effect.steps[0]?.kind !== 'atom') throw new Error('expected chain with atom first step');
  return {
    ...effect,
    steps: [{ ...effect.steps[0], args: { ...effect.steps[0].args, ...args } }, ...effect.steps.slice(1)],
  };
}

function context(cardId: string, uid: string, abilityId: string): EffectCtx {
  return { source: { player: 'self', area: 'scene', cardId, uid, abilityId }, bindings: {}, dyn: {} };
}

function resolveReplacement(state: GameState, targetUid: string | null): void {
  const pending = _drainPendingSetCardReplacementSide();
  expect(pending).toBeTruthy();
  expect(applySetCardReplacementDetailed(state, pending!, targetUid)).toMatchObject({ applied: true });
}

function nestedState(): { state: GameState; sourceUid: string; hostUid: string; stack: Effect; ctx: EffectCtx } {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
  const source = mutate.scene.enter(state, 'self', B06008.id, {});
  const host = mutate.scene.enter(state, 'self', REPLACEMENT_HOST.id, {});
  source.setCards = [{ cardId: B02052.id, faceUp: true, instanceId: 'set:nested:replacement' }];
  state.players.self.deck = [DRAW_A.id, DRAW_B.id, DRAW_SPARE.id];
  const printed = B06008.abilities[1]!.effect!;
  if (printed.kind !== 'chain' || printed.steps[0]?.kind !== 'atom') throw new Error('expected B06008 stack atom');
  return {
    state,
    sourceUid: source.uid,
    hostUid: host.uid,
    stack: { ...printed.steps[0], args: { ...printed.steps[0].args, uid: host.uid } },
    ctx: context(B06008.id, source.uid, 'a2'),
  };
}

const drawA: Effect = { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } };
const drawB: Effect = { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } };

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _clearPendingSetCardReplacementSide();
  resetPendingRuntimeState();
  [B02052, B06008, D10009, REPLACEMENT_HOST, DRAW, DRAW_A, DRAW_B, DRAW_SPARE].forEach(register);
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
});

afterEach(() => {
  resetPendingRuntimeState();
  delete (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide;
});

describe('scene-to-stack set-card replacement continuation', () => {
  it.each([
    { label: 'accepts', target: 'replacement' },
    { label: 'declines', target: null },
  ] as const)('B06008 $label replacement, then stacks and draws exactly once', ({ target }) => {
    const state = createEmptyGameState();
    state.turn = { number: 4, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    const source = mutate.scene.enter(state, 'self', B06008.id, {});
    const host = mutate.scene.enter(state, 'self', REPLACEMENT_HOST.id, {});
    source.setCards = [{ cardId: B02052.id, faceUp: true, instanceId: 'set:yaiba:replacement' }];
    state.players.self.deck = [DRAW.id];

    runEffect(
      state,
      resolvedFirstStep(B06008.abilities[1]!.effect!, { uid: host.uid }),
      context(B06008.id, source.uid, 'a2'),
    );
    expect(state.players.self.hand).toEqual([]);
    resolveReplacement(state, target === null ? null : host.uid);

    expect(state.players.self.scene.some(character => character.uid === source.uid)).toBe(false);
    expect(state.players.self.scene.find(character => character.uid === host.uid)?.stackedCards)
      .toEqual([expect.objectContaining({ cardId: B06008.id })]);
    expect(state.players.self.hand).toEqual([DRAW.id]);
  });

  it.each([
    { label: 'accepts', target: 'replacement' },
    { label: 'declines', target: null },
  ] as const)('D10009 $label replacement, then stacks Ran and grants Assault', ({ target }) => {
    const state = createEmptyGameState();
    state.turn = { number: 4, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    const shinichi = mutate.scene.enter(state, 'self', D10009.id, {});
    const ran = mutate.scene.enter(state, 'self', REPLACEMENT_HOST.id, {});
    const replacement = mutate.scene.enter(state, 'self', REPLACEMENT_HOST.id, {});
    ran.setCards = [{ cardId: B02052.id, faceUp: true, instanceId: 'set:ran:replacement' }];

    runEffect(
      state,
      resolvedFirstStep(D10009.abilities[2]!.effect!, { uid: ran.uid, hostUid: shinichi.uid }),
      context(D10009.id, shinichi.uid, 'a2'),
    );
    expect(readChar.keywords(state, shinichi.uid)).not.toContain('突撃[キャラ]');
    resolveReplacement(state, target === null ? null : replacement.uid);

    expect(state.players.self.scene.some(character => character.uid === ran.uid)).toBe(false);
    expect(state.players.self.scene.find(character => character.uid === shinichi.uid)?.stackedCards)
      .toEqual([expect.objectContaining({ cardId: REPLACEMENT_HOST.id })]);
    expect(readChar.keywords(state, shinichi.uid)).toContain('突撃[キャラ]');
  });

  it.each([
    {
      label: 'sequence over chain',
      effect: (stack: Effect): Effect => ({
        kind: 'sequence',
        steps: [{ kind: 'chain', steps: [stack, drawA] }, drawB],
      }),
    },
    {
      label: 'chain over sequence',
      effect: (stack: Effect): Effect => ({
        kind: 'chain',
        steps: [{ kind: 'sequence', steps: [stack, drawA] }, drawB],
      }),
    },
    {
      label: 'parallel over chain',
      effect: (stack: Effect): Effect => ({
        kind: 'parallel',
        steps: [{ kind: 'chain', steps: [stack, drawA] }, drawB],
      }),
    },
  ])('preserves every nested tail for $label', ({ effect }) => {
    const fixture = nestedState();
    runEffect(fixture.state, effect(fixture.stack), fixture.ctx);
    expect(fixture.state.players.self.hand).toEqual([]);

    resolveReplacement(fixture.state, null);

    expect(fixture.state.players.self.scene.some(character => character.uid === fixture.sourceUid)).toBe(false);
    expect(fixture.state.players.self.scene.find(character => character.uid === fixture.hostUid)?.stackedCards)
      .toEqual([expect.objectContaining({ cardId: B06008.id })]);
    expect(fixture.state.players.self.hand).toEqual([DRAW_A.id, DRAW_B.id]);
  });

  it('preserves nested tails through pending-runtime JSON hydration', () => {
    const fixture = nestedState();
    const effect: Effect = {
      kind: 'sequence',
      steps: [{ kind: 'chain', steps: [fixture.stack, drawA] }, drawB],
    };
    runEffect(fixture.state, effect, fixture.ctx);
    persistPendingRuntimeState(fixture.state);
    const restored = JSON.parse(JSON.stringify(fixture.state)) as GameState;
    resetPendingRuntimeState();
    expect(hydratePendingRuntimeState(restored)).toBe(true);

    resolveReplacement(restored, null);

    expect(restored.players.self.hand).toEqual([DRAW_A.id, DRAW_B.id]);
  });
});
