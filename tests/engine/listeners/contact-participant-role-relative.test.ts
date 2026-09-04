import { beforeEach, describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { D07018 } from '@/cards/ct-d07/D07018';
import { D11007 } from '@/cards/ct-d11/D11007';
import { B08038 } from '@/cards/ct-p08/B08038';
import { engine } from '@/engine';
import { event } from '@/engine/event';
import {
  _resetTriggeredRegistered,
  registerTriggeredListener,
} from '@/engine/listeners/triggered';
import {
  _clearPendingEffectOptionalSide,
  _clearPendingEffectPickQueue,
  _peekPendingEffectOptionalSide,
} from '@/engine/effect/resolve-picks';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState } from '@/engine/types';
import { makeChar } from '../../helpers/fixtures';

function character(id: string, level: number, ap: number, abilities: CardDef['abilities'] = []): CardDef {
  return {
    id,
    no: id,
    kind: 'character',
    names: [id],
    colors: ['赤'],
    level,
    ap,
    lp: 1,
    traits: [],
    keywords: [],
    rarity: 'C',
    imageUrl: '',
    abilities,
    ruleRefs: [],
  };
}

const OTHER = character('CONTACT_OTHER', 6, 7000);
const BINDING_HOST = character('CONTACT_BINDING_HOST', 1, 3000, [{
  id: 'role-relative-contact-binding',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'contact:start', selfOnly: true },
  effect: {
    kind: 'atom',
    verb: 'charModifyAP',
    args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' },
  },
  description: 'Modify this contact participant through its relative contact binding.',
  ruleRefs: ['rules/08-contact.md'],
}]);

function stateWith(subject: CardDef, subjectAp?: number): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.scene = [makeChar({
    cardId: subject.id,
    uid: 'subject',
    apOverride: subjectAp ?? null,
  })];
  state.players.opp.scene = [makeChar({ cardId: OTHER.id, uid: 'other' })];
  return state;
}

function emitOtherIntoSubject(state: GameState): GameState {
  return produce(state, (draft) => {
    event.emit(draft, 'contact:start', { aUid: 'other', bUid: 'subject' }, {
      player: 'opp',
      uid: 'other',
      bindings: {
        contact: [{
          byUid: 'other',
          byPlayer: 'opp',
          targetUid: 'subject',
          attackerSide: 'opp',
        }],
      },
    });
  });
}

function install(...cards: CardDef[]): void {
  for (const card of [OTHER, ...cards]) engine.cards.register(card);
  registerTriggeredListener();
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  engine.cards._resetRegistry();
  _clearPendingEffectOptionalSide();
  _clearPendingEffectPickQueue();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
});

describe('contact:start participant-relative self triggers', () => {
  it('surfaces B08038 when it is the bUid participant on its owner turn', () => {
    install(B08038);
    const state = emitOtherIntoSubject(stateWith(B08038));

    produce(state, (draft) => { runAllUntilEmpty(draft); });

    expect(_peekPendingEffectOptionalSide()?.source).toMatchObject({
      cardId: B08038.id,
      uid: 'subject',
      abilityId: 'a1',
    });
  });

  it('compares D11007 with the other participant when it is bUid', () => {
    install(D11007);
    const state = emitOtherIntoSubject(stateWith(D11007, 5000));

    expect(state.pendingEffects).toEqual([
      expect.objectContaining({ source: expect.objectContaining({ cardId: D11007.id, uid: 'subject' }) }),
    ]);
  });

  it('maps $trigger.bUid to the other participant for D07018', () => {
    install(D07018);
    const state = emitOtherIntoSubject(stateWith(D07018));
    const resolved = produce(state, (draft) => { runAllUntilEmpty(draft); });

    expect(resolved.players.opp.remove).toContain(OTHER.id);
    expect(resolved.players.self.scene.map((card) => card.uid)).toContain('subject');
  });

  it('maps $contact.byUid to the self-triggering bUid participant', () => {
    install(BINDING_HOST);
    const state = emitOtherIntoSubject(stateWith(BINDING_HOST));
    const resolved = produce(state, (draft) => { runAllUntilEmpty(draft); });

    expect(engine.read.char.ap(resolved, 'subject')).toBe(4000);
    expect(engine.read.char.ap(resolved, 'other')).toBe(7000);
  });
});
