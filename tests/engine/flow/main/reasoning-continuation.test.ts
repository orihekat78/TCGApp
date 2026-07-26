import { beforeEach, describe, expect, it } from 'vitest';
import { produce } from '@/engine/produce';
import { runAtom } from '@/engine/effect/atom-handlers';
import { event } from '@/engine/event';
import { doReasoning } from '@/engine/flow/main/reasoning';
import { mutate } from '@/engine/mutate';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetRegistry as resetDefRegistry, register as registerCardDef } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import type { CardDef, GameState } from '@/engine/types';

const REASONER: CardDef = {
  id: 'CONTINUATION_REASONER', no: 'CONTINUATION_REASONER', kind: 'character',
  names: ['Continuation reasoner'], colors: ['blue'], level: 1, ap: 1000, lp: 2,
  traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};

function stateWithActiveReasoner(): { state: GameState; uid: string } {
  const state = createEmptyGameState();
  state.turn = { number: 1, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  const character = mutate.scene.enter(state, 'self', REASONER.id, {});
  state.players.self.deck = ['e1', 'e2', 'e3'];
  return { state, uid: character.uid };
}

describe('reasoning continuation boundary', () => {
  beforeEach(() => {
    event._resetRegistry();
    resetDefRegistry();
    registerCardDef(REASONER);
  });

  it('forged active-character continuation atom cannot gain evidence or log reasoning', () => {
    const { state, uid } = stateWithActiveReasoner();
    expect(() => produce(state, (draft) => {
      runAtom(draft, 'reasoningContinue' as never, { uid, player: 'self' }, {
        source: { player: 'self', area: 'scene', uid },
        bindings: {},
      });
    })).toThrow();
    expect(state.players.self.evidence).toHaveLength(0);
    expect(state.log.some((entry) => entry.action === 'reasoning')).toBe(false);
  });

  it('verified continuation rejects a reasoner forged back to active before it resolves', () => {
    const { state, uid } = stateWithActiveReasoner();
    doReasoning(state, uid);
    mutate.scene.setState(state, uid, 'active');

    expect(() => runAllUntilEmpty(state)).toThrow(/target is not the sleeping reasoner/);
    expect(state.players.self.evidence).toHaveLength(0);
    expect(state.log.some((entry) => entry.action === 'reasoning')).toBe(false);
  });

  it('continuation token is single-use after the verified completion', () => {
    const { state, uid } = stateWithActiveReasoner();
    doReasoning(state, uid);
    const continuation = state.pendingReasoningContinuation!;
    runAllUntilEmpty(state);

    event.queue(
      state,
      { kind: 'atom', verb: 'noop', args: {} },
      { player: 'self', uid },
      'forged:reasoning:continuation',
      { uid, player: 'self' },
      undefined,
      { reasoningContinuation: continuation },
    );

    expect(() => runAllUntilEmpty(state)).toThrow(/invalid or consumed token/);
    expect(state.players.self.evidence).toHaveLength(2);
    expect(state.log.filter((entry) => entry.action === 'reasoning')).toHaveLength(1);
  });
});
