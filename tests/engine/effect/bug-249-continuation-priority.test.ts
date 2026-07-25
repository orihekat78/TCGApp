import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  applyChoiceAndContinuation,
  applyOptionalAndContinuation,
  applyPickAndContinuation,
} from '@/engine/effect/apply-pick';
import {
  _clearPendingEffectChoiceSide,
  _clearPendingEffectOptionalSide,
  _drainPendingEffectChoiceSide,
  _drainPendingEffectOptionalSide,
  _drainPendingEffectPickSide,
  resolveEffectPicks,
} from '@/engine/effect/resolve-picks';
import { event } from '@/engine/event';
import {
  _setDeferredEntryPickResolver,
  effectCtxFromStackEntry,
  pendingOwnerOrderGroup,
  runAllUntilEmpty,
} from '@/engine/resolve/stack';
import { createEmptyGameState } from '@/engine/state-factory';
import type { Effect, EffectStackEntry } from '@/engine/types';
import { sceneChar } from '../../helpers/fixtures';

describe('BUG-249 current-effect continuation priority', () => {
  beforeEach(() => {
    event._resetRegistry();
    _clearPendingEffectChoiceSide();
    _clearPendingEffectOptionalSide();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    (globalThis as { __pendingEffectPickQueue?: unknown[] }).__pendingEffectPickQueue = [];
  });

  afterEach(() => {
    _setDeferredEntryPickResolver(null);
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
    delete (globalThis as { __pendingEffectPickQueue?: unknown[] }).__pendingEffectPickQueue;
  });

  it('finishes a paused current effect before newly triggered unresolved effects', () => {
    event.on('turn:end', () => ({ kind: 'atom', verb: 'noop', args: {} }));
    _setDeferredEntryPickResolver((state, entry) => resolveEffectPicks(
      state,
      entry.effect,
      effectCtxFromStackEntry(entry),
      {
        byPlayer: 'self',
        humanChooser: true,
        source: { cardId: 'HOST', abilityId: 'a1' },
      },
    ));

    const state = createEmptyGameState();
    state.players.self.scene = [sceneChar('TARGET', 't1')];
    const parent: EffectStackEntry = {
      id: 'parent',
      source: { player: 'self', cardId: 'HOST', uid: 'host', abilityId: 'a1' },
      triggeredBy: { hook: 'test' },
      triggeredAt: { turn: 1, phase: 'main', nano: 1 },
      triggerBatch: 1,
      deferredPicks: true,
      effect: {
        kind: 'sequence',
        steps: [
          {
            kind: 'custom',
            fn: current => event.emit(current, 'turn:end', {}, { player: 'self', cardId: 'NESTED' }),
          },
          {
            kind: 'atom',
            verb: 'charModifyAP',
            args: {
              uid: '$pick', delta: 100, scope: 'turn',
              target: {
                kind: 'pick', chooser: 'self',
                query: { area: 'scene', side: 'self' },
                n: { min: 1, max: 1 },
              },
            },
          },
        ],
      },
      state: 'pending',
    };
    state.pendingEffects.push(parent);

    runAllUntilEmpty(state);
    const pick = _drainPendingEffectPickSide();
    expect(pick).not.toBeNull();
    expect(state.pendingEffects.filter(entry => entry.state === 'pending').map(entry => entry.triggeredBy.hook)).toEqual(['turn:end']);

    applyPickAndContinuation(state, pick!, 't1');

    expect(pendingOwnerOrderGroup(state, 'self')).toEqual([]);
    expect(state.pendingEffects.find(entry => entry.triggeredBy.hook === 'effect:pick-resolved')?.state).toBe('resolved');
    expect(state.pendingEffects.find(entry => entry.triggeredBy.hook === 'turn:end')?.state).toBe('resolved');
  });

  it.each([
    ['choice', { kind: 'choice', chooser: 'self', options: [
      { kind: 'atom', verb: 'noop', args: {} },
      { kind: 'atom', verb: 'noop', args: {} },
    ] } as Effect],
    ['optional', { kind: 'optional', effect: { kind: 'atom', verb: 'noop', args: {} } } as Effect],
  ] as const)('keeps a terminal %s continuation ahead of prefix triggers', (kind, decision) => {
    event.on('turn:end', () => ({ kind: 'atom', verb: 'noop', args: {} }));
    _setDeferredEntryPickResolver((state, entry) => resolveEffectPicks(
      state,
      entry.effect,
      effectCtxFromStackEntry(entry),
      {
        byPlayer: 'self', humanChooser: true,
        source: { cardId: 'HOST', abilityId: kind },
      },
    ));
    const state = createEmptyGameState();
    state.pendingEffects.push({
      id: `parent-${kind}`,
      source: { player: 'self', cardId: 'HOST', uid: 'host', abilityId: kind },
      triggeredBy: { hook: 'test' },
      triggeredAt: { turn: 1, phase: 'main', nano: 1 },
      triggerBatch: 1,
      deferredPicks: true,
      effect: {
        kind: 'sequence',
        steps: [
          {
            kind: 'custom',
            fn: current => event.emit(current, 'turn:end', {}, { player: 'self', cardId: 'NESTED' }),
          },
          decision,
        ],
      },
      state: 'pending',
    });

    runAllUntilEmpty(state);
    if (kind === 'choice') {
      const pending = _drainPendingEffectChoiceSide();
      expect(pending).not.toBeNull();
      applyChoiceAndContinuation(state, pending!, 0);
    } else {
      const pending = _drainPendingEffectOptionalSide();
      expect(pending).not.toBeNull();
      applyOptionalAndContinuation(state, pending!, true);
    }

    expect(pendingOwnerOrderGroup(state, 'self')).toEqual([]);
    expect(state.pendingEffects.find(entry => entry.triggeredBy.hook === `effect:${kind}-resolved`)?.state).toBe('resolved');
    expect(state.pendingEffects.find(entry => entry.triggeredBy.hook === 'turn:end')?.state).toBe('resolved');
  });
});
