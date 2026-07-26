import { beforeEach, describe, expect, it } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { mutate } from '@/engine/mutate';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { makeChar } from '../../helpers/fixtures';
import type { CardDef, GameState } from '@/engine/types';

type GlobalHuman = { __humanPlayerSide?: 'self' | 'opp' | null };

const GUARDIAN: CardDef = {
  id: 'HISTORY_GUARDIAN', no: 'HISTORY_GUARDIAN', kind: 'character', names: ['HISTORY_GUARDIAN'],
  colors: ['青'], level: 3, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', ruleRefs: [],
  abilities: [{
    id: 'a1', type: 'triggered', scope: 'on-scene',
    trigger: { hook: 'leave:intercept', optional: true },
    effect: { kind: 'atom', verb: 'leaveInterceptRedirect', args: { destination: 'hand' } },
    description: '', ruleRefs: [],
  } as never],
};

const SET_GUARD: CardDef = {
  id: 'HISTORY_SET_GUARD', no: 'HISTORY_SET_GUARD', kind: 'event', names: ['HISTORY_SET_GUARD'],
  colors: ['青'], level: 0, ap: 0, lp: 0, traits: [], keywords: [], rarity: 'C', imageUrl: '', ruleRefs: [],
  abilities: [{
    id: 'a1', type: 'triggered', scope: 'on-set-host',
    trigger: { hook: 'leave:intercept' },
    effect: { kind: 'atom', verb: 'leaveInterceptRedirect', args: { destination: 'kept-in-scene' } },
    description: '', ruleRefs: [],
  } as never],
};

function base(): GameState {
  const state = createEmptyGameState();
  state.players.self.scene = [makeChar({ uid: 'attacker', cardId: 'ATTACKER' })];
  state.players.opp.scene = [makeChar({ uid: 'victim', cardId: 'VICTIM' })];
  return state;
}

describe('contact removal turn history', () => {
  beforeEach(() => {
    resetDefRegistry();
    (globalThis as GlobalHuman).__humanPlayerSide = null;
  });

  it('marks the opposing attacker only after a confirmed contact-ap removal, survives disguise, and clears at turn end', () => {
    const removed = produce(base(), draft => {
      mutate.scene.removeToRemove(draft, 'victim', 'contact-ap', 'attacker');
      mutate.char.disguiseInto(draft, 'attacker', 'DISGUISED_ATTACKER');
    });

    expect(removed.players.self.scene[0]).toMatchObject({
      cardId: 'DISGUISED_ATTACKER',
      turnEffects: { removedOpponentByContactThisTurn: true },
    });

    const cleaned = produce(removed, draft => {
      mutate.char.clearTurnEffects(draft, 'attacker', 'turn');
    });
    expect(cleaned.players.self.scene[0]!.turnEffects.removedOpponentByContactThisTurn).toBeUndefined();
  });

  it('does not mark stale targets, hand redirects, or kept-in-scene replacements', () => {
    const stale = produce(base(), draft => {
      mutate.scene.removeToRemove(draft, 'missing', 'contact-ap', 'attacker');
    });
    expect(stale.players.self.scene[0]!.turnEffects.removedOpponentByContactThisTurn).toBeUndefined();

    const redirectedBase = createEmptyGameState();
    redirectedBase.players.opp.scene = [
      makeChar({ uid: 'opp-attacker', cardId: 'ATTACKER' }),
    ];
    redirectedBase.players.self.scene = [
      makeChar({ uid: 'redirected-victim', cardId: 'VICTIM' }),
      makeChar({ uid: 'interceptor', cardId: 'INTERCEPTOR' }),
    ];
    const redirected = produce(redirectedBase, draft => {
      mutate.scene.removeToRemove(draft, 'redirected-victim', 'contact-ap', 'opp-attacker', {
        leaveInterceptDecision: { interceptorUid: 'interceptor', accept: true },
      });
    });
    expect(redirected.players.opp.scene[0]!.turnEffects.removedOpponentByContactThisTurn).toBeUndefined();

    registerCardDef(SET_GUARD);
    const keptBase = createEmptyGameState();
    keptBase.players.opp.scene = [makeChar({ uid: 'kept-attacker', cardId: 'ATTACKER' })];
    keptBase.players.self.scene = [makeChar({
      uid: 'kept-victim',
      cardId: 'VICTIM',
      setCards: [{ cardId: 'HISTORY_SET_GUARD', faceUp: true }],
    })];
    const kept = produce(keptBase, draft => {
      mutate.scene.removeToRemove(draft, 'kept-victim', 'contact-ap', 'kept-attacker');
    });
    expect(kept.players.opp.scene[0]!.turnEffects.removedOpponentByContactThisTurn).toBeUndefined();
  });

  it('does not mark while deferred, then marks when the declined leave-intercept resumes removal', () => {
    registerCardDef(GUARDIAN);
    (globalThis as GlobalHuman).__humanPlayerSide = 'opp';
    const deferredBase = base();
    deferredBase.players.opp.scene.push(makeChar({ uid: 'guardian', cardId: 'HISTORY_GUARDIAN' }));

    const deferred = produce(deferredBase, draft => {
      const result = mutate.scene.removeToRemove(draft, 'victim', 'contact-ap', 'attacker');
      expect(result.deferred).toBe(true);
    });
    expect(deferred.players.self.scene[0]!.turnEffects.removedOpponentByContactThisTurn).toBeUndefined();

    const resumed = produce(deferred, draft => {
      mutate.scene.resolveLeaveIntercept(draft, 'victim', 'contact-ap', 'attacker', 'opp', 'guardian', false);
    });
    expect(resumed.players.self.scene[0]!.turnEffects.removedOpponentByContactThisTurn).toBe(true);
  });
});
