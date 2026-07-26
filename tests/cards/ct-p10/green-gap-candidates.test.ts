import { describe, expect, it } from 'vitest';
import { B10042 } from '@/cards/ct-p10/B10042';
import { B10048 } from '@/cards/ct-p10/B10048';
import { B10054 } from '@/cards/ct-p10/B10054';
import { B10061 } from '@/cards/ct-p10/B10061';
import { B10066 } from '@/cards/ct-p10/B10066';
import { runCardScenario } from '../../helpers/card-probe-harness';
import type { CardDef } from '@/engine/types';

function character(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['白'], level: 3, ap: 3000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}

describe('CT-P10 green-gap candidates', () => {
  it('exports the fully grounded cards', () => {
    expect([B10042, B10048, B10054, B10061, B10066].map((card) => card.id))
      .toEqual(['B10042', 'B10048', 'B10054', 'B10061', 'B10066']);
  });

  it('B10042 sets and buffs only another white character', () => {
    const white = character('YUKIKO_WHITE');
    const nonWhite = character('YUKIKO_BLUE', { colors: ['青'] });
    const after = runCardScenario(B10042, [white, nonWhite], {
      name: 'B10042 enter target',
      setup: {
        selfScene: [{ cardId: 'B10042', uid: 'yukiko#1' }, { cardId: white.id, uid: 'white#1' }, { cardId: nonWhite.id, uid: 'blue#1' }],
        deckTop: ['YUKIKO_SET'],
      },
      drive: { kind: 'enter', cardId: 'B10042', uid: 'yukiko#1' },
      script: [{ pickUid: 'white#1' }],
      expect: [
        { kind: 'apDelta', uid: 'white#1', n: 1000 },
        { kind: 'candidatesExclude', pickIndex: 0, uid: 'yukiko#1' },
        { kind: 'candidatesExclude', pickIndex: 0, uid: 'blue#1' },
      ],
    });
    expect(after.players.self.scene.find((c) => c.uid === 'white#1')!.setCards.map((c) => c.cardId)).toEqual(['YUKIKO_SET']);
  });

  it('B10054 reveals four, permits an eligible selection, then moves remaining cards to the deck bottom', () => {
    const eligible = character('SHINIDE_RED', { colors: ['赤'], level: 6 });
    const blue = character('SHINIDE_BLUE', { colors: ['青'] });
    const handCost = character('SHINIDE_HAND_COST');
    const after = runCardScenario(B10054, [eligible, blue, handCost], {
      name: 'B10054 reveal and bottom order',
      setup: {
        caseColors: ['赤', '黄'], selfScene: [{ cardId: 'B10054', uid: 'shinide#1' }], hand: [handCost.id],
        deckTop: [eligible.id, blue.id],
      },
      drive: { kind: 'enter', cardId: 'B10054', uid: 'shinide#1' },
      script: [{ pickCardId: eligible.id }, { pickCardId: handCost.id }],
      expect: [
        { kind: 'zone', cardId: eligible.id, zone: 'hand', side: 'self', present: true },
        { kind: 'zone', cardId: handCost.id, zone: 'remove', side: 'self', present: true },
        { kind: 'zone', cardId: blue.id, zone: 'deck', side: 'self', present: true },
      ],
    });
    expect(after.players.self.deck.indexOf(blue.id)).toBeGreaterThan(after.players.self.deck.indexOf('__DECK_S_5'));
  });

  it('B10048 grants the contact rider to every selected character', () => {
    const target = character('MAKOTO_TARGET');
    const after = runCardScenario(B10048, [target], {
      name: 'B10048 grant contact ability',
      setup: { caseColors: ['白'], fileCount: 5, hand: ['B10048'], selfScene: [{ cardId: target.id, uid: 'makoto#1' }] },
      drive: { kind: 'event-use', cardId: 'B10048' },
      script: [{ pickCardIds: [target.id] }],
      expect: [],
    });
    expect(after.players.self.scene[0]!.turnEffects.grantedAbilities).toHaveLength(1);
  });

  it('B10061 applies both mandatory costs before its post-cost hand-size choice', () => {
    expect(B10061.abilities[1]).toMatchObject({
      condition: { kind: 'caseStatus', status: '解決編' },
      cost: { kind: 'pay', items: [{ kind: 'removeFromHand' }, { kind: 'removeDeckTop', n: 2 }] },
    });
    const effect = B10061.abilities[1]!.effect;
    expect(effect?.kind).toBe('choice');
    expect(effect && 'options' in effect && effect.options).toContainEqual(
      expect.objectContaining({ kind: 'conditional', if: { kind: 'handAtMost', player: 'self', n: 2 } }),
    );
  });

  it('B10066 requires the exact named hand payment and a contact AP removal', () => {
    expect(B10066.abilities[1]).toMatchObject({
      limit: { kind: 'turn', n: 1 },
      condition: { kind: 'and', cs: expect.arrayContaining([
        { kind: 'bond', cardName: '降谷零' },
        { kind: 'removedCharMatches', side: 'opp', cause: 'contact-ap', by: 'self' },
      ]) },
    });
    expect(B10066.abilities[1]!.effect).toMatchObject({
      kind: 'optional', effect: { kind: 'chain' },
    });
  });
});
