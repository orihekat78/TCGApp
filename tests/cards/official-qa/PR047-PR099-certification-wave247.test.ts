import { describe, expect, it } from 'vitest';
import { PR047 } from '@/cards/pr-01/PR047';
import { PR085 } from '@/cards/pr-01/PR085';
import { PR086 } from '@/cards/pr-01/PR086';
import { PR087 } from '@/cards/pr-01/PR087';
import { PR091 } from '@/cards/pr-01/PR091';
import { PR092 } from '@/cards/pr-01/PR092';
import { PR093 } from '@/cards/pr-01/PR093';
import { PR096 } from '@/cards/pr-01/PR096';
import { PR098 } from '@/cards/pr-01/PR098';
import { PR099 } from '@/cards/pr-01/PR099';

function ability(card: { id: string; abilities: readonly { id: string }[] }, id: string) {
  const found = card.abilities.find((entry) => entry.id === id);
  expect(found, `${card.id}.${id}`).toBeDefined();
  return found!;
}

describe('official QA Wave247: PR047 through PR099 certification links', () => {
  it('pins the selected Wave247 contracts', () => {
    // qa: card:PR047:5292c0a92fc5a89a9e1868ac9e164f85647beb38f10dc807813c332cafbc0c26
    // qa: card:PR047:df9a7a4b13c16819f6d24f5e1c15c4bdae46de792a72107fb379a1e5602022a9
    expect(ability(PR047, 'a1')).toMatchObject({ trigger: { hook: 'enter', selfOnly: true }, effect: { kind: 'conditional', then: { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃', scope: 'turn' } } } });

    // qa: card:PR085:b4481a296a5d1f78933be537144e61481696e56f0b6accc0fa9fe3b245676015
    expect(ability(PR085, 'a2')).toMatchObject({ scope: 'on-evidence', trigger: { hook: 'evidence:remove-by-action', optional: true }, effect: { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', fromSelf: true } } });
    // qa: card:PR091:b4481a296a5d1f78933be537144e61481696e56f0b6accc0fa9fe3b245676015
    expect(ability(PR091, 'a2')).toMatchObject({ scope: 'on-evidence', trigger: { hook: 'evidence:remove-by-action', optional: true }, effect: { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', fromSelf: true } } });

    // qa: card:PR086:b9153b98506fbfc2d01552f16ff007b34909efb3d7a31788d7115bb946fc0fd0
    // qa: card:PR086:c747799ae0e7820359315afb898a7ec1cb669d879c14eb3618d65663e40b05ca
    expect(ability(PR086, 'a1')).toMatchObject({ trigger: { hook: 'action:end', selfOnly: true }, effect: { kind: 'optional', effect: { kind: 'sequence', steps: [
      { kind: 'atom', verb: 'sceneToDeck', args: { uid: '$self', pos: 'bottom' } },
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', from: 'hand', max: 1, viaEffect: true, enterSleep: true, filter: { levelMax: 6, trait: '警察', kind: 'character' } } },
    ] } } });
    // qa: card:PR092:b9153b98506fbfc2d01552f16ff007b34909efb3d7a31788d7115bb946fc0fd0
    // qa: card:PR092:c747799ae0e7820359315afb898a7ec1cb669d879c14eb3618d65663e40b05ca
    expect(ability(PR092, 'a1')).toMatchObject({ trigger: { hook: 'action:end', selfOnly: true }, effect: { kind: 'optional', effect: { kind: 'sequence', steps: [
      { kind: 'atom', verb: 'sceneToDeck', args: { uid: '$self', pos: 'bottom' } },
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', from: 'hand', max: 1, viaEffect: true, enterSleep: true, filter: { levelMax: 6, trait: '警察', kind: 'character' } } },
    ] } } });

    // qa: card:PR087:600bdd37bfc7f7ed27385630e2495aead8e9f57a723e4cbb8c8b3d995ece117e
    // qa: card:PR087:e6ce2af239bf77a5fd70feff2894c68aa0c6db3caafe0823d887718823d89574
    expect(ability(PR087, 'a1')).toMatchObject({ scope: 'on-hand', trigger: { hook: 'effect:declared', optional: true, selfOnly: true }, condition: { kind: 'caseStatus', status: '解決編' }, effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } }, { kind: 'conditional' }] } });
    // qa: card:PR093:600bdd37bfc7f7ed27385630e2495aead8e9f57a723e4cbb8c8b3d995ece117e
    // qa: card:PR093:e6ce2af239bf77a5fd70feff2894c68aa0c6db3caafe0823d887718823d89574
    expect(ability(PR093, 'a1')).toMatchObject({ scope: 'on-hand', trigger: { hook: 'effect:declared', optional: true, selfOnly: true }, condition: { kind: 'caseStatus', status: '解決編' }, effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } }, { kind: 'conditional' }] } });

    // qa: card:PR096:184e1200cecd7a07038eb8d5c42b50ebe17882b726548392b0a98cf409e00f2b
    expect(ability(PR096, 'a1')).toMatchObject({ condition: { kind: 'turn', player: 'self' }, effect: { kind: 'atom', verb: 'charModifyLevel', args: { side: 'opp', max: 1, delta: -1, scope: 'turn' } } });
    // qa: card:PR096:7704813952fc1fb6eead6567f5c30bdcb02d5f32e0308a2afd01ef064f8884ba
    // qa: card:PR096:8a1c2684c3f10a7360b6b30d40c72f789384b0aaffea08d943de1aa994be976a
    expect(ability(PR096, 'a2')).toMatchObject({ type: 'declared', condition: { kind: 'partnerColor', color: '黄' }, cost: { kind: 'pay', items: [{ kind: 'sleepSelf' }, { kind: 'removeDeckTop', player: 'self', n: 5 }] }, effect: { kind: 'conditional', if: { kind: 'costRemovedMatches', filter: { trait: '探偵' }, n: 1 }, then: { kind: 'atom', verb: 'sceneRemove', args: { max: 1, side: 'either', filter: { levelMax: 8 } } } } });

    // qa: card:PR098:2caef4a33ad010091a3f5d3a254509fc73df36c88ade5d64d3f7ccbbe2be3d76
    expect(ability(PR098, 'a1')).toMatchObject({ condition: { kind: 'caseStatus', status: '事件編' }, effect: { kind: 'sequence', steps: [
      { kind: 'atom', verb: 'deckRevealUntil', args: { chooseMatch: 'upTo', player: 'self', maxN: 2, bind: '$revealed', bindMatch: '$matched', filter: { trait: '高校生', kind: 'character' } } },
      { kind: 'conditional', if: { kind: 'bound', key: '$matched', presence: 'matched' }, then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } } },
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' } },
    ] } });
    // qa: card:PR098:ddcac6ceb6ba89ab95e855683a39784409388705ec4efcfc21d693d918a6eab9
    expect(ability(PR098, 'a2')).toMatchObject({ type: 'declared', condition: { kind: 'caseStatus', status: '解決編' }, limit: { kind: 'turn', n: 1 } });

    // qa: card:PR099:ad2b121a6f7b061809cbcd256a49489c07f4e72ef5f88a8188e05b782044928a
    // qa: card:PR099:ff8a2f826e359d6d8e867d5d308df2e9c536498ca6174aa72ada90367d47132f
    expect(ability(PR099, 'a2')).toMatchObject({ type: 'declared', limit: { kind: 'turn', n: 1 }, effect: { kind: 'sequence', steps: [
      { kind: 'atom', verb: 'charModifyAP', args: { uid: '$self', delta: 1000, scope: 'turn' } },
      { kind: 'atom', verb: 'declareName', args: { bind: 'named', optional: true, domain: 'registered-character-card-name' } },
      { kind: 'atom', verb: 'charSetTurnEffect', args: { uid: '$self', key: 'nameOverride', val: '$dyn.declaredName' } },
    ] } });
  });
});
