import { beforeEach, describe, expect, it } from 'vitest';
import { B10086, B10086P } from '@/cards/ct-p10/B10086';
import { _resetActionContexts, action as flowAction } from '@/engine/flow/action/state-machine';
import { canCutIn, canDisguise, cutIn } from '@/engine/flow/contact';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetRegistry, register } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState } from '@/engine/types';
import { sceneChar } from '../../helpers/fixtures';

const BOURBON: CardDef = {
  id: 'B10086_BOURBON', no: 'B10086_BOURBON', kind: 'character', names: ['バーボン'], colors: ['黒'],
  level: 1, ap: 1000, lp: 1, traits: [], keywords: ['カットイン'], rarity: 'C', imageUrl: '',
  abilities: [{
    id: 'cutin', type: 'triggered', scope: 'on-hand',
    trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
    effect: { kind: 'atom', verb: 'noop', args: {} }, description: 'zero-result cutin', ruleRefs: [],
  }], ruleRefs: [],
};
const DISGUISE: CardDef = {
  id: 'B10086_DISGUISE', no: 'B10086_DISGUISE', kind: 'character', names: ['Disguise'], colors: ['黒'],
  level: 1, ap: 1000, lp: 1, traits: [], keywords: ['変装'], rarity: 'C', imageUrl: '',
  abilities: [{ id: 'disguise', type: 'icon-disguise', description: 'disguise', ruleRefs: [] }], ruleRefs: [],
};
const TARGET: CardDef = {
  id: 'B10086_TARGET', no: 'B10086_TARGET', kind: 'character', names: ['Target'], colors: ['黒'],
  level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};
const ALLY: CardDef = { ...TARGET, id: 'B10086_ALLY', no: 'B10086_ALLY', names: ['Ally'] };

function state(card: CardDef = B10086): GameState {
  const value = createEmptyGameState();
  value.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  value.players.self.partner.cardId = 'B10086_PARTNER_BLACK';
  value.players.self.scene = [sceneChar(card.id, 'scotch', { state: 'sleep' }), sceneChar(ALLY.id, 'ally')];
  value.players.opp.scene = [sceneChar(TARGET.id, 'target')];
  value.players.self.hand = [BOURBON.id, DISGUISE.id];
  value.players.opp.hand = [BOURBON.id];
  return value;
}

function contact(value: GameState, byUid = 'scotch') {
  const ax = flowAction.startFromEffect(value, byUid, 'target');
  expect(ax).not.toBeNull();
  return ax!;
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  _resetActionContexts();
  [B10086, B10086P, BOURBON, DISGUISE, TARGET, ALLY, {
    ...TARGET, id: 'B10086_PARTNER_BLACK', no: 'B10086_PARTNER_BLACK', names: ['Partner'], colors: ['黒'],
  }].forEach(register);
  registerTriggeredListener();
});

describe.each([B10086, B10086P])('$id: own-contact cutin ban', (card) => {
  it('activates and grants after a zero-result Bourbon cutin, preserving prior grants', () => {
    const value = state(card);
    value.players.self.scene[0]!.turnEffects.grantedAbilities = [{
      id: 'already-granted', type: 'triggered', scope: 'on-scene',
      trigger: { hook: 'enter' }, effect: { kind: 'atom', verb: 'noop', args: {} }, description: '', ruleRefs: [],
    }];
    const ax = contact(value);

    cutIn(value, ax, 'self', BOURBON.id);
    runAllUntilEmpty(value);

    const scotch = value.players.self.scene[0]!;
    expect(scotch.state).toBe('active');
    expect(scotch.turnEffects.grantedAbilities).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'already-granted' }),
      expect.objectContaining({ id: 'b10086-cutin-ban', type: 'continuous', continuousModifier: { selfCutinBanInContact: true } }),
    ]));
  });

  it('blocks only its bearer on a later contact; other side and disguise remain available', () => {
    const value = state(card);
    cutIn(value, contact(value), 'self', BOURBON.id);
    runAllUntilEmpty(value);
    value.players.self.hand.push(BOURBON.id);

    const ownContact = contact(value);
    expect(canCutIn(value, ownContact, 'self', BOURBON.id), 'shared UI/AI cutin gate').toBe(false);
    expect(canDisguise(value, ownContact, 'self', DISGUISE.id), 'the cutin-only grant does not block disguise').toBe(true);

    const allyContact = contact(value, 'ally');
    expect(canCutIn(value, allyContact, 'self', BOURBON.id), 'another self character is not banned').toBe(true);
    expect(canCutIn(value, allyContact, 'opp', BOURBON.id), 'the other side is not banned').toBe(true);
  });
});
