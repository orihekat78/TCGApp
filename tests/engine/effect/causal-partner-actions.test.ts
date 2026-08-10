import { describe, expect, it } from 'vitest';
import { produce } from '@/engine/produce';
import { startCausalSession, validateCausalLog } from '@/engine/log/causal';
import { runOne } from '@/engine/resolve/stack';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CausalLogEntryV1, EffectStackEntry, GameState } from '@/engine/types';

function runCausalAtom(options: {
  sessionId: string;
  verb: 'fileFlipTop' | 'partnerAssist' | 'partnerSetState';
  args: Record<string, unknown>;
  setup: (state: GameState) => void;
}): GameState {
  const state = createEmptyGameState();
  options.setup(state);
  startCausalSession(state, options.sessionId);
  return produce(state, (draft) => {
    const entry: EffectStackEntry = {
      id: `${options.sessionId}-entry`,
      source: {
        player: 'self',
        cardId: 'PRIVATE-SOURCE-ID',
        uid: 'private-source-uid',
        abilityId: 'a1',
        area: 'scene',
      },
      triggeredBy: { hook: 'manual' },
      triggeredAt: { turn: 1, phase: 'main', nano: 1 },
      effect: { kind: 'atom', verb: options.verb, args: options.args },
      state: 'pending',
    };
    runOne(draft, entry);
  });
}

function graph(state: GameState): CausalLogEntryV1[] {
  return validateCausalLog(state.log as CausalLogEntryV1[]);
}

describe('structured causal partner actions', () => {
  it.each(['sleep', 'stun'] as const)('records only an actual partner %s transition', (requested) => {
    const state = runCausalAtom({
      sessionId: `partner-${requested}`,
      verb: 'partnerSetState',
      args: { player: 'self', state: requested },
      setup: (draft) => {
        draft.players.self.partner.cardId = 'PUBLIC-PARTNER';
        draft.players.self.partner.state = 'active';
      },
    });

    expect(state.players.self.partner.state).toBe(requested);
    const entries = graph(state);
    expect(entries.map((entry) => [entry.kind, entry.outcome])).toEqual([
      ['declare', { type: 'state', state: 'active' }],
      [requested, { type: 'state', state: requested }],
      ['summary', { type: 'state', state: 'success' }],
    ]);
    expect(entries[1]).toMatchObject({
      actor: 'self',
      targets: [{ kind: 'card', side: 'self', zone: 'partner', cardNumber: 'PUBLIC-PARTNER' }],
    });
    expect(JSON.stringify(entries)).not.toContain('PRIVATE-SOURCE-ID');
    expect(JSON.stringify(entries)).not.toContain('private-source-uid');
  });

  it.each(['active', 'sleep', 'stun'] as const)('does not record a partner-state operation when %s is already set', (stateName) => {
    const state = runCausalAtom({
      sessionId: `partner-${stateName}-noop`,
      verb: 'partnerSetState',
      args: { player: 'self', state: stateName },
      setup: (draft) => {
        draft.players.self.partner.cardId = 'PUBLIC-PARTNER';
        draft.players.self.partner.state = stateName;
      },
    });

    expect(graph(state).map((entry) => entry.kind)).toEqual(['declare', 'summary']);
  });

  it.each(['sleep', 'stun'] as const)('records an actual partner %s to active transition as activate', (initialState) => {
    const state = runCausalAtom({
      sessionId: `partner-${initialState}-activate`,
      verb: 'partnerSetState',
      args: { player: 'self', state: 'active' },
      setup: (draft) => {
        draft.players.self.partner.cardId = 'PUBLIC-PARTNER';
        draft.players.self.partner.state = initialState;
      },
    });

    expect(state.players.self.partner.state).toBe('active');
    expect(graph(state).map((entry) => [entry.kind, entry.outcome])).toEqual([
      ['declare', { type: 'state', state: 'active' }],
      ['activate', { type: 'state', state: 'active' }],
      ['summary', { type: 'state', state: 'success' }],
    ]);
  });

  it('records only an actual FILE face-down to face-up transition', () => {
    const state = runCausalAtom({
      sessionId: 'file-face-change',
      verb: 'fileFlipTop',
      args: { player: 'opp' },
      setup: (draft) => {
        draft.players.opp.file = [
          { type: 'card-back', cardId: 'PRIVATE-UNTIL-FLIPPED', faceUp: false },
          { type: 'assisted-partner', cardId: 'PUBLIC-PARTNER' },
        ];
      },
    });

    expect(state.players.opp.file[0]).toMatchObject({ faceUp: true });
    const entries = graph(state);
    expect(entries.map((entry) => [entry.kind, entry.outcome])).toEqual([
      ['declare', { type: 'state', state: 'active' }],
      ['face-change', { type: 'face-change', from: 'face-down', to: 'face-up', count: 1 }],
      ['summary', { type: 'state', state: 'success' }],
    ]);
    expect(entries[1]).toMatchObject({
      source: { kind: 'zone', side: 'opp', zone: 'file' },
      targets: [{ kind: 'card', side: 'opp', zone: 'file', cardNumber: 'PRIVATE-UNTIL-FLIPPED' }],
    });
    expect(JSON.stringify(entries)).not.toContain('PRIVATE-SOURCE-ID');
  });

  it.each([
    { file: [] as GameState['players']['self']['file'] },
    { file: [{ type: 'assisted-partner' as const, cardId: 'PUBLIC-PARTNER' }] },
    { file: [{ type: 'card-back' as const, cardId: 'PUBLIC-FACE-UP', faceUp: true }] },
  ])('does not record a FILE face-change operation for a no-op', ({ file }) => {
    const state = runCausalAtom({
      sessionId: `file-face-change-noop-${file.length}-${file[0]?.type ?? 'empty'}`,
      verb: 'fileFlipTop',
      args: { player: 'self' },
      setup: (draft) => {
        draft.players.self.file = file;
      },
    });

    expect(graph(state).map((entry) => entry.kind)).toEqual(['declare', 'summary']);
  });

  it('records assist sleep followed by the public partner-to-FILE movement', () => {
    const state = runCausalAtom({
      sessionId: 'partner-assist',
      verb: 'partnerAssist',
      args: { player: 'self' },
      setup: (draft) => {
        draft.players.self.partner.cardId = 'PUBLIC-PARTNER';
        draft.players.self.partner.state = 'active';
        draft.players.self.partner.location = 'partner-area';
      },
    });

    expect(state.players.self.partner).toMatchObject({ state: 'sleep', location: 'file-area' });
    expect(state.players.self.file).toEqual([{ type: 'assisted-partner', cardId: 'PUBLIC-PARTNER' }]);
    const entries = graph(state);
    expect(entries.map((entry) => [entry.kind, entry.outcome])).toEqual([
      ['declare', { type: 'state', state: 'active' }],
      ['sleep', { type: 'state', state: 'sleep' }],
      ['zone-move', { type: 'move', from: 'partner', to: 'file', count: 1 }],
      ['summary', { type: 'state', state: 'success' }],
    ]);
    expect(entries[1]).toMatchObject({
      source: { kind: 'player', side: 'self' },
      targets: [{ kind: 'card', side: 'self', zone: 'partner', cardNumber: 'PUBLIC-PARTNER' }],
    });
    expect(entries[2]).toMatchObject({
      source: { kind: 'zone', side: 'self', zone: 'partner' },
      targets: [{ kind: 'card', side: 'self', zone: 'file', cardNumber: 'PUBLIC-PARTNER' }],
    });
    expect(JSON.stringify(entries)).toContain('PUBLIC-PARTNER');
  });

  it('records the actual incident-to-resolved transition when assist reaches FILE seven', () => {
    const state = runCausalAtom({
      sessionId: 'partner-assist-resolve',
      verb: 'partnerAssist',
      args: { player: 'self' },
      setup: (draft) => {
        draft.players.self.partner.cardId = 'PUBLIC-PARTNER';
        draft.players.self.partner.state = 'active';
        draft.players.self.case.cardId = 'PUBLIC-CASE';
        draft.players.self.case.status = '事件編';
        draft.players.self.file = Array.from(
          { length: 6 },
          (_, index) => ({ type: 'card-back' as const, cardId: `PRIVATE-FILE-${index}` }),
        );
      },
    });

    expect(state.players.self.case.status).toBe('解決編');
    const entries = graph(state);
    expect(entries.map((entry) => [entry.kind, entry.outcome])).toEqual([
      ['declare', { type: 'state', state: 'active' }],
      ['sleep', { type: 'state', state: 'sleep' }],
      ['zone-move', { type: 'move', from: 'partner', to: 'file', count: 1 }],
      ['case-status-change', { type: 'case-status', from: 'incident', to: 'resolved' }],
      ['summary', { type: 'state', state: 'success' }],
    ]);
    expect(entries[3]).toMatchObject({
      targets: [{ kind: 'card', side: 'self', zone: 'case', cardNumber: 'PUBLIC-CASE' }],
    });
    expect(JSON.stringify(entries)).not.toContain('PRIVATE-FILE-');
  });
});
