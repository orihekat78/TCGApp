// CT-P10 Sol review blockers: printed text / official Q&A regressions.
import { describe, expect, it } from 'vitest';
import { B10050 } from '@/cards/ct-p10/B10050';
import { B10065 } from '@/cards/ct-p10/B10065';
import { B10074 } from '@/cards/ct-p10/B10074';
import { B10102 } from '@/cards/ct-p10/B10102';
import { runCardScenario } from '../../helpers/card-probe-harness';
import type { CardDef } from '@/engine/types';

const character = (id: string, over: Partial<CardDef> = {}): CardDef => ({
  id, no: id, kind: 'character', names: [id], colors: ['赤'], level: 3, ap: 3000, lp: 1,
  traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
});

describe('CT-P10 review blocker cards', () => {
  it('B10050 draws when its optional entry removal is declined', () => {
    const target = character('B10050_TARGET', { level: 7 });
    runCardScenario(B10050, [target], {
      name: 'B10050 declined optional entry removal still draws',
      setup: {
        partnerColors: ['赤'],
        selfScene: [{ cardId: 'B10050', uid: 'jodie#1' }],
        oppScene: [{ cardId: target.id, uid: 'target#1' }],
        deckTop: ['B10050_DRAW'],
      },
      drive: { kind: 'enter', cardId: 'B10050', uid: 'jodie#1' },
      script: ['optional:decline'],
      expect: [
        { kind: 'zone', cardId: target.id, zone: 'scene', side: 'opp', present: true },
        { kind: 'zone', cardId: 'B10050_DRAW', zone: 'hand', side: 'self', present: true },
      ],
    });
  });

  it('B10050 draws when no entry-removal candidate exists', () => {
    runCardScenario(B10050, [], {
      name: 'B10050 zero optional entry-removal candidates still draws',
      setup: {
        partnerColors: ['赤'],
        selfScene: [{ cardId: 'B10050', uid: 'jodie#1' }],
        deckTop: ['B10050_ZERO_DRAW'],
      },
      drive: { kind: 'enter', cardId: 'B10050', uid: 'jodie#1' },
      script: ['optional:take'],
      expect: [{ kind: 'zone', cardId: 'B10050_ZERO_DRAW', zone: 'hand', side: 'self', present: true }],
    });
  });

  it('B10065 encodes its self-turn end trigger, partner-area declaration, and printed CutIn', () => {
    const [entry, endTurn, declaration, cutIn] = B10065.abilities;
    expect(entry).toMatchObject({
      condition: { kind: 'and', cs: expect.arrayContaining([{ kind: 'partnerColor', color: '黄' }, { kind: 'turn', player: 'self' }]) },
    });
    expect(endTurn).toMatchObject({
      type: 'triggered', scope: 'on-scene', trigger: { hook: 'phase:end:start' },
      condition: { kind: 'and', cs: expect.arrayContaining([{ kind: 'bond', cardName: '降谷零' }, { kind: 'turn', player: 'self' }]) },
    });
    expect(declaration).toMatchObject({ type: 'declared', scope: 'on-partner-area', limit: { kind: 'turn', n: 1 } });
    expect(cutIn).toMatchObject({
      type: 'triggered', scope: 'on-hand', trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
      effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
    });
  });

  it('B10074 and B10102 accept characters whose only original abilities are CutIn or Hirameki', () => {
    const expected = { kind: 'character', hasNoOriginalAbilityExceptIcons: ['カットイン', 'ヒラメキ'] };
    expect(B10074.abilities[0]).toMatchObject({ effect: { kind: 'atom', verb: 'sceneEnter', args: { filter: expected } } });
    expect(B10102.abilities[1]).toMatchObject({ effect: { kind: 'forEach', over: { kind: 'all', query: { filter: expected } } } });
  });
});
