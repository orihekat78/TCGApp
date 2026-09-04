import { describe, expect, it } from 'vitest';
import type { CardDef } from '@/engine/types';
import { B03089 } from '@/cards/ct-p03/B03089';
import { B03092 } from '@/cards/ct-p03/B03092';
import { B03093 } from '@/cards/ct-p03/B03093';
import { B03095 } from '@/cards/ct-p03/B03095';
import { B03096 } from '@/cards/ct-p03/B03096';
import { B03097 } from '@/cards/ct-p03/B03097';
import { B03099 } from '@/cards/ct-p03/B03099';
import { B03100 } from '@/cards/ct-p03/B03100';
import { B03103 } from '@/cards/ct-p03/B03103';
import { B03104 } from '@/cards/ct-p03/B03104';
import { B03110 } from '@/cards/ct-p03/B03110';

function ability(card: CardDef, id: string) {
  const found = card.abilities.find((entry) => entry.id === id);
  expect(found, `${card.id}.${id}`).toBeDefined();
  return found!;
}

describe('official QA Wave227: CT-P03 certification links', () => {
  it('pins the selected Wave227 contracts', () => {
    // qa: card:B03089:280d69450fb245a1931cb752384e44ae37cc401257f4b7889c9eba0e6f26a1d8
    expect((ability(B03089, 'a1').effect as { options: unknown }).options).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'sequence', steps: expect.arrayContaining([expect.objectContaining({ kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$matched.uid', kw: '突撃', scope: 'turn' } }), expect.objectContaining({ kind: 'atom', verb: 'charSetTurnEffect', args: { uid: '$matched.uid', key: 'removeOnTurnEnd', val: true } })]) })]));
    // qa: card:B03089:4f1e7b564a969ed3ca23c1c7599caeef0dd4fcdb4d5299623c98f1d4009bea99
    expect(ability(B03089, 'a1').effect).toMatchObject({ kind: 'choice', options: expect.arrayContaining([expect.objectContaining({ kind: 'sequence', steps: expect.arrayContaining([{ kind: 'atom', verb: 'charSetTurnEffect', args: { uid: '$matched.uid', key: 'removeOnTurnEnd', val: true } }]) })]) });
    // qa: card:B03092:34a7ad2d3d33dfac431b37f65e14ec652ea9bb81780d7f13a3ed622ff303802c
    expect(ability(B03092, 'a1')).toMatchObject({ trigger: { hook: 'leave:to-remove' }, condition: { kind: 'and', cs: expect.arrayContaining([{ kind: 'removedCharMatches', side: 'self', removedFilter: { trait: '警察', levelMin: 6 } }]) } });
    // qa: card:B03092:4587f65dee4dc5285a44d07c061ba8d42ee33959865c2c550e0deff5da40ea97
    expect(ability(B03092, 'a1')).toMatchObject({ condition: { kind: 'and', cs: expect.arrayContaining([{ kind: 'turn', player: 'opp' }]) }, trigger: { hook: 'leave:to-remove' } });
    // qa: card:B03092:b70fafaa210dd9ec3fa55df445a501cabdc6a7f0fa6bdd23dc766beefbcb6d21
    expect(ability(B03092, 'a1')).toMatchObject({ limit: { kind: 'turn', n: 1 }, effect: { kind: 'atom', verb: 'sceneSetState', args: { max: 1, state: 'stun', filter: { levelMax: 7 } } } });
    // qa: card:B03093:7cf509438ed239cee5f4ed8f2ceb3430fdfe0725b39aa3123a2aad8accc5ded7
    expect(ability(B03093, 'a1')).toMatchObject({ type: 'continuous', continuousModifier: { untargetableByOppEventAura: { trait: '警察' }, untargetableByOppEventAuraState: ['sleep'] } });
    // qa: card:B03095:e2cb37e2c028ff918b6b633c47ea158ba3011ae3224e50c5e12a27b93a41c1ae
    expect(ability(B03095, 'a1')).toMatchObject({ trigger: { hook: 'action:declare' }, condition: { kind: 'and', cs: expect.arrayContaining([{ kind: 'triggerCharMatches', side: 'opp', filter: {} }, { kind: 'charStateIs', ref: { kind: 'self' }, state: 'sleep' }]) } });
    // qa: card:B03096:e2cb37e2c028ff918b6b633c47ea158ba3011ae3224e50c5e12a27b93a41c1ae
    expect(ability(B03096, 'a1')).toMatchObject({ trigger: { hook: 'reasoning:after-sleep', matcherCondition: { kind: 'triggerCharMatches', side: 'self', filter: {} } } });
    // qa: card:B03096:9f6dd27f461691dbed853838301402ea7f626e048ca55d38f4cd670fd660d185
    expect(ability(B03096, 'a1').trigger).toMatchObject({ matcherCondition: { kind: 'triggerCharMatches', side: 'self', filter: {} } });
    // qa: card:B03096:0d310607ecb1545941beca62cb928c162123c380c3ec000be0d418c018300f0c
    expect(JSON.stringify(ability(B03096, 'a1'))).not.toContain('lp');
    // qa: card:B03097:5a6ed1e2eed3eae8a3fa20f4bb1a5bc6d7a1b71968566dbb124edd0c65ad85d7
    expect(ability(B03097, 'a1')).toMatchObject({ trigger: { hook: 'action:declare', matcherCondition: { kind: 'and', cs: expect.arrayContaining([{ kind: 'triggerActionKind', v: 'char' }, { kind: 'triggerCharMatches', side: 'opp', filter: {} }]) } } });
    // qa: card:B03097:72a0b57eef4229c84637f48aef7155a8305552a0ed327de216c19c14b9759e79
    expect(ability(B03097, 'a1')).toMatchObject({ effect: { kind: 'atom', verb: 'charModifyAP', args: { filter: { cardName: '目暮十三' }, delta: 2000, scope: 'action' } } });
    // qa: card:B03099:e2cb37e2c028ff918b6b633c47ea158ba3011ae3224e50c5e12a27b93a41c1ae
    expect(ability(B03099, 'a1')).toMatchObject({ trigger: { hook: 'action:declare', selfOnly: true }, limit: { kind: 'turn', n: 1 } });
    // qa: card:B03099:231ae172911d4f51971229ee61c6c2835feb5f0b64c3dc2c776ee3f083d4688b
    expect(ability(B03099, 'a1')).toMatchObject({ effect: { kind: 'atom', verb: 'sceneEnter', args: { from: 'remove', viaEffect: true, enterSleep: true, max: 1, filter: { trait: '長野県警', levelMax: 6, kind: 'character' } } } });
    // qa: card:B03100:88d6c04a5fa7e520f41041596f34d2d4ac9d8b942cfd47559db82c625eaeaa88
    expect(ability(B03100, 'a1')).toMatchObject({ type: 'declared', cost: { kind: 'removeDeckTop', player: 'self', n: 1 } });
    // qa: card:B03103:ba89e93a8def9f486c49dc5c679bf8c37c1292eba983bc692c99708de23b6684
    expect(ability(B03103, 'a1')).toMatchObject({ effect: { kind: 'conditional', if: { kind: 'sceneHas', query: { area: 'scene', side: 'self' }, nMin: 5 }, then: { kind: 'atom', verb: 'sceneRemove', args: { side: 'opp', max: 1 } }, else: { kind: 'atom', verb: 'sceneSetState', args: { side: 'opp', state: 'stun', max: 1 } } } });
    // qa: card:B03104:abd1a4e7d0a036e849c08f378890991a2a9f76965ae560a2ff35be30dea36786
    expect(ability(B03104, 'a1')).toMatchObject({ effect: { kind: 'conditional', if: { kind: 'removeCountAtLeast', player: 'self', n: 15 } } });
    // qa: card:B03110:2469ea56f44343e55e480c914ef0d04b2c2c43142d65251a49333d521a78a18e
    expect(((ability(B03110, 'a1').effect as { effect: { steps: unknown } }).effect.steps)).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'atom', verb: 'filePopToHand', args: { player: 'self', n: 2, gate: true } })]));
    // qa: card:B03110:438e57977549553021cec42f80d569859f368fdbb46c71db6893ac0060aa5a38
    expect(((ability(B03110, 'a1').effect as { effect: { steps: unknown } }).effect.steps)).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'forEach', over: { kind: 'all', query: { area: 'scene', side: 'either', excludeSelf: true } }, do: { kind: 'atom', verb: 'sceneRemove', args: { uid: '$each.uid', cause: 'effect' } } })]));
  });
});
