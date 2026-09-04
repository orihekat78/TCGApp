import { describe, expect, it } from 'vitest';
import { PR100 } from '@/cards/pr-01/PR100';
import { PR101 } from '@/cards/pr-01/PR101';
import { PR104 } from '@/cards/pr-01/PR104';
import { PR105 } from '@/cards/pr-01/PR105';
import { PR106 } from '@/cards/pr-01/PR106';
import { PR107 } from '@/cards/pr-01/PR107';
import { PR117 } from '@/cards/pr-01/PR117';
import { PR118 } from '@/cards/pr-01/PR118';
import { PR131 } from '@/cards/pr-01/PR131';

function ability(card: { id: string; abilities: readonly { id: string }[] }, id: string) {
  const found = card.abilities.find((entry) => entry.id === id);
  expect(found, `${card.id}.${id}`).toBeDefined();
  return found!;
}

describe('official QA Wave248: PR100 through PR131 certification links', () => {
  it('pins the selected Wave248 contracts', () => {
    // qa: card:PR100:2c5b48933d0aa3096a8a97f19fa7f0bfd6de03ce245808ec578db2884b9b3ae1
    // qa: card:PR100:49d13ab9545b274f17a41a8b79f61e7b434b19adfb8acf70816835b6956fb335
    expect(ability(PR100, 'a1')).toMatchObject({ scope: 'on-hand', condition: { kind: 'and', cs: [{ kind: 'caseStatus', status: '解決編' }, { kind: 'fileAtLeast', n: 4 }] }, effect: { kind: 'optional', effect: { kind: 'chain', steps: [
      { kind: 'atom', verb: 'filePopToHand', args: { player: 'self' } },
      { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', from: 'remove', max: 1, viaEffect: true, filterAny: [{ cardName: 'シェリー', levelMax: 5 }, { cardName: '宮野志保', levelMax: 5 }, { cardName: '宮野明美', levelMax: 5 }] } },
    ] } } });

    // qa: card:PR101:a730fe584b2fb4400ac14a7a4f6e897f8b7bb9324d49081e7d6d4d5332864c69
    expect(ability(PR101, 'a1')).toMatchObject({ condition: { kind: 'caseStatus', status: '解決編' }, effect: { kind: 'chain', steps: [
      { kind: 'atom', verb: 'sceneSetState', args: { side: 'self', state: 'sleep', filter: { cardName: ['降谷零', '諸伏景光', '伊達航', '萩原研二', '松田陣平'] } } },
      { kind: 'atom', verb: 'sceneRemove', args: { side: 'either', state: ['sleep'], filter: { levelMax: 6 } } },
    ] } });

    // qa: card:PR104:ddcac6ceb6ba89ab95e855683a39784409388705ec4efcfc21d693d918a6eab9
    expect(ability(PR104, 'a2')).toMatchObject({ type: 'declared', condition: { kind: 'caseStatus', status: '解決編' }, limit: { kind: 'turn', n: 1 } });

    // qa: card:PR105:ad2b121a6f7b061809cbcd256a49489c07f4e72ef5f88a8188e05b782044928a
    // qa: card:PR105:ff8a2f826e359d6d8e867d5d308df2e9c536498ca6174aa72ada90367d47132f
    expect(ability(PR105, 'a2')).toMatchObject({ type: 'declared', effect: { kind: 'sequence', steps: [
      { kind: 'atom', verb: 'charModifyAP', args: { uid: '$self', delta: 1000, scope: 'turn' } },
      { kind: 'atom', verb: 'declareName', args: { bind: 'named', optional: true, domain: 'registered-character-card-name' } },
      { kind: 'atom', verb: 'charSetTurnEffect', args: { uid: '$self', key: 'nameOverride', val: '$dyn.declaredName' } },
    ] } });

    // qa: card:PR106:2c5b48933d0aa3096a8a97f19fa7f0bfd6de03ce245808ec578db2884b9b3ae1
    // qa: card:PR106:49d13ab9545b274f17a41a8b79f61e7b434b19adfb8acf70816835b6956fb335
    // qa: card:PR106:67dac866cd0e1f8602dafe5dd13334632f0260c4fed758079023b23305033f89
    expect(ability(PR106, 'a1')).toMatchObject({ scope: 'on-hand', condition: { kind: 'and', cs: [{ kind: 'caseStatus', status: '解決編' }, { kind: 'fileAtLeast', n: 4 }] }, effect: { kind: 'optional', effect: { kind: 'chain', steps: [
      { kind: 'atom', verb: 'filePopToHand', args: { player: 'self' } },
      { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', from: 'remove', max: 1, viaEffect: true, filterAny: [{ cardName: 'シェリー', levelMax: 5 }, { cardName: '宮野志保', levelMax: 5 }, { cardName: '宮野明美', levelMax: 5 }] } },
    ] } } });

    // qa: card:PR107:a730fe584b2fb4400ac14a7a4f6e897f8b7bb9324d49081e7d6d4d5332864c69
    expect(ability(PR107, 'a1')).toMatchObject({ condition: { kind: 'caseStatus', status: '解決編' }, effect: { kind: 'chain', steps: [
      { kind: 'atom', verb: 'sceneSetState', args: { player: 'self', max: 1, side: 'self', state: 'sleep', filter: { cardName: ['降谷零', '諸伏景光', '伊達航', '萩原研二', '松田陣平'] } } },
      { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', state: ['sleep'], filter: { levelMax: 6 } } },
    ] } });

    // qa: card:PR117:1eef6c93840716039892119be7480b42c6d8db589f4c1583a73b11dbc0c94496
    // qa: card:PR117:9ebb1e91ebb31426d8462dd721ea22bfb518f8970b75cec6bfc9052e8132b3c0
    expect(ability(PR117, 'a1')).toMatchObject({ trigger: { hook: 'enter', selfOnly: true }, effect: { kind: 'sequence', steps: [
      { kind: 'atom', verb: 'deckRevealUntil', args: { filter: { trait: '探偵', levelMin: 7, kind: 'character' }, bind: '$revealed', bindMatch: '$matched' } },
      { kind: 'conditional', if: { kind: 'bound', key: '$matched', presence: 'matched' }, then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } } },
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed', order: 'preserve' } },
      { kind: 'atom', verb: 'deckShuffle', args: { player: 'self' } },
    ] } });
    // qa: card:PR117:b0780b558314019e01a34848d201a395b5b9928d1e0c55120c7d84bee8d8930c
    expect(ability(PR117, 'a2')).toMatchObject({ condition: { kind: 'turn', player: 'self' }, limit: { kind: 'turn', n: 1 }, trigger: { hook: 'enter', matcherCondition: { kind: 'triggerCharMatches', side: 'self', payloadKey: 'uid', excludeSource: true, filter: { trait: '探偵' } } } });

    // qa: card:PR118:1eef6c93840716039892119be7480b42c6d8db589f4c1583a73b11dbc0c94496
    // qa: card:PR118:9ebb1e91ebb31426d8462dd721ea22bfb518f8970b75cec6bfc9052e8132b3c0
    expect(ability(PR118, 'a1')).toMatchObject({ trigger: { hook: 'enter', selfOnly: true }, effect: { kind: 'sequence', steps: [
      { kind: 'atom', verb: 'deckRevealUntil', args: { filter: { trait: '探偵', levelMin: 7, kind: 'character' }, bind: '$revealed', bindMatch: '$matched' } },
      { kind: 'conditional', if: { kind: 'bound', key: '$matched', presence: 'matched' }, then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } } },
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed', order: 'preserve' } },
      { kind: 'atom', verb: 'deckShuffle', args: { player: 'self' } },
    ] } });
    // qa: card:PR118:b0780b558314019e01a34848d201a395b5b9928d1e0c55120c7d84bee8d8930c
    expect(ability(PR118, 'a2')).toMatchObject({ condition: { kind: 'turn', player: 'self' }, limit: { kind: 'turn', n: 1 }, trigger: { hook: 'enter', matcherCondition: { kind: 'triggerCharMatches', side: 'self', payloadKey: 'uid', excludeSource: true, filter: { trait: '探偵' } } } });

    // qa: card:PR131:e6ecbe55e30edc0b469639ea9db1edc6e7a8de3f344fc8b4bca9116477e82659
    expect(ability(PR131, 'a1')).toMatchObject({ condition: { kind: 'caseStatus', status: '解決編' }, effect: { kind: 'chain', steps: [
      { kind: 'atom', verb: 'discard', args: { player: 'self', max: 1 } },
      { kind: 'atom', verb: 'sceneSetState', args: { side: 'self', max: 1, state: 'active', filter: { cardName: '毛利蘭', lpMin: 0, lpMax: 0 } } },
    ] } });
  });
});
