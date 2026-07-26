import { describe, expect, it } from 'vitest';
import { B10050, B10050P } from '@/cards/ct-p10/B10050';
import { B10053 } from '@/cards/ct-p10/B10053';
import { B10040 } from '@/cards/ct-p10/B10040';
import { runCardScenario } from '../../helpers/card-probe-harness';
import type { CardDef } from '@/engine/types';

const character = (id: string, over: Partial<CardDef> = {}): CardDef => ({
  id, no: id, kind: 'character', names: [id], colors: ['青'], level: 3, ap: 3000, lp: 1,
  traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
});

describe('CT-P10 mid cluster', () => {
  it('B10040 chains its draw after the optional set-card removal', () => {
    expect(B10040.abilities[1]).toMatchObject({
      effect: { kind: 'chain', steps: [
        { kind: 'atom', verb: 'charRemoveSetCard', args: { side: 'opp', max: 1, faceDownOnly: true } },
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      ] },
    });
  });

  it('B10050 enters under a red partner, removes an optional level-7-or-less character, then draws', () => {
    const target = character('B10050_TARGET', { level: 7 });
    const highLevel = character('B10050_HIGH', { level: 8 });
    const after = runCardScenario(B10050, [target, highLevel], {
      name: 'B10050 enter removal',
      setup: {
        partnerColors: ['赤'],
        selfScene: [{ cardId: 'B10050', uid: 'jodie#1' }],
        oppScene: [{ cardId: target.id, uid: 'target#1' }, { cardId: highLevel.id, uid: 'high#1' }],
        deckTop: ['B10050_DRAW'],
      },
      drive: { kind: 'enter', cardId: 'B10050', uid: 'jodie#1' },
      script: ['optional:take', { pickUid: 'target#1' }],
      expect: [
        { kind: 'zone', cardId: target.id, zone: 'remove', side: 'opp', present: true },
        { kind: 'zone', cardId: 'B10050_DRAW', zone: 'hand', side: 'self', present: true },
        { kind: 'candidatesExclude', pickIndex: 0, uid: 'high#1' },
      ],
    });
    expect(after.players.opp.scene.map((c) => c.uid)).toEqual(['high#1']);
  });

  it('B10050 declaration requires a level-5 blank original-ability character and pays both costs', () => {
    expect(B10050.abilities[1]).toMatchObject({
      type: 'declared',
      condition: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { levelMin: 5, hasNoOriginalAbilityExceptIcons: ['カットイン', 'ヒラメキ'] } }, nMin: 1 },
      cost: { kind: 'pay', items: [{ kind: 'sleepSelf' }, { kind: 'removeFromScene', target: { kind: 'self' }, n: 1 }, { kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 }] },
      effect: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', side: 'either', max: 1, filter: { kind: 'character' } } },
    });
  });

  it('B10050P is the same CardDef behavior with its own printing metadata', () => {
    expect(B10050P).toMatchObject({ id: 'B10050P', no: '1109/B10050P', rarity: 'SRP', abilities: B10050.abilities });
    expect(B10050P.imageUrl).not.toBe(B10050.imageUrl);
  });

  it('B10053 requires another level-7 character, then offers removal or a level-7-or-more Bullet grant', () => {
    expect(B10053.abilities[0]).toMatchObject({
      type: 'declared',
      limit: { kind: 'turn', n: 1 },
      condition: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { levelIn: [7] }, excludeSelf: true }, nMin: 1 },
      cost: { kind: 'sleepSelf' },
      effect: {
        kind: 'choice', options: expect.arrayContaining([
          expect.objectContaining({ kind: 'atom', verb: 'sceneRemove', args: expect.objectContaining({ side: 'either', max: 1, filter: { kind: 'character', levelMax: 7 } }) }),
          expect.objectContaining({ kind: 'atom', verb: 'charGrantKeyword', args: expect.objectContaining({ side: 'either', max: 1, filter: { kind: 'character', levelMin: 7 }, kw: 'ブレット', scope: 'turn' }) }),
        ]),
      },
    });
  });

});
