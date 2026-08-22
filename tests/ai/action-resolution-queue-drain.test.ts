import { beforeEach, describe, expect, it } from 'vitest';
import { resolveActionAgainstCase, resolveActionAgainstChar } from '@/ai/action-resolution';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { event } from '@/engine/event';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { mutate } from '@/engine/mutate';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { produce } from '@/engine/produce';
import { _resetRegistry as resetDefRegistry, register as registerCardDef } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, Effect, GameState } from '@/engine/types';

function card(id: string, ap: number): CardDef {
  return {
    id,
    no: id,
    kind: 'character',
    names: [id],
    colors: ['青'],
    level: 1,
    ap,
    lp: 1,
    traits: [],
    rarity: 'C',
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
  };
}

function contactBoard(): { state: GameState; attackerUid: string; defenderUid: string; markerUid: string } {
  let attackerUid = '';
  let defenderUid = '';
  let markerUid = '';
  const state = produce(createEmptyGameState(), (draft) => {
    draft.turn.player = 'self';
    draft.turn.phase = 'main';
    attackerUid = mutate.scene.enter(draft, 'self', 'QUEUE-ATK', {}).uid;
    markerUid = mutate.scene.enter(draft, 'self', 'QUEUE-MARK', {}).uid;
    defenderUid = mutate.scene.enter(draft, 'opp', 'QUEUE-DEF', {}).uid;
    mutate.scene.setState(draft, defenderUid, 'sleep');
  });
  return { state, attackerUid, defenderUid, markerUid };
}

function sleepPickedCharacter(): Effect {
  return {
    kind: 'atom',
    verb: 'sceneSetState',
    args: {
      uid: '$pick',
      state: 'sleep',
      target: {
        kind: 'pick',
        query: { area: 'scene', side: 'self' },
        n: { min: 1, max: 1 },
        chooser: 'self',
      },
    },
  };
}

function unresolvedEffects(state: GameState): number {
  return state.pendingEffects.filter((entry) => entry.state === 'pending' || entry.state === 'resolving').length;
}

describe('AI action resolution queue boundaries', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetActionContexts();
    _resetUidCounter();
    resetDefRegistry();
    registerCardDef(card('QUEUE-ATK', 2000));
    registerCardDef(card('QUEUE-DEF', 1000));
    registerCardDef(card('QUEUE-MARK', 500));
  });

  it('drains effects queued by contact:start before continuing the contact', () => {
    event.on('contact:start', () => ({
      kind: 'custom',
      fn: (state: GameState) => { state.players.self.hand.push('CONTACT-START-RAN'); },
    }));
    const setup = contactBoard();

    const after = produce(setup.state, (draft) => {
      resolveActionAgainstChar(
        draft,
        setup.attackerUid,
        setup.defenderUid,
        new HeuristicPolicy(),
      );
    });

    expect(after.players.self.hand).toContain('CONTACT-START-RAN');
    expect(unresolvedEffects(after)).toBe(0);
  });

  it('drains effects queued by contact:judge before closing the action', () => {
    event.on('contact:judge', () => ({
      kind: 'custom',
      fn: (state: GameState) => { state.players.self.hand.push('CONTACT-JUDGE-RAN'); },
    }));
    const setup = contactBoard();

    const after = produce(setup.state, (draft) => {
      resolveActionAgainstChar(
        draft,
        setup.attackerUid,
        setup.defenderUid,
        new HeuristicPolicy(),
      );
    });

    expect(after.players.self.hand).toContain('CONTACT-JUDGE-RAN');
    expect(unresolvedEffects(after)).toBe(0);
  });

  it('resolves a real $pick queued by contact:start before opening the cut-in window', () => {
    event.on('contact:start', sleepPickedCharacter);
    const setup = contactBoard();
    const policy = new HeuristicPolicy();
    let markerStateAtCutIn: string | undefined;
    policy.chooseAtomTarget = (_state, _verb, _args, candidates) => (
      candidates.find((candidate) => candidate.uid === setup.markerUid) ?? null
    );
    policy.chooseCutIn = (state) => {
      markerStateAtCutIn = state.players.self.scene.find((cardState) => cardState.uid === setup.markerUid)?.state;
      return null;
    };

    const after = produce(setup.state, (draft) => {
      resolveActionAgainstChar(
        draft,
        setup.attackerUid,
        setup.defenderUid,
        policy,
        policy,
      );
    });

    expect(markerStateAtCutIn).toBe('sleep');
    expect(after.players.self.scene.find((cardState) => cardState.uid === setup.markerUid)?.state).toBe('sleep');
    expect(unresolvedEffects(after)).toBe(0);
  });

  it('resolves a real $pick queued by contact:judge before returning control', () => {
    event.on('contact:judge', sleepPickedCharacter);
    const setup = contactBoard();
    const policy = new HeuristicPolicy();
    policy.chooseAtomTarget = (_state, _verb, _args, candidates) => (
      candidates.find((candidate) => candidate.uid === setup.markerUid) ?? null
    );

    const after = produce(setup.state, (draft) => {
      resolveActionAgainstChar(
        draft,
        setup.attackerUid,
        setup.defenderUid,
        policy,
        policy,
      );
    });

    expect(after.players.self.scene.find((cardState) => cardState.uid === setup.markerUid)?.state).toBe('sleep');
    expect(unresolvedEffects(after)).toBe(0);
  });

  it.each(['character target', 'guarded case'] as const)(
    'does not judge after contact:start removes both participants for a %s',
    (route) => {
      const setup = contactBoard();
      const initial = route === 'guarded case'
        ? produce(setup.state, (draft) => {
            mutate.scene.setState(draft, setup.defenderUid, 'active');
            draft.players.opp.evidence.push({
              cardId: 'QUEUE-EVIDENCE',
              faceUp: true,
              origin: { turn: 0, via: 'opening' },
            });
          })
        : setup.state;
      const observed: string[] = [];
      event.on('contact:start', () => ({
        kind: 'custom',
        fn: (state: GameState) => {
          mutate.scene.removeToRemove(state, setup.attackerUid, 'effect');
          mutate.scene.removeToRemove(state, setup.defenderUid, 'effect');
        },
      }));
      event.on('contact:end', () => { observed.push('contact:end'); });
      event.on('action:end', () => { observed.push('action:end'); });
      event.on('contact:before-judge', () => { observed.push('contact:before-judge'); });
      event.on('contact:judge', () => { observed.push('contact:judge'); });
      const policy = new HeuristicPolicy();
      policy.chooseGuard = () => route === 'guarded case' ? setup.defenderUid : null;

      const after = produce(initial, (draft) => {
        if (route === 'guarded case') {
          resolveActionAgainstCase(draft, setup.attackerUid, 'opp', policy, policy);
        } else {
          resolveActionAgainstChar(draft, setup.attackerUid, setup.defenderUid, policy, policy);
        }
      });

      expect(observed).toEqual(['contact:end', 'action:end']);
      expect(Object.keys(after.actionContexts ?? {})).toHaveLength(0);
      expect(unresolvedEffects(after)).toBe(0);
    },
  );
});
