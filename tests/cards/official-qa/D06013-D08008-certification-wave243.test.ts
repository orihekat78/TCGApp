import { describe, expect, it } from 'vitest';
import { D06013 } from '@/cards/ct-d06/D06013';
import { D06016 } from '@/cards/ct-d06/D06016';
import { D06018 } from '@/cards/ct-d06/D06018';
import { D07008 } from '@/cards/ct-d07/D07008';
import { D07009 } from '@/cards/ct-d07/D07009';
import { D07010 } from '@/cards/ct-d07/D07010';
import { D07011 } from '@/cards/ct-d07/D07011';
import { D07018 } from '@/cards/ct-d07/D07018';
import { D08003 } from '@/cards/ct-d08/D08003';
import { D08004 } from '@/cards/ct-d08/D08004';
import { D08005 } from '@/cards/ct-d08/D08005';
import { D08006 } from '@/cards/ct-d08/D08006';
import { D08008 } from '@/cards/ct-d08/D08008';

function ability(card: { id: string; abilities: readonly { id: string }[] }, id: string) {
  const found = card.abilities.find((entry) => entry.id === id);
  expect(found, `${card.id}.${id}`).toBeDefined();
  return found!;
}

describe('official QA Wave243: CT-D06 through CT-D08 certification links', () => {
  it('pins the selected Wave243 contracts', () => {
    // qa: card:D06013:ad4cfe1d8a79d78fbba13edaa98ea965ff403a5a020c3cbb23bfb47dcaeb7458
    // qa: card:D06013:b4d2f3438705abeac3e431293c9f5795c42d3aed5e5d54c385f69194e907693f
    expect(ability(D06013, 'a1')).toMatchObject({
      trigger: { hook: 'enter', selfOnly: true },
      effect: { kind: 'sequence', steps: [
        { kind: 'atom', verb: 'deckRevealUntil', args: { maxN: 4, bind: '$revealed' } },
        { kind: 'conditional', then: { kind: 'atom', verb: 'sceneSetState', args: { state: 'stun', target: { query: { state: ['sleep'] }, n: { min: 0, max: 1 } } } } },
        { kind: 'atom', verb: 'deckToBottomBound', args: { bindKey: '$revealed' } },
        { kind: 'atom', verb: 'deckShuffle' },
      ] },
    });
    // qa: card:D06016:111a35d489a4631f8766340551172c5060492a6f869be98a3603996b74c135b3
    // qa: card:D06016:c5a1a1831285646de10a7a133080d2c5311780cb62681af782f280dc881e4e12
    expect(D06016).toMatchObject({ entersSleep: true });
    expect(ability(D06016, 'a2')).toMatchObject({ effect: { kind: 'sequence', steps: [
      { kind: 'atom', verb: 'deckRevealUntil', args: { filter: { kind: 'character', levelMax: 6 }, maxN: 1, bindMatch: '$matched' } },
      { kind: 'conditional', if: { kind: 'bound', key: '$matched', presence: 'matched' }, then: { kind: 'atom', verb: 'sceneEnter', args: { cardId: '$matched.cardId' } } },
      { kind: 'conditional', if: { kind: 'bound', key: '$revealed', presence: 'matched' }, then: { kind: 'atom', verb: 'handAddFromDeck', args: { cardId: '$revealed.cardId' } } },
    ] } });
    // qa: card:D06018:48928655d99ce255b70d5f9890ab51334934c8ebb45a424d4fc605a424ff91dc
    expect(D06018.abilities).toMatchObject([{ effect: { kind: 'chain', steps: [
      { kind: 'atom', verb: 'sceneSetState', args: { player: 'self', max: 1, side: 'self', state: 'sleep' } },
      { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { levelMax: 7 } } },
    ] } }]);
    // qa: card:D07008:ec4ccb807cd77762f46cda9837df6e11ec4411e06c2cf53efd8bc2e2fd22482c
    // qa: card:D07009:ec4ccb807cd77762f46cda9837df6e11ec4411e06c2cf53efd8bc2e2fd22482c
    for (const card of [D07008, D07009]) {
      expect(ability(card, 'a1')).toMatchObject({ type: 'declared', cost: { kind: 'pay', items: [{ kind: 'sleepSelf' }, { kind: 'selfToDeckBottom' }] } });
    }
    // qa: card:D07010:26a288541a34ebb3575133183ec65669424c4c62a11a46270cae3c734ccbf8a5
    // qa: card:D07010:95aa118b9ac115cdf1e10daf406c4e4974cb6e5e7f94fc3a8113fe2653e3b7a9
    // qa: card:D07011:26a288541a34ebb3575133183ec65669424c4c62a11a46270cae3c734ccbf8a5
    // qa: card:D07011:95aa118b9ac115cdf1e10daf406c4e4974cb6e5e7f94fc3a8113fe2653e3b7a9
    for (const card of [D07010, D07011]) {
      expect(ability(card, 'a1')).toMatchObject({ type: 'continuous', condition: { kind: 'turn', player: 'self' }, continuousModifier: { apDeltaAura: 1000, auraFilter: { color: '黒', kind: 'character' }, auraExcludeSelf: true } });
    }
    // qa: card:D07018:da38daa2c7fffdf522270904a1a075256434b44dfd29387a2d003ab9f54be679
    // qa: card:D07018:de01e887634db46145f61924204864b18785b9bf9b8f264430fbaa0e19ffe56a
    expect(ability(D07018, 'a1')).toMatchObject({ trigger: { hook: 'contact:start', selfOnly: true }, effect: { kind: 'atom', verb: 'sceneRemove', args: { uid: '$trigger.bUid', cause: 'effect' } } });
    // qa: card:D08003:0e88a4f091552954ddb522f6c6858e2bf997b67d641650f5887cfceaa83c971d
    // qa: card:D08003:e84a729d02752500adff3d06cf5d32fca16f9a85df564071a6a51dc0ca748034
    expect(ability(D08003, 'a1')).toMatchObject({ condition: { kind: 'partnerColor', color: '青' }, trigger: { hook: 'enter', selfOnly: true } });
    expect(ability(D08003, 'a2')).toMatchObject({ trigger: { hook: 'phase:end:start' }, condition: { kind: 'turn', player: 'self' }, effect: { kind: 'conditional', if: { kind: 'sceneHas', query: { side: 'self', filter: { trait: '少年探偵団' } }, nMin: 3 }, then: { kind: 'atom', verb: 'draw', args: { n: 1 } } } });
    // qa: card:D08004:e84a729d02752500adff3d06cf5d32fca16f9a85df564071a6a51dc0ca748034
    expect(ability(D08004, 'a2')).toMatchObject({ trigger: { hook: 'phase:end:start' }, condition: { kind: 'turn', player: 'self' }, effect: { kind: 'conditional', if: { kind: 'sceneHas', query: { side: 'self', filter: { trait: '少年探偵団' } }, nMin: 3 } } });
    // qa: card:D08005:58763c5eec112da565cbb2892250eb844e45725c5b8575645188326a1a98dcd7
    // qa: card:D08006:58763c5eec112da565cbb2892250eb844e45725c5b8575645188326a1a98dcd7
    for (const card of [D08005, D08006]) {
      expect(ability(card, 'a1')).toMatchObject({ type: 'continuous', condition: { kind: 'turn', player: 'self' }, continuousModifier: { apDelta: { dyn: '$self.faceUpEvidence * 1000' } } });
    }
    // qa: card:D08008:dbfee7727bf452848f0734983024cebbd5f37a01ee9fcf5756487ea1ffa7b207
    expect(ability(D08008, 'a1')).toMatchObject({ scope: 'on-hand', trigger: { hook: 'effect:declared', optional: true, selfOnly: true }, condition: { kind: 'turn', player: 'self' }, effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: { dyn: '$self.sceneTrait.少年探偵団 * 1000' }, scope: 'contact' } } });
  });
});
