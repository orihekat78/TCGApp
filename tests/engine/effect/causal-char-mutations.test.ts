import { describe, expect, it } from 'vitest';
import { startCausalSession, validateCausalLog } from '@/engine/log/causal';
import { produce } from '@/engine/produce';
import { runOne } from '@/engine/resolve/stack';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CausalLogEntryV1, EffectStackEntry, GameState } from '@/engine/types';
import { sceneChar } from '../../helpers/fixtures';

function runCausalAtom(
  sessionId: string,
  setup: (state: GameState) => void,
  effect: EffectStackEntry['effect'],
): GameState {
  const state = createEmptyGameState();
  setup(state);
  startCausalSession(state, sessionId);
  return produce(state, (draft) => {
    runOne(draft, {
      id: `${sessionId}-entry`,
      source: {
        player: 'self', cardId: 'PRIVATE-SOURCE', uid: 'private-source', abilityId: 'a1', area: 'scene',
      },
      triggeredBy: { hook: 'manual' },
      triggeredAt: { turn: 1, phase: 'main', nano: 1 },
      effect,
      state: 'pending',
    } satisfies EffectStackEntry);
  });
}

function graph(state: GameState): CausalLogEntryV1[] {
  return validateCausalLog(state.log as CausalLogEntryV1[]);
}

describe('character mutation causal projection', () => {
  it.each([
    ['charOverrideAP', 'ap', 2400],
    ['charOverrideLP', 'lp', 2],
  ] as const)('records %s as a typed numeric value change', (verb, unit, value) => {
    const state = runCausalAtom(`causal-${verb}`, (draft) => {
      draft.players.opp.scene = [sceneChar('PUBLIC-TARGET', 'target')];
    }, { kind: 'atom', verb, args: { uid: 'target', val: value } });

    expect(graph(state).map((node) => node.kind)).toEqual(['declare', 'value-change', 'summary']);
    expect(graph(state)[1]).toMatchObject({
      source: { kind: 'player', side: 'self' },
      targets: [{ kind: 'card', side: 'opp', zone: 'scene', cardNumber: 'PUBLIC-TARGET' }],
      outcome: { type: 'count', amount: value, unit },
    });
    expect(JSON.stringify(state.log)).not.toMatch(/PRIVATE-|private-source/);
  });

  it('records an override reset without inventing a numeric delta', () => {
    const state = runCausalAtom('causal-override-reset', (draft) => {
      draft.players.self.scene = [sceneChar('PUBLIC-TARGET', 'target', { apOverride: 2400 })];
    }, { kind: 'atom', verb: 'charOverrideAP', args: { uid: 'target', val: null } });

    expect(state.players.self.scene[0].apOverride).toBeNull();
    expect(graph(state).map((node) => node.kind)).toEqual(['declare', 'value-change', 'summary']);
    expect(graph(state)[1].outcome).toEqual({ type: 'state', state: 'success' });
  });

  it.each([
    {
      verb: 'charGrantKeyword' as const,
      args: { uid: 'target', kw: '迅速', scope: 'permanent' },
      check: (state: GameState) => expect(state.players.self.scene[0].keywordOverrides.granted).toContain('迅速'),
    },
    {
      verb: 'charRevokeKeyword' as const,
      args: { uid: 'target', kw: '迅速', scope: 'turn' },
      check: (state: GameState) => expect(state.players.self.scene[0].turnEffects.revokedKeywords).toEqual(['迅速']),
    },
    {
      verb: 'charGrantTrait' as const,
      args: { uid: 'target', trait: '探偵', scope: 'turn' },
      check: (state: GameState) => expect(state.players.self.scene[0].turnEffects.grantedTraits_turn).toEqual(['探偵']),
    },
    {
      verb: 'charRevokeTrait' as const,
      args: { uid: 'target', trait: '探偵', scope: 'turn' },
      check: (state: GameState) => expect(state.players.self.scene[0].turnEffects.revokedTraits_turn).toEqual(['探偵']),
    },
    {
      verb: 'charDisableOriginal' as const,
      args: { uid: 'target', scope: 'turn' },
      check: (state: GameState) => expect(state.players.self.scene[0].turnEffects.originalAbilitiesDisabled_turn).toBe(true),
    },
  ])('records $verb as one public state change', ({ verb, args, check }) => {
    const state = runCausalAtom(`causal-${verb}`, (draft) => {
      draft.players.self.scene = [sceneChar('PUBLIC-TARGET', 'target')];
    }, { kind: 'atom', verb, args });

    check(state);
    expect(graph(state).map((node) => node.kind)).toEqual(['declare', 'value-change', 'summary']);
    expect(graph(state)[1]).toMatchObject({
      targets: [{ kind: 'card', side: 'self', zone: 'scene', cardNumber: 'PUBLIC-TARGET' }],
      outcome: { type: 'state', state: 'success' },
    });
  });

  it('records selected private cards as a public zone count and removes IDs from every log field', () => {
    const state = runCausalAtom('causal-stack-selected', (draft) => {
      draft.players.self.scene = [sceneChar('PUBLIC-HOST', 'host')];
      draft.players.self.remove = ['PRIVATE-STACK-A', 'PRIVATE-STACK-B'];
    }, {
      kind: 'atom',
      verb: 'charStackCard',
      args: {
        uid: 'host',
        cardIds: ['PRIVATE-STACK-A', 'PRIVATE-STACK-B'],
        target: { kind: 'pick', query: { area: 'remove', side: 'self' } },
      },
    });

    expect(state.players.self.remove).toEqual([]);
    expect(state.players.self.scene[0].stackedCards).toHaveLength(2);
    expect(graph(state).map((node) => node.kind)).toEqual(['declare', 'zone-move', 'summary']);
    expect(graph(state)[1]).toMatchObject({
      source: { kind: 'zone', side: 'self', zone: 'remove' },
      targets: [{ kind: 'card', side: 'self', zone: 'scene', cardNumber: 'PUBLIC-HOST' }],
      outcome: { type: 'move', from: 'remove', to: 'scene', count: 2 },
    });
    expect(JSON.stringify(state.log)).not.toMatch(/PRIVATE-|private-source/);
  });

  it('records a scene character stacked under another as a scene-to-scene move', () => {
    const state = runCausalAtom('causal-stack-scene', (draft) => {
      draft.players.self.scene = [
        sceneChar('PUBLIC-HOST', 'host'),
        sceneChar('PUBLIC-MOVED', 'moved'),
      ];
    }, {
      kind: 'atom', verb: 'charStackCard', args: { fromScene: true, uid: 'moved', hostUid: 'host' },
    });

    expect(state.players.self.scene.map((card) => card.uid)).toEqual(['host']);
    expect(graph(state).map((node) => node.kind)).toEqual(['declare', 'zone-move', 'summary']);
    expect(graph(state)[1]).toMatchObject({
      source: { kind: 'zone', side: 'self', zone: 'scene' },
      targets: [{ kind: 'card', side: 'self', zone: 'scene', cardNumber: 'PUBLIC-HOST' }],
      outcome: { type: 'move', from: 'scene', to: 'scene', count: 1 },
    });
  });

  it('records a successful scene disguise as one public state change', () => {
    const state = runCausalAtom('causal-scene-disguise', (draft) => {
      draft.players.opp.scene = [sceneChar('PUBLIC-OLD', 'target')];
    }, {
      kind: 'atom', verb: 'sceneDisguise', args: { uid: 'target', newCardId: 'PUBLIC-NEW' },
    });

    expect(state.players.opp.scene[0].cardId).toBe('PUBLIC-NEW');
    expect(graph(state).map((node) => node.kind)).toEqual(['declare', 'value-change', 'summary']);
    expect(graph(state)[1]).toMatchObject({
      targets: [{ kind: 'card', side: 'opp', zone: 'scene', cardNumber: 'PUBLIC-NEW' }],
      outcome: { type: 'state', state: 'success' },
    });
    expect(JSON.stringify(state.log)).not.toMatch(/PRIVATE-|private-source/);
  });

  it('does not emit or expose a disguise identity for a missing scene target', () => {
    const state = runCausalAtom('causal-missing-disguise', () => undefined, {
      kind: 'atom', verb: 'sceneDisguise', args: { uid: 'missing', newCardId: 'PRIVATE-NEW' },
    });

    expect(graph(state).map((node) => node.kind)).toEqual(['declare', 'summary']);
    expect(JSON.stringify(state.log)).not.toContain('PRIVATE-NEW');
  });

  it('does not emit a state change for a missing scene target', () => {
    const state = runCausalAtom('causal-missing-char', () => undefined, {
      kind: 'atom', verb: 'charGrantKeyword', args: { uid: 'missing', kw: '迅速' },
    });

    expect(graph(state).map((node) => node.kind)).toEqual(['declare', 'summary']);
  });
});
