import { describe, expect, it } from 'vitest';
import { D11007 } from '@/cards/ct-d11/D11007';
import { D11014 } from '@/cards/ct-d11/D11014';
import { D11015 } from '@/cards/ct-d11/D11015';
import { D11019 } from '@/cards/ct-d11/D11019';
import { D11020 } from '@/cards/ct-d11/D11020';
import { D11021 } from '@/cards/ct-d11/D11021';
import { PR027 } from '@/cards/pr-01/PR027';
import { PR029 } from '@/cards/pr-01/PR029';
import { PR031 } from '@/cards/pr-01/PR031';
import { PR033 } from '@/cards/pr-01/PR033';
import { PR036 } from '@/cards/pr-01/PR036';
import { PR042 } from '@/cards/pr-01/PR042';
import { PR043 } from '@/cards/pr-01/PR043';

function ability(card: { id: string; abilities: readonly { id: string }[] }, id: string) {
  const found = card.abilities.find((entry) => entry.id === id);
  expect(found, `${card.id}.${id}`).toBeDefined();
  return found!;
}

describe('official QA Wave246: CT-D11 and PR certification links', () => {
  it('pins the selected Wave246 contracts', () => {
    // qa: card:D11007:fd298447ad15716de7a161bbcce756016aeb5cffc6829bcf2e58b91fdb4ad5a0
    expect(ability(D11007, 'a1')).toMatchObject({ trigger: { hook: 'action:pre-target', selfOnly: true }, effect: { kind: 'atom', verb: 'expandActionTargets', args: { side: 'opp', state: ['active'], levelMin: 7 } } });
    // qa: card:D11014:fdf0c2351d462a35a414126efa728691c13574eb21ab734971c588c7aef702e5
    expect(ability(D11014, 'a2')).toMatchObject({ type: 'declared', cost: { kind: 'sleepSelf' }, effect: { kind: 'sequence', steps: [
      { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
      { kind: 'choice', chooser: 'self', options: [{ kind: 'atom', verb: 'sceneEnter', args: { player: 'self', viaEffect: true, bind: '$entered', target: { kind: 'pick', query: { area: 'remove', side: 'self', filter: { kind: 'character', trait: '警察', levelMax: 5 } }, n: { min: 0, max: 1 }, chooser: 'self' } } }] },
      { kind: 'conditional', if: { kind: 'boundMatchesFilter', bindKey: '$entered', filter: { cardName: '萩原千速' } }, then: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } } },
    ] } });

    // qa: card:D11015:0b37c3980c23530999d9410d4aa9e97f8638ac30d18f6e92e2d099b2c15c264b
    expect(ability(D11015, 'a1')).toMatchObject({ trigger: { hook: 'action:declare', selfOnly: true }, effect: { kind: 'atom', verb: 'charModifyAP', args: { delta: 1000, max: 1, side: 'either', scope: 'turn' } } });
    // qa: card:D11015:38c1521ee0281e6e5b5c845336c87020ece04b5fe2ee03dd96699f9f02b1c53c
    expect(ability(D11015, 'a2')).toMatchObject({ trigger: { hook: 'enter', selfOnly: true }, effect: { kind: 'sequence', steps: [
      { kind: 'conditional', if: { kind: 'sceneHas', query: { area: 'scene', side: 'opp' }, nMin: 3 }, then: { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃[キャラ]', scope: 'turn' } } },
      { kind: 'conditional', if: { kind: 'evidenceAtLeast', player: 'opp', n: 3 }, then: { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃[事件]', scope: 'turn' } } },
    ] } });

    // qa: card:D11019:2449d00bc35de2f57d342989ab050a1c2208b8f314f247104a92e6ecff651ec2
    // qa: card:D11019:2af3231dbd3145645aff0931208f70e82c10afdcf26bdff533d78806491ed864
    // qa: card:D11019:d342dfc2835d90c345aa382b52091887d98bb8f683a19347bb2c48931b1ab78b
    // qa: card:D11019:d3b0843f9994178eb4fb97971f6221d758662d6a611e1f6ee713274ca5997f52
    expect(ability(D11019, 'a1')).toMatchObject({ effect: { kind: 'sequence', steps: [
      { kind: 'atom', verb: 'deckRevealUntil', args: { filter: { color: '黄', levelMax: 4, kind: 'character' }, bind: '$revealed', bindMatch: '$matched' } },
      { kind: 'conditional', if: { kind: 'and', cs: [{ kind: 'bound', key: '$matched', presence: 'matched' }, { kind: 'removeColorAtLeast', player: 'self', color: '黄', n: 20 }] }, then: { kind: 'sequence' }, else: { kind: 'atom', verb: 'sceneEnter', args: { cardId: '$matched.cardId', viaEffect: true } } },
      { kind: 'atom', verb: 'deckToBottomBound', args: { bindKey: '$revealed', order: 'preserve' } },
      { kind: 'atom', verb: 'deckShuffle' },
    ] } });
    // qa: card:D11020:5d7b253e349f5afc90418dcba01ef16d9cd0f551bf70f13f83877b27fa6c873f
    expect(ability(D11020, 'a1')).toMatchObject({ effect: { kind: 'sequence', steps: [
      { kind: 'atom', verb: 'sceneRemove', args: { max: 1, side: 'either', filter: { levelMax: 7 }, state: ['sleep'] } },
      { kind: 'conditional', if: { kind: 'removeTraitAtLeast', player: 'self', trait: '神奈川県警', n: 3 }, then: { kind: 'atom', verb: 'sceneRemove', args: { max: 1, side: 'either', filter: { apMax: 8000 } } } },
    ] } });
    // qa: card:D11021:b0ef1b9d2e03f39626615f5aece59ba7305ff0e0b970f184a230f38b4818c9a5
    expect(ability(D11021, 'a2')).toMatchObject({ type: 'declared', scope: 'always', condition: { kind: 'and', cs: [{ kind: 'caseStatus', status: '解決編' }, { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: '神奈川県警' } }, nMin: 1 }] }, limit: { kind: 'turn', n: 1 }, cost: { kind: 'flipFaceUpEvidence', n: { min: 1, max: Infinity } } });

    // qa: card:PR027:8a9de01cbef5ee67781212b39609232dfb2e5f90267e2b7a5109d85c3e58302e
    expect(ability(PR027, 'a2')).toMatchObject({ trigger: { hook: 'enter', selfOnly: true }, effect: { kind: 'atom', verb: 'removeAreaAllToDeckBottom', args: { player: 'self' } } });
    // qa: card:PR029:62e723bd73c86e05739414612fd8e70bd9ce774b5335c8bffcd6dd9782e03553
    expect(ability(PR029, 'a1')).toMatchObject({ trigger: { hook: 'cutin:used', hooks: ['disguise:into'], matcherCondition: { kind: 'triggerPlayerIs', side: 'opp' } }, limit: { kind: 'turn', n: 1 }, effect: { kind: 'atom', verb: 'charModifyAP', args: { delta: -1000, inContact: true, max: 1, scope: 'contact' } } });
    // qa: card:PR031:8a9de01cbef5ee67781212b39609232dfb2e5f90267e2b7a5109d85c3e58302e
    expect(ability(PR031, 'a2')).toMatchObject({ trigger: { hook: 'enter', selfOnly: true }, effect: { kind: 'atom', verb: 'removeAreaAllToDeckBottom', args: { player: 'self' } } });
    // qa: card:PR033:62e723bd73c86e05739414612fd8e70bd9ce774b5335c8bffcd6dd9782e03553
    expect(ability(PR033, 'a1')).toMatchObject({ trigger: { hook: 'cutin:used', hooks: ['disguise:into'], matcherCondition: { kind: 'triggerPlayerIs', side: 'opp' } }, limit: { kind: 'turn', n: 1 }, effect: { kind: 'atom', verb: 'charModifyAP', args: { delta: -1000, inContact: true, max: 1, scope: 'contact' } } });
    // qa: card:PR036:2f09bd3dcb79564e0c7fe40db45fc4291983c9faec1bfd682d5e8d29c923abc9
    // qa: card:PR036:4d3fa6125332a045744333cca8bd819154702e85587eedbf280802fbcaf443f4
    expect(ability(PR036, 'a1')).toMatchObject({ limit: { kind: 'turn', n: 1 }, trigger: { hook: 'enter', matcherCondition: { kind: 'triggerCharMatches', side: 'self', payloadKey: 'uid', filter: { cardName: ['遠山和葉', '服部平次'] } } }, effect: { kind: 'atom', verb: 'sceneSetState', args: { max: 1, side: 'either', state: 'sleep' } } });
    // qa: card:PR042:4ae410ccc62047c3c27019d0b0b7b930f92b253ae22a6b9745311b1e32f50513
    expect(ability(PR042, 'a1')).toMatchObject({ condition: { kind: 'partnerColor', color: '青' }, trigger: { hook: 'enter', selfOnly: true }, effect: { kind: 'chain', steps: [
      { kind: 'atom', verb: 'discard', args: { player: 'self', max: 1 } },
      { kind: 'atom', verb: 'sceneEnter', args: { from: 'remove', cardIds: '$pick.cardIds', enterSleep: true, viaEffect: true, target: { kind: 'pick', query: { area: 'remove', side: 'self', filter: { kind: 'character', trait: '少年探偵団', levelMax: 4 } }, n: { min: 0, max: 2 }, chooser: 'self' } } },
    ] } });
    // qa: card:PR043:5292c0a92fc5a89a9e1868ac9e164f85647beb38f10dc807813c332cafbc0c26
    // qa: card:PR043:df9a7a4b13c16819f6d24f5e1c15c4bdae46de792a72107fb379a1e5602022a9
    expect(ability(PR043, 'a1')).toMatchObject({ trigger: { hook: 'enter', selfOnly: true }, effect: { kind: 'conditional', if: { kind: 'or', cs: [
      { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { cardName: '沖矢昴' } }, nMin: 1 },
      { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: '赤井家' }, excludeSelf: true }, nMin: 1 },
    ] }, then: { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃', scope: 'turn' } } } });
  });
});
