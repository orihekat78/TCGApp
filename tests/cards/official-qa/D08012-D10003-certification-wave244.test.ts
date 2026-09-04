import { describe, expect, it } from 'vitest';
import { D08012 } from '@/cards/ct-d08/D08012';
import { D08013 } from '@/cards/ct-d08/D08013';
import { D08019 } from '@/cards/ct-d08/D08019';
import { D08020 } from '@/cards/ct-d08/D08020';
import { D08021 } from '@/cards/ct-d08/D08021';
import { D08024 } from '@/cards/ct-d08/D08024';
import { D08026 } from '@/cards/ct-d08/D08026';
import { D09006 } from '@/cards/ct-d09/D09006';
import { D09007 } from '@/cards/ct-d09/D09007';
import { D09010 } from '@/cards/ct-d09/D09010';
import { D09011 } from '@/cards/ct-d09/D09011';
import { D09014 } from '@/cards/ct-d09/D09014';
import { D09015 } from '@/cards/ct-d09/D09015';
import { D09020 } from '@/cards/ct-d09/D09020';
import { D10003 } from '@/cards/ct-d10/D10003';

function ability(card: { id: string; abilities: readonly { id: string }[] }, id: string) {
  const found = card.abilities.find((entry) => entry.id === id);
  expect(found, `${card.id}.${id}`).toBeDefined();
  return found!;
}

describe('official QA Wave244: CT-D08 through CT-D10 certification links', () => {
  it('pins the selected Wave244 contracts', () => {
    // qa: card:D08012:e5923114a6415f3ff08ddc4aa5ff5ca12303edb0124296d08045fe05e1b9d786
    expect(D08012).toMatchObject({ abilities: [expect.objectContaining({ type: 'triggered', trigger: { hook: 'enter', selfOnly: true } })] });
    // qa: card:D08013:1f83a1696b0362a3574d1c0bf9a1d5f1619726cc81156f189c7aeb26b419ba47
    expect(ability(D08013, 'a1')).toMatchObject({ effect: { kind: 'sequence', steps: [
      { kind: 'atom', verb: 'evidenceGain', args: { player: 'self', n: 1 } },
      { kind: 'atom', verb: 'evidenceToHand', args: { player: 'self', n: 1 } },
      { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
    ] } });
    // qa: card:D08019:1f14978fa8fae8ff7ac25b789018799e5de62a7a237c195001b353346e514440
    // qa: card:D08020:1f14978fa8fae8ff7ac25b789018799e5de62a7a237c195001b353346e514440
    for (const card of [D08019, D08020]) {
      expect(ability(card, 'a2')).toMatchObject({ effect: { kind: 'choice', options: [{ kind: 'atom', verb: 'sceneSetState', args: { target: { n: { min: 0, max: 1 } } } }] } });
    }
    // qa: card:D08021:83c5bb5964649a4da71518a71498125346024f66aa40e6e327fc97e7b4fbf9b4
    expect(ability(D08021, 'a1')).toMatchObject({ trigger: { hook: 'enter', selfOnly: true }, effect: { kind: 'atom', verb: 'charStackCard', args: { uid: '$self', cardIds: '$pick.cardIds', target: { query: { area: 'remove', side: 'self', distinctNames: true, filter: { kind: 'character', trait: '少年探偵団' } }, n: { min: 0, max: 5 }, chooser: 'self' } } } });
    // qa: card:D08024:3fdaeb6b9f3bb71a60dda72f54b96f48fe3e093e4f448f453971378645f500fe
    expect(ability(D08024, 'a1')).toMatchObject({ effect: { kind: 'sequence', steps: [
      { kind: 'atom', verb: 'sceneEnter', args: { from: 'remove', max: 1 } },
      { kind: 'atom', verb: 'charModifyAP', args: { delta: 2000, max: 1, scope: 'turn' } },
    ] } });
    // qa: card:D08026:b0ef1b9d2e03f39626615f5aece59ba7305ff0e0b970f184a230f38b4818c9a5
    // qa: card:D08026:ea52bf910c2f5c6a0e7424d4e7cb78e29dbd541ebed373ffdff0ef0bbb3e9a52
    expect(ability(D08026, 'a2')).toMatchObject({ type: 'declared', cost: { kind: 'flipFaceUpEvidence', n: { min: 1, max: Infinity } }, effect: { kind: 'choice', options: [{ kind: 'atom', verb: 'charModifyAP', args: { delta: { dyn: '$cost.flipFaceUpEvidence.count * 1000' }, scope: 'turn' } }] } });
    // qa: card:D09006:462421c9ffdba47421ba27b3639d48d57a88a15fce79d354ba328545d5b07abf
    // qa: card:D09007:462421c9ffdba47421ba27b3639d48d57a88a15fce79d354ba328545d5b07abf
    for (const card of [D09006, D09007]) {
      expect(ability(card, 'a2')).toMatchObject({ type: 'continuous', condition: { kind: 'removeTraitAtLeast', player: 'self', trait: '長野県警', n: 2 }, continuousModifier: { grantKeywords: expect.any(Function) } });
    }
    // qa: card:D09010:216635e95c72a51ec62eae36e6d454a46acedc98cc0a2a21ba43330df5ea5cdc
    // qa: card:D09010:f450f283037eca56bd3611e4b06a2ecdad4450c289d33874c07ff1a5ac0cbbe5
    // qa: card:D09011:216635e95c72a51ec62eae36e6d454a46acedc98cc0a2a21ba43330df5ea5cdc
    // qa: card:D09011:f450f283037eca56bd3611e4b06a2ecdad4450c289d33874c07ff1a5ac0cbbe5
    for (const card of [D09010, D09011]) {
      expect(ability(card, 'a1')).toMatchObject({ trigger: { hook: 'leave:to-remove' }, condition: { kind: 'removedCharMatches', side: 'opp', cause: 'contact-ap', by: { filter: { trait: '警察' } } }, limit: { kind: 'turn', n: 1 }, effect: { kind: 'optional' } });
    }
    // qa: card:D09014:54ae15eed5ac1815cfef2e990c472be0042bb747430b93ffa6bd185d42700617
    // qa: card:D09015:54ae15eed5ac1815cfef2e990c472be0042bb747430b93ffa6bd185d42700617
    for (const card of [D09014, D09015]) {
      expect(ability(card, 'a2')).toMatchObject({ type: 'declared', effect: { kind: 'atom', verb: 'sceneToHand', args: { target: { query: { side: 'opp', state: ['sleep'], filter: { levelMax: 5 } }, n: { min: 0, max: 1 } } } } });
    }
    // qa: card:D09020:280d69450fb245a1931cb752384e44ae37cc401257f4b7889c9eba0e6f26a1d8
    // qa: card:D09020:4f1e7b564a969ed3ca23c1c7599caeef0dd4fcdb4d5299623c98f1d4009bea99
    expect(ability(D09020, 'a1')).toMatchObject({ effect: { kind: 'choice', options: [
      { kind: 'sequence', steps: [{ kind: 'atom', verb: 'sceneEnter' }, { kind: 'atom', verb: 'charModifyAP', args: { delta: 2000, scope: 'turn' } }, { kind: 'atom', verb: 'charGrantKeyword', args: { kw: '突撃', scope: 'turn' } }, { kind: 'atom', verb: 'charSetTurnEffect', args: { key: 'removeOnTurnEnd', val: true } }] },
      { kind: 'sequence', steps: [{ kind: 'atom', verb: 'sceneEnter' }, { kind: 'atom', verb: 'charModifyAP', args: { delta: 2000, scope: 'turn' } }, { kind: 'atom', verb: 'charGrantKeyword', args: { kw: '突撃', scope: 'turn' } }, { kind: 'atom', verb: 'charSetTurnEffect', args: { key: 'removeOnTurnEnd', val: true } }] },
    ] } });
    // qa: card:D10003:a1bd59c9ed69fa6cf7ca530100f411e4e7fb7fc67ba628ed90e671c6c514a43c
    expect(ability(D10003, 'a2')).toMatchObject({ effect: { kind: 'sequence', steps: [
      { kind: 'atom', verb: 'deckRevealUntil', args: { filter: { cardName: 'シャッフルロマンス' }, bind: '$revealed', bindMatch: '$matched' } },
      { kind: 'conditional', if: { kind: 'bound', key: '$matched', presence: 'matched' }, then: { kind: 'atom', verb: 'handAddFromDeck', args: { cardId: '$matched.cardId' } } },
      { kind: 'atom', verb: 'deckToBottomBound', args: { bindKey: '$revealed' } },
      { kind: 'atom', verb: 'deckShuffle' },
    ] } });
  });
});
