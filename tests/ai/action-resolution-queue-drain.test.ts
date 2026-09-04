import { beforeEach, describe, expect, it } from 'vitest';
import { resolveActionAgainstCase, resolveActionAgainstChar } from '@/ai/action-resolution';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { B01098 } from '@/cards/ct-p01/B01098';
import { B09052 } from '@/cards/ct-p09/B09052';
import { event } from '@/engine/event';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { produce } from '@/engine/produce';
import { _resetRegistry as resetDefRegistry, register as registerCardDef } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, Effect, GameState } from '@/engine/types';
import type { AIPolicy } from '@/ai/policy';

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
    _resetTriggeredRegistered();
    _resetActionContexts();
    _resetUidCounter();
    resetDefRegistry();
    registerCardDef(card('QUEUE-ATK', 2000));
    registerCardDef(card('QUEUE-DEF', 1000));
    registerCardDef(card('QUEUE-MARK', 500));
    registerCardDef(B01098);
    registerTriggeredListener();
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

  it('supplies a registered name to B09052 in the synchronous AI contact lane', () => {
    const combined = {
      ...card('QUEUE-COMBINED', 3000),
      names: ['江戸川コナン&工藤新一', '江戸川コナン', '工藤新一'],
    };
    registerCardDef(combined);
    registerCardDef(B09052);
    const state = createEmptyGameState();
    state.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    const attackerUid = mutate.scene.enter(state, 'self', combined.id, {}).uid;
    const defenderUid = mutate.scene.enter(state, 'opp', 'QUEUE-DEF', {}).uid;
    mutate.scene.setState(state, defenderUid, 'sleep');
    state.players.self.hand = [B09052.id];
    const attackerPolicy: AIPolicy = {
      name: 'wave107-cutin-name',
      choose: () => null,
      chooseCutIn: (_state, _action, _player, candidates) => (
        candidates.includes(B09052.id) ? B09052.id : null
      ),
    };

    let after: GameState | undefined;
    expect(() => {
      after = produce(state, draft => {
        resolveActionAgainstChar(
          draft,
          attackerUid,
          defenderUid,
          new HeuristicPolicy(),
          attackerPolicy,
        );
      });
    }).not.toThrow();
    expect(after?.pendingEffects.find(entry => (
      entry.source.cardId === B09052.id && entry.source.abilityId === 'a2'
    ))?.dyn?.declaredName).toEqual(expect.any(String));
  });

  it('stops AI contact after B01098 removes both participants in action-2', () => {
    const setup = contactBoard();
    const initial = produce(setup.state, (draft) => {
      draft.players.self.hand = [B01098.id];
    });
    const policy = new HeuristicPolicy();
    const seenCutInCandidates: Array<{ player: 'self' | 'opp'; candidates: string[] }> = [];
    policy.chooseCutIn = (_state, _ax, player, candidates) => {
      seenCutInCandidates.push({ player, candidates: [...candidates] });
      return player === 'self' && candidates.includes(B01098.id) ? B01098.id : null;
    };
    let contactEnds = 0;
    let contactJudges = 0;
    event.on('contact:end', () => {
      contactEnds += 1;
      return {
        kind: 'custom',
        fn: (state: GameState) => { state.players.self.hand.push('CONTACT-END-RAN'); },
      };
    });
    event.on('contact:judge', () => { contactJudges += 1; });

    const after = produce(initial, (draft) => {
      resolveActionAgainstChar(
        draft,
        setup.attackerUid,
        setup.defenderUid,
        policy,
        policy,
      );
    });

    expect(seenCutInCandidates).toEqual([
      { player: 'opp', candidates: [] },
      { player: 'self', candidates: [B01098.id] },
    ]);
    expect(after.players.self.scene.some(cardState => cardState.uid === setup.attackerUid)).toBe(false);
    expect(after.players.opp.scene.some(cardState => cardState.uid === setup.defenderUid)).toBe(false);
    expect(Object.keys(after.actionContexts ?? {})).toHaveLength(0);
    expect(contactEnds).toBe(1);
    expect(contactJudges).toBe(0);
    expect(after.players.self.hand).toContain('CONTACT-END-RAN');
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
      const marker = `EARLY-CONTACT-END-${route}`;
      event.on('contact:start', () => ({
        kind: 'custom',
        fn: (state: GameState) => {
          mutate.scene.removeToRemove(state, setup.attackerUid, 'effect');
          mutate.scene.removeToRemove(state, setup.defenderUid, 'effect');
        },
      }));
      event.on('contact:end', () => {
        observed.push('contact:end');
        return {
          kind: 'custom',
          fn: (state: GameState) => {
            state.players.self.hand.push(marker);
            observed.push('contact:end:effect');
          },
        };
      });
      event.on('action:end', (state) => {
        observed.push(state.players.self.hand.includes(marker) ? 'action:end' : 'action:end-before-contact-effect');
      });
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

      expect(observed).toEqual(['contact:end', 'contact:end:effect', 'action:end']);
      expect(after.players.self.hand).toContain(marker);
      expect(Object.keys(after.actionContexts ?? {})).toHaveLength(0);
      expect(unresolvedEffects(after)).toBe(0);
    },
  );

  it.each(['character target', 'guarded case'] as const)(
    'drains contact:end effects before action:end after a normal %s judge',
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
      const marker = `NORMAL-CONTACT-END-${route}`;
      const observed: string[] = [];
      event.on('contact:end', () => {
        observed.push('contact:end');
        return {
          kind: 'custom',
          fn: (state: GameState) => {
            state.players.self.hand.push(marker);
            observed.push('contact:end:effect');
          },
        };
      });
      event.on('action:end', (state) => {
        observed.push(state.players.self.hand.includes(marker) ? 'action:end' : 'action:end-before-contact-effect');
      });
      const policy = new HeuristicPolicy();
      policy.chooseGuard = () => route === 'guarded case' ? setup.defenderUid : null;

      const after = produce(initial, (draft) => {
        if (route === 'guarded case') {
          resolveActionAgainstCase(draft, setup.attackerUid, 'opp', policy, policy);
        } else {
          resolveActionAgainstChar(draft, setup.attackerUid, setup.defenderUid, policy, policy);
        }
      });

      expect(observed).toEqual(['contact:end', 'contact:end:effect', 'action:end']);
      expect(after.players.self.hand).toContain(marker);
      expect(Object.keys(after.actionContexts ?? {})).toHaveLength(0);
      expect(unresolvedEffects(after)).toBe(0);
    },
  );
});
