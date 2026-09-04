import { describe, expect, it } from 'vitest';
import type { CardDef } from '@/engine/types';
import { B03003 } from '@/cards/ct-p03/B03003';
import { B03004 } from '@/cards/ct-p03/B03004';
import { B03008 } from '@/cards/ct-p03/B03008';
import { B03011 } from '@/cards/ct-p03/B03011';
import { B03014 } from '@/cards/ct-p03/B03014';
import { B03017 } from '@/cards/ct-p03/B03017';
import { B03019 } from '@/cards/ct-p03/B03019';
import { B03022 } from '@/cards/ct-p03/B03022';
import { B03023 } from '@/cards/ct-p03/B03023';
import { B03024 } from '@/cards/ct-p03/B03024';

function ability(card: CardDef, id: string) {
  const found = card.abilities.find((entry) => entry.id === id);
  expect(found, `${card.id}.${id}`).toBeDefined();
  return found!;
}

describe('official QA Wave223: CT-P03 certification links', () => {
  it('pins declared-cost and effective-LP contracts', () => {
    // qa: card:B03003:1a92dcdf67120f7d76c881aa12661add73fc79ad2cefe30d1e4fbda6978a4758
    expect(ability(B03003, 'a1')).toMatchObject({ cost: { kind: 'pay', items: [{ kind: 'sleepSelf' }, { kind: 'removeDeckTop', player: 'self', n: 3 }] } });
    // qa: card:B03003:4f757078c956fc19a19d91abc09b005bfb32d0f3f73768736b1f438173822897
    expect(ability(B03003, 'a1').cost).toMatchObject({ kind: 'pay', items: [expect.anything(), { kind: 'removeDeckTop', n: 3 }] });
    // qa: card:B03004:fcd57769d5f603298f8b330a9688d95097a917503063a83054a5c9b6fdeb4201
    expect(ability(B03004, 'a1')).toMatchObject({ effect: { kind: 'chain', steps: [expect.anything(), { kind: 'atom', verb: 'sceneSetState', args: { side: 'self', filter: { cardName: '毛利蘭', lpMin: 0, lpMax: 0 } } }] } });
    // qa: card:B03011:980e43fd880ad844e256fd6e167dfc154b658d2d99c2162ce5410ac645f9e977
    expect(ability(B03011, 'a1')).toMatchObject({ effect: { kind: 'atom', verb: 'charModifyLP', args: { filter: { color: '青', lpMin: 0, lpMax: 0 } } } });
  });

  it('pins B03008 mandatory state-change response', () => {
    // qa: card:B03008:1e09ba2c881f4ebb0d63f0ed9c8e845ea00a3d2ad75f1134d84ea55a6f858033
    expect(ability(B03008, 'a1')).toMatchObject({ trigger: { hook: 'state:change', matcherCondition: { kind: 'triggerCharMatches', payloadKey: 'uid', side: 'self' } } });
    // qa: card:B03008:91e71029c258de0c48d36ec22eb240d25094deab1da9c97509d19637e67a4bf9
    expect(ability(B03008, 'a1')).toMatchObject({ condition: { kind: 'turn', player: 'self' }, limit: { kind: 'turn', n: 1 } });
    // qa: card:B03008:f38fdca59229b8516d9cd692ea37db28fa2ba54f05d0e10502655e30ac2999b1
    expect(ability(B03008, 'a1')).toMatchObject({ effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'draw', args: { n: 1 } }, { kind: 'atom', verb: 'discard', args: { n: 1 } }] } });
  });

  it('pins B03014 end-of-turn independent sequence', () => {
    // qa: card:B03014:2fd7749c5faa3f0bd06468690aad56f11c25afd1c4175d084760df521005a536
    expect(ability(B03014, 'a1')).toMatchObject({ effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'sceneToHand', args: { uid: '$self' } }, { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } }] } });
    // qa: card:B03014:d90902a583ad8cb89f25d233a27b0fbeed3c1e74e45c16a69976893c680a4dc4
    expect(ability(B03014, 'a1')).toMatchObject({ trigger: { hook: 'phase:end:start' } });
    expect(ability(B03014, 'a1').condition).toBeUndefined();
    // qa: card:B03014:e5703532969569cedd6d7400acb4094032b7a0faa623072bda031551c03009f1
    expect(ability(B03014, 'a1')).toMatchObject({ effect: { kind: 'sequence', steps: [expect.anything(), { kind: 'atom', verb: 'discard', args: { n: 1 } }] } });
  });

  it('pins contact-independent cut-in and mandatory reveal outcomes', () => {
    // qa: card:B03017:e5a197771ebd36c3392d1f9c23bc43656be4718a9f597831c06c90894f4f84fe
    expect(ability(B03017, 'a1')).toMatchObject({ scope: 'on-hand', condition: { kind: 'turn', player: 'opp' }, effect: { kind: 'atom', verb: 'sceneSetState', args: { state: 'active', max: 1 } } });
    // qa: card:B03017:f93a2659346899a7ff80fb8ed4b5248f01756c1a96ce538d8aa1ec49e3c160cc
    expect(ability(B03017, 'a1')).toMatchObject({ trigger: { hook: 'effect:declared', optional: true, selfOnly: true } });
    // qa: card:B03019:409c896d0c2958faf69bd8e6fb7a1d65659dbd905bad76bb65ad1f5c3a1dee17
    expect(ability(B03019, 'a1')).toMatchObject({ effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'deckRevealUntil', args: { bind: '$revealed', bindMatch: '$matched' } }, expect.anything(), { kind: 'atom', verb: 'deckToBottomBound', args: { bindKey: '$revealed' } }, { kind: 'atom', verb: 'deckShuffle' }] } });
    // qa: card:B03019:bdfb7773e5a3e42df1affd514d631eb986d93e31066129e006ce5c03f62733ca
    expect(JSON.stringify(ability(B03019, 'a1').effect)).toContain('"cardId":"$matched.cardId"');
  });

  it('pins continuous, duplicate-trigger, and optional chain contracts', () => {
    // qa: card:B03022:b2449f35b17353faaf7453e2d3e294ea5173d4f40c10e1e8609f64413224ce04
    expect(ability(B03022, 'a1')).toMatchObject({ type: 'continuous', condition: { kind: 'not', c: { kind: 'sceneHas', query: { excludeSelf: true } } }, continuousModifier: { apDelta: 2000 } });
    // qa: card:B03023:f2b57018b3c980aff7e272e3bbf30d5ca6934d3fc8ea0c0a954d366f9ecfc5c9
    expect(ability(B03023, 'a1')).toMatchObject({ trigger: { hook: 'enter' }, condition: { kind: 'turn', player: 'self' }, limit: { kind: 'turn', n: 1 }, effect: { kind: 'atom', verb: 'deckRevealUntil', args: { player: 'opp', maxN: 1 } } });
    // qa: card:B03024:61418c1c52950aa58152bdd95547dee34b552a93d4cbd4956233c44b440fb71a
    expect(ability(B03024, 'a1')).toMatchObject({ effect: { kind: 'chain', steps: [expect.anything(), { kind: 'sequence', steps: [expect.anything(), { kind: 'atom', verb: 'sceneEnter', args: { from: 'hand', max: 1, enterSleep: true, filter: { color: '青', levelMax: 6 } } }] }] } });
    // qa: card:B03024:98f781dcd753a32094451bc21cbc84882d8b21be3882d3c69589a6f86e10970d
    expect(ability(B03024, 'a1')).toMatchObject({ effect: { kind: 'chain', steps: [expect.anything(), { kind: 'sequence', steps: [{ kind: 'atom', verb: 'sceneToDeck', args: { side: 'opp', max: 1 } }, expect.anything()] }] } });
    // qa: card:B03024:a5d4268d7c5fd42f88f60ac7c09e439a30947b4e78a436cb9039a66f9539d96e
    expect(ability(B03024, 'a1')).toMatchObject({ trigger: { hook: 'effect:declared', selfOnly: true } });
  });
});
