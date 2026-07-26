import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event';
import { mutate } from '@/engine/mutate';
import { register as registerCardDef, _resetRegistry as resetCardDefRegistry } from '@/engine/read/def';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import type { AbilityDef, CardDef, GameState } from '@/engine/types';

const DRAW = { kind: 'atom' as const, verb: 'draw', args: { player: 'self' as const, n: 1 } };

const selfLeave: AbilityDef = {
  id: 'self-leave',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'leave:to-remove', selfOnly: true },
  effect: DRAW,
  description: '自身が現場からリムーブされたとき、カードを1枚引く。',
  ruleRefs: [],
};

function char(id: string, abilities: AbilityDef[] = []): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['青'], level: 1, ap: 1000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities, ruleRefs: [],
  };
}

const blocker = char('BLOCKER', [{
  id: 'contact-leave-self-trigger-ban',
  type: 'continuous',
  scope: 'on-scene',
  condition: { kind: 'and', cs: [{ kind: 'turn', player: 'self' }, { kind: 'caseStatus', status: '解決編' }] },
  continuousModifier: { opponentRestrict: ['contactLeaveSelfTrigger'] as never },
  description: '相手の、コンタクトによって現場からリムーブされたときの能力は発動しない。',
  ruleRefs: [],
}]);
const printed = char('PRINTED', [selfLeave]);
const host = char('HOST');
const rider: CardDef = {
  id: 'RIDER', no: 'RIDER', kind: 'event', names: ['RIDER'], colors: ['青'], level: 1,
  traits: [], rarity: 'C', imageUrl: '', ruleRefs: [],
  abilities: [{ ...selfLeave, id: 'rider-self-leave', scope: 'on-set-host' }],
};
const granted = char('GRANTED');
const aura = char('AURA', [{
  id: 'grant-self-leave',
  type: 'continuous',
  scope: 'on-scene',
  continuousModifier: {
    triggeredAbilityAura: { filter: { kind: 'character', trait: 'recipient' }, excludeSelf: true, ability: { ...selfLeave, id: 'aura-self-leave' } },
  },
  description: '他のキャラに現場リムーブ時能力を与える。',
  ruleRefs: [],
}]);
const recipient: CardDef = { ...char('RECIPIENT'), traits: ['recipient'] };
const observer = char('OBSERVER', [{
  id: 'observer-leave',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'leave:to-remove' },
  effect: DRAW,
  description: 'キャラが現場からリムーブされたとき、カードを1枚引く。',
  ruleRefs: [],
}]);

function state(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.case.status = '解決編';
  return s;
}

beforeEach(() => {
  event._resetRegistry(); _resetTriggeredRegistered(); resetCardDefRegistry(); _resetUidCounter();
  for (const card of [blocker, printed, host, rider, granted, aura, recipient, observer]) registerCardDef(card);
  registerTriggeredListener();
});

describe('contact leave self-trigger suppression', () => {
  it('suppresses every self-owned leave path before queueing while preserving third-party observers', () => {
    const s = state();
    mutate.scene.enter(s, 'self', 'BLOCKER', {});
    const printedUid = mutate.scene.enter(s, 'opp', 'PRINTED', {}).uid;
    const hostUid = mutate.scene.enter(s, 'opp', 'HOST', {}).uid;
    mutate.char.setCard(s, hostUid, 'RIDER', true);
    mutate.char.setCard(s, hostUid, 'RIDER', true);
    const grantedUid = mutate.scene.enter(s, 'opp', 'GRANTED', {}).uid;
    s.players.opp.scene.find((c) => c.uid === grantedUid)!.turnEffects.grantedAbilities = [selfLeave];
    mutate.scene.enter(s, 'opp', 'AURA', {});
    const recipientUid = mutate.scene.enter(s, 'opp', 'RECIPIENT', {}).uid;
    mutate.scene.enter(s, 'self', 'OBSERVER', {});

    for (const uid of [printedUid, hostUid, grantedUid, recipientUid]) mutate.scene.removeToRemove(s, uid, 'contact-ap');

    expect(s.pendingEffects).toHaveLength(4);
    expect(s.pendingEffects.every((entry) => entry.source.cardId === 'OBSERVER')).toBe(true);
  });

  it.each(['effect', 'cost', 'switch'] as const)('keeps self leave triggers for non-contact cause %s', (cause) => {
    const s = state();
    mutate.scene.enter(s, 'self', 'BLOCKER', {});
    const victim = mutate.scene.enter(s, 'opp', 'PRINTED', {});

    mutate.scene.removeToRemove(s, victim.uid, cause);

    expect(s.pendingEffects).toHaveLength(1);
    expect(s.pendingEffects[0]?.source.cardId).toBe('PRINTED');
  });

  it.each([
    ['opponent turn', (s: GameState) => { s.turn.player = 'opp'; }],
    ['case not resolved', (s: GameState) => { s.players.self.case.status = '事件編'; }],
  ])('keeps contact self leave triggers when blocker condition is false: %s', (_name, change) => {
    const s = state();
    change(s);
    mutate.scene.enter(s, 'self', 'BLOCKER', {});
    const victim = mutate.scene.enter(s, 'opp', 'PRINTED', {});

    mutate.scene.removeToRemove(s, victim.uid, 'contact-ap');

    expect(s.pendingEffects).toHaveLength(1);
    expect(s.pendingEffects[0]?.source.cardId).toBe('PRINTED');
  });

  it('does not remove effects that were already queued before the token becomes active', () => {
    const s = state();
    const first = mutate.scene.enter(s, 'opp', 'PRINTED', {});
    mutate.scene.removeToRemove(s, first.uid, 'contact-ap');
    mutate.scene.enter(s, 'self', 'BLOCKER', {});
    const second = mutate.scene.enter(s, 'opp', 'PRINTED', {});

    mutate.scene.removeToRemove(s, second.uid, 'contact-ap');

    expect(s.pendingEffects).toHaveLength(1);
    expect(s.pendingEffects[0]?.source.cardId).toBe('PRINTED');
  });

  it('keeps facedown set cards inactive under the existing set-card rule', () => {
    const s = state();
    const hostUid = mutate.scene.enter(s, 'opp', 'HOST', {}).uid;
    mutate.char.setCard(s, hostUid, 'RIDER', false);

    mutate.scene.removeToRemove(s, hostUid, 'contact-ap');

    expect(s.pendingEffects).toHaveLength(0);
  });
});
