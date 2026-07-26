import { describe, expect, it } from 'vitest';
import { B10033, B10033P } from '@/cards/ct-p10/B10033';
import { B10052, B10052P } from '@/cards/ct-p10/B10052';
import { B10057 } from '@/cards/ct-p10/B10057';
import { runCardScenario } from '../../helpers/card-probe-harness';
import type { CardDef } from '@/engine/types';

const character = (id: string, over: Partial<CardDef> = {}): CardDef => ({
  id, no: id, kind: 'character', names: [id], colors: ['白'], level: 3, ap: 3000, lp: 1,
  traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
});

describe('CT-P10 parallel mid additions', () => {
  it('B10033 applies its conditional hand-level reduction and resolves both independent event clauses', () => {
    expect(B10033.abilities[0]).toMatchObject({
      type: 'continuous', scope: 'on-hand', continuousModifier: { lvlDeltaInHand: -3 },
      condition: { kind: 'and', cs: expect.arrayContaining([
        { kind: 'caseStatus', status: '解決編' },
        { kind: 'turn', player: 'self' },
        expect.objectContaining({ kind: 'sceneHas' }),
      ]) },
    });
    expect(B10033.abilities[1]).toMatchObject({
      condition: { kind: 'partnerColor', color: '緑' },
      effect: { kind: 'sequence', steps: [
        { kind: 'atom', verb: 'sceneRemove', args: { filter: { kind: 'character', apMax: 8000 } } },
        { kind: 'atom', verb: 'charSetCard', args: { filter: { kind: 'character', trait: '警察' }, fromDeckTop: true, faceUp: false } },
      ] },
    });
    expect(B10033P).toMatchObject({ id: 'B10033P', no: '1094/B10033P', abilities: B10033.abilities });
  });

  it('B10052 excludes Cut-in and Hirameki from the blank-original predicate at each required site', () => {
    const expected = { kind: 'character', hasNoOriginalAbilityExceptIcons: ['カットイン', 'ヒラメキ'] };
    expect(B10052.abilities[0]).toMatchObject({ trigger: { hook: 'phase:end:start' }, condition: { kind: 'sceneHas', query: { filter: expected } } });
    expect(B10052.abilities[1]).toMatchObject({ trigger: { hook: 'enter', matcherCondition: { kind: 'triggerCharMatches', filter: expected } }, condition: { kind: 'turn', player: 'self' } });
    expect(B10052.abilities[2]).toMatchObject({ type: 'declared', cost: { kind: 'pay', items: [{ kind: 'sleepSelf' }, expect.objectContaining({ kind: 'removeFromHand' })] } });
    expect(B10052P).toMatchObject({ id: 'B10052P', no: '1111/B10052P', abilities: B10052.abilities });
  });

  it('B10057 mills before choosing a character to sleep, and only after the red-partner / black-scene gate', () => {
    const black = character('B10057_BLACK', { colors: ['黒'] });
    const target = character('B10057_TARGET');
    const state = runCardScenario(B10057, [black, target], {
      name: 'B10057 red partner entry',
      setup: {
        partnerColors: ['赤'],
        selfScene: [{ cardId: 'B10057', uid: 'james#1' }, { cardId: black.id, uid: 'black#1' }],
        oppScene: [{ cardId: target.id, uid: 'target#1' }],
        oppDeckTop: ['B10057_MILL_1', 'B10057_MILL_2', 'B10057_MILL_3'],
      },
      drive: { kind: 'enter', cardId: 'B10057', uid: 'james#1' },
      script: [{ pickUid: 'target#1' }],
      expect: [
        { kind: 'zone', cardId: 'B10057_MILL_1', zone: 'remove', side: 'opp', present: true },
        { kind: 'zone', cardId: 'B10057_MILL_2', zone: 'remove', side: 'opp', present: true },
      ],
    });
    expect(state.players.opp.scene.find(c => c.uid === 'target#1')?.state).toBe('sleep');
  });
});
