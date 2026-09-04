// qa: card:B10052:2b4e49ff7d67dddeddd1fff86f17cd8814f42adc4f55ce818ce3626a24b4cdcf
// qa: card:B10052:d07664df6817b0416fa50208a1b956bf82c2d561391b6f194d393012540f493d
// qa: card:B10067:31a34608f12271a04aba19cad672bfdcf64f4e0408b8d148077a5aafa2c4f1e6
// qa: card:B10078:bdd23786387da4d393a9dcbe77c742348406994d4e79fee491aa51390cab441c

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { B10052 } from '@/cards/ct-p10/B10052';
import { B10067 } from '@/cards/ct-p10/B10067';
import { B10078 } from '@/cards/ct-p10/B10078';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetRegistry, register } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import { makeChar } from '../../helpers/fixtures';
import type { CardDef } from '@/engine/types';

const VANILLA: CardDef = {
  id: 'W208_VANILLA', no: 'W208_VANILLA', kind: 'character', names: ['能力なし'], colors: ['赤'],
  level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};
const DRAW = 'W208_DRAW';

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  [B10052, VANILLA, { ...VANILLA, id: DRAW, no: DRAW }].forEach(register);
  registerTriggeredListener();
});

afterEach(() => event._resetRegistry());

describe('official QA Wave208: CT-P10 original-ability, bond, and cut-in contracts', () => {
  it('resolves B10052 after its source leaves when an eligible character remains', () => {
    const state = createEmptyGameState();
    state.turn = { number: 4, player: 'self', phase: 'end', isFirstPlayerFirstTurn: false };
    state.players.self.deck = [DRAW];
    state.players.self.scene = [
      makeChar({ cardId: B10052.id, uid: 'haneda' }),
      makeChar({ cardId: VANILLA.id, uid: 'eligible' }),
    ];

    event.emit(state, 'phase:end:start', { player: 'self' });
    state.players.self.scene = state.players.self.scene.filter((character) => character.uid !== 'haneda');
    runAllUntilEmpty(state);

    expect(state.players.self.hand).toContain(DRAW);
  });

  it('checks B10052 eligibility when its queued end-turn effect resolves', () => {
    const state = createEmptyGameState();
    state.turn = { number: 4, player: 'self', phase: 'end', isFirstPlayerFirstTurn: false };
    state.players.self.deck = [DRAW];
    state.players.self.scene = [makeChar({ cardId: B10052.id, uid: 'haneda' })];

    event.emit(state, 'phase:end:start', { player: 'self' });
    state.players.self.scene.push(makeChar({ cardId: VANILLA.id, uid: 'eligible' }));
    runAllUntilEmpty(state);

    expect(state.players.self.hand).toContain(DRAW);
  });

  it('lets B10067 target active opposing characters only with the Morofushi bond', () => {
    expect(B10067.abilities.find((candidate) => candidate.id === 'a1')).toMatchObject({
      type: 'continuous',
      condition: { kind: 'bond', cardName: '諸伏景光' },
      continuousModifier: { grantKeywords: expect.any(Function) },
    });
    expect(B10067.abilities.find((candidate) => candidate.id === 'a1')!.continuousModifier!.grantKeywords!()).toEqual(['text:actionTargetsActive']);
  });

  it('applies B10078 Police AP only to its own-turn contact cut-in', () => {
    expect(B10078.abilities.find((candidate) => candidate.id === 'a1')).toMatchObject({
      type: 'triggered',
      scope: 'on-hand',
      trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
      condition: { kind: 'and', cs: [{ kind: 'turn', player: 'self' }, { kind: 'contactCharMatches', who: 'byUid', filter: { trait: ['警察'] } }] },
      effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
    });
  });
});
