// qa: card:D10026:f2e98bbb3d44e213bf33b029253bb3aecf1a2669c18736ed488d4ae55db630f0
import { beforeEach, describe, expect, it } from 'vitest';
import { D10026 } from '@/cards/ct-d10/D10026';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { event } from '@/engine/event';
import { _clearPendingEffectPickQueue, _drainPendingEffectPickSide } from '@/engine/effect/pending-state';
import { applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { _resetRegistry, register } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import type { CardDef, GameState } from '@/engine/types';

const ROMANCE_EVENT: CardDef = {
  id: 'ROMANCE_EVENT', no: 'test/ROMANCE_EVENT', kind: 'event', names: ['シャッフルロマンス'],
  colors: ['青'], level: 0, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};
const DECOY_EVENT: CardDef = { ...ROMANCE_EVENT, id: 'DECOY_EVENT', no: 'test/DECOY_EVENT', names: ['別イベント'] };

function base(): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case = {
    cardId: 'D10026', status: '解決編', requiredEvidence: 7, colors: ['青'], declaredUseCount: {},
  } as GameState['players']['self']['case'];
  state.players.self.evidence = [
    { cardId: 'ROMANCE_EVENT', faceUp: false, origin: { turn: 1, via: 'opening' } },
    { cardId: 'DECOY_EVENT', faceUp: false, origin: { turn: 1, via: 'opening' } },
  ];
  return state;
}

beforeEach(() => {
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _clearPendingEffectPickQueue();
  [D10026, ROMANCE_EVENT, DECOY_EVENT].forEach(register);
  registerTriggeredListener();
});

describe('D10026 The Black Knight', () => {
  it('production declared dispatch: exact two facedown evidence pays then selected remove romance event returns to hand; decoy excluded', () => {
    const state = base();
    state.players.self.remove = ['ROMANCE_EVENT', 'DECOY_EVENT'];
    activateDeclaredAbility(state, 'case:self', 'a2', {
      flipFaceUpEvidence: { indices: [0, 1] }, choiceIndex: 0,
    });
    runAllUntilEmpty(state);
    const pending = _drainPendingEffectPickSide();
    expect(pending?.atomVerb).toBe('handAddFromRemove');
    expect((pending?.candidates as Array<{ cardId: string }>).map((c) => c.cardId)).toEqual(['ROMANCE_EVENT']);
    applyPickAndContinuation(state, pending!, (pending!.candidates as Array<{ uid: string }>)[0]!.uid);
    runAllUntilEmpty(state);
    expect(state.players.self.evidence.every((e) => e.faceUp)).toBe(true);
    expect(state.players.self.hand).toContain('ROMANCE_EVENT');
    expect(state.players.self.remove).not.toContain('ROMANCE_EVENT');
    expect(state.players.self.remove).toContain('DECOY_EVENT');
  });

  it('production declared dispatch: event-use option uses only the named event and moves it from hand to remove', () => {
    const state = base();
    state.players.self.hand = ['ROMANCE_EVENT', 'DECOY_EVENT'];
    activateDeclaredAbility(state, 'case:self', 'a2', {
      flipFaceUpEvidence: { indices: [0, 1] }, choiceIndex: 1,
    });
    runAllUntilEmpty(state);
    const pending = _drainPendingEffectPickSide();
    expect(pending?.atomVerb).toBe('useEventFromHand');
    expect((pending?.candidates as Array<{ cardId: string }>).map((c) => c.cardId)).toEqual(['ROMANCE_EVENT']);
    applyPickAndContinuation(state, pending!, (pending!.candidates as Array<{ uid: string }>)[0]!.uid);
    runAllUntilEmpty(state);
    expect(state.players.self.hand).not.toContain('ROMANCE_EVENT');
    expect(state.players.self.hand).toContain('DECOY_EVENT');
    expect(state.players.self.remove, D10026.id).toContain('ROMANCE_EVENT');
  });
});
