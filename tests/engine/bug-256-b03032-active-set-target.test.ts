// BUG-256: B03032 / B03032P active target exception for set-card hosts.
// rules: 07-action-flow.md, 16-card-set.md; QA: card:B03032:c07c3f8ad74eff2c29025e058e4559422062b44dae7e59dbe57af843b2fadb0a.

import { beforeEach, describe, expect, it } from 'vitest';
import { B03032 } from '@/cards/ct-p03/B03032';
import { B03032P } from '@/cards/ct-p03/B03032P';
import { produce } from '@/engine/produce';
import { declare, tryGuard, _resetActionContexts } from '@/engine/flow/action/state-machine';
import { candidates as actionTargetCandidates } from '@/engine/flow/action/target-expander';
import { canActionAgainstChar } from '@/engine/flow/main/action';
import { mutate } from '@/engine/mutate';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { def, register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { createMainGameState as createEmptyGameState } from '../helpers/main-game-state';
import type { CardDef, GameState } from '@/engine/types';

function character(id: string): CardDef {
  return {
    id,
    no: id,
    kind: 'character',
    names: [id],
    colors: ['赤'],
    level: 1,
    ap: 1000,
    lp: 1,
    traits: [],
    rarity: 'C',
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
  };
}

function board(attackerCardId: 'B03032' | 'B03032P' = 'B03032'): {
  state: GameState;
  attackerUid: string;
  setFaceDownUid: string;
  setFaceUpUid: string;
  setSleepUid: string;
  setStunUid: string;
  noSetUid: string;
  ownSetDecoyUid: string;
  guardUid: string;
} {
  let attackerUid = '';
  let setFaceDownUid = '';
  let setFaceUpUid = '';
  let setSleepUid = '';
  let setStunUid = '';
  let noSetUid = '';
  let ownSetDecoyUid = '';
  let guardUid = '';
  const state = produce(createEmptyGameState(), draft => {
    attackerUid = mutate.scene.enter(draft, 'self', attackerCardId, {}).uid;
    const ownSetDecoy = mutate.scene.enter(draft, 'self', 'OwnSetDecoy', {});
    ownSetDecoy.setCards.push({ cardId: 'back-card', faceUp: false });
    ownSetDecoyUid = ownSetDecoy.uid;
    const faceDown = mutate.scene.enter(draft, 'opp', 'TargetFaceDown', {});
    faceDown.setCards.push({ cardId: 'back-card', faceUp: false });
    setFaceDownUid = faceDown.uid;
    const faceUp = mutate.scene.enter(draft, 'opp', 'TargetFaceUp', {});
    faceUp.setCards.push({ cardId: 'SetEvent', faceUp: true });
    setFaceUpUid = faceUp.uid;
    const sleep = mutate.scene.enter(draft, 'opp', 'TargetSleep', { active: false });
    sleep.setCards.push({ cardId: 'back-card', faceUp: false });
    setSleepUid = sleep.uid;
    const stun = mutate.scene.enter(draft, 'opp', 'TargetStun', {});
    stun.setCards.push({ cardId: 'back-card', faceUp: false });
    mutate.scene.setState(draft, stun.uid, 'stun');
    setStunUid = stun.uid;
    noSetUid = mutate.scene.enter(draft, 'opp', 'TargetNoSet', {}).uid;
    guardUid = noSetUid;
  });
  return { state, attackerUid, setFaceDownUid, setFaceUpUid, setSleepUid, setStunUid, noSetUid, ownSetDecoyUid, guardUid };
}

describe('BUG-256 B03032 set-card active target exception', () => {
  beforeEach(() => {
    _resetUidCounter();
    _resetActionContexts();
    resetDefRegistry();
    registerCardDef(B03032);
    registerCardDef(B03032P);
    for (const id of ['TargetFaceDown', 'TargetFaceUp', 'TargetSleep', 'TargetStun', 'TargetNoSet', 'OwnSetDecoy', 'SetEvent']) {
      registerCardDef(character(id));
    }
  });

  it.each(['B03032', 'B03032P'] as const)('%s expands only to active opponent characters with a set card', (attackerCardId) => {
    const { state, attackerUid, setFaceDownUid, setFaceUpUid, setSleepUid, setStunUid, noSetUid, ownSetDecoyUid } = board(attackerCardId);

    expect(actionTargetCandidates(state, attackerUid).map(c => c.uid).sort())
      .toEqual([setFaceDownUid, setFaceUpUid, setSleepUid, setStunUid].sort());
    expect(canActionAgainstChar(state, attackerUid, setFaceDownUid)).toBe(true);
    expect(canActionAgainstChar(state, attackerUid, setFaceUpUid)).toBe(true);
    // Sleeping and stunned characters remain normal action targets; this card's
    // exception must not expand to them merely because they have set cards.
    expect(canActionAgainstChar(state, attackerUid, setSleepUid)).toBe(true);
    expect(canActionAgainstChar(state, attackerUid, setStunUid)).toBe(true);
    expect(canActionAgainstChar(state, attackerUid, noSetUid)).toBe(false);
    expect(canActionAgainstChar(state, attackerUid, ownSetDecoyUid)).toBe(false);

    const ability = (attackerCardId === 'B03032' ? B03032 : B03032P).abilities.find(a => a.id === 'a2');
    expect(ability?.effect).toMatchObject({
      kind: 'atom',
      verb: 'expandActionTargets',
      args: { side: 'opp', state: ['active'], hasSetCards: true },
    });
    expect(ability?.id).toBe('a2');
    expect(ability?.type).toBe('triggered');
  });

  it.each(['B03032', 'B03032P'] as const)('%s stops expanding active set-card targets after its host leaves the scene', (attackerCardId) => {
    const { state, attackerUid, setFaceDownUid, setFaceUpUid } = board(attackerCardId);

    const afterHostLeaves = produce(state, draft => {
      mutate.scene.removeToRemove(draft, attackerUid, 'effect');
    });

    expect(actionTargetCandidates(afterHostLeaves, attackerUid).map(c => c.uid).sort())
      .toEqual([]);
    expect(canActionAgainstChar(afterHostLeaves, attackerUid, setFaceDownUid)).toBe(false);
    expect(canActionAgainstChar(afterHostLeaves, attackerUid, setFaceUpUid)).toBe(false);
  });

  it('uses the attacker owner as the relative side when B03032 is opponent-owned', () => {
    let attackerUid = '';
    let selfSetTargetUid = '';
    const state = produce(createEmptyGameState(), draft => {
      draft.turn.player = 'opp';
      attackerUid = mutate.scene.enter(draft, 'opp', 'B03032', {}).uid;
      const selfSetTarget = mutate.scene.enter(draft, 'self', 'TargetFaceDown', {});
      selfSetTarget.setCards.push({ cardId: 'back-card', faceUp: false });
      selfSetTargetUid = selfSetTarget.uid;
    });

    expect(actionTargetCandidates(state, attackerUid).map(c => c.uid)).toEqual([selfSetTargetUid]);
    expect(canActionAgainstChar(state, attackerUid, selfSetTargetUid)).toBe(true);
  });

  // qa: card:B03032:c07c3f8ad74eff2c29025e058e4559422062b44dae7e59dbe57af843b2fadb0a
  it('keeps the selected active target from guarding while another active character may guard', () => {
    const { state, attackerUid, setFaceDownUid, guardUid } = board();

    const out = produce(state, draft => {
      const action = declare(draft, attackerUid, { kind: 'char', uid: setFaceDownUid });
      expect(() => tryGuard(draft, action, setFaceDownUid)).toThrow(/invalid guard/);
      expect(() => tryGuard(draft, action, guardUid)).not.toThrow();
    });

    expect(out.players.opp.scene.find(c => c.uid === guardUid)?.state).toBe('sleep');
    expect(def.card('B03032')?.abilities).toHaveLength(3);
    expect(def.card('B03032P')?.abilities).toHaveLength(3);
  });
});
