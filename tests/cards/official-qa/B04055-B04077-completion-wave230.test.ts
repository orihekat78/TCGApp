import { describe, expect, it } from 'vitest';
import type { CardDef } from '@/engine/types';
import { B04055 } from '@/cards/ct-p04/B04055';
import { B04060 } from '@/cards/ct-p04/B04060';
import { B04063 } from '@/cards/ct-p04/B04063';
import { B04064 } from '@/cards/ct-p04/B04064';
import { B04068 } from '@/cards/ct-p04/B04068';
import { B04069 } from '@/cards/ct-p04/B04069';
import { B04071 } from '@/cards/ct-p04/B04071';
import { B04072 } from '@/cards/ct-p04/B04072';
import { B04073 } from '@/cards/ct-p04/B04073';
import { B04075 } from '@/cards/ct-p04/B04075';
import { B04077 } from '@/cards/ct-p04/B04077';

function ability(card: CardDef, id: string) {
  const found = card.abilities.find((entry) => entry.id === id);
  expect(found, `${card.id}.${id}`).toBeDefined();
  return found!;
}

describe('official QA Wave230: CT-P04 certification links', () => {
  it('pins the selected Wave230 contracts', () => {
    // qa: card:B04055:6540c29ef6f51c6b19fc83e88f6684e732d66da164b83e05faca1f9631b860aa
    expect(ability(B04055, 'a1').effect).toMatchObject({ steps: expect.arrayContaining([expect.objectContaining({ kind: 'conditional', then: expect.objectContaining({ kind: 'atom', verb: 'handAddFromDeck' }) })]) });
    // qa: card:B04055:b1a78dda6c2d31a45705a12285751192452843bae26e9f69c5a290d9e425f011
    expect(ability(B04055, 'a1').condition).toMatchObject({ cs: expect.arrayContaining([{ kind: 'sourceInScene' }]) });
    // B04056 is an authority/implementation mismatch; it has no aligned assertion.
    // qa: card:B04060:6899f095b83ce70a131b90cbabf48bebcf26962c8fc6412baddb06077b21ca5a
    expect(ability(B04060, 'a1')).toMatchObject({ trigger: { hook: 'effect:declared', optional: true }, effect: { kind: 'conditional', if: { kind: 'contactCharMatches', filter: { trait: ['赤井家'] } } } });
    // qa: card:B04063:01e64ea9e0d149ca2362d7754c49a44727c3284f0467137dc414ec81443e2891
    expect(ability(B04063, 'a1').effect).toMatchObject({ steps: expect.arrayContaining([expect.objectContaining({ kind: 'atom', verb: 'deckRevealUntil', args: expect.objectContaining({ chooseMatch: 'upTo' }) })]) });
    // qa: card:B04063:059440a8f426d285f350fa18eb71a15ca056ef53ac7b82203727b3370abcc835
    expect(ability(B04063, 'a1').effect).toMatchObject({ steps: expect.arrayContaining([expect.objectContaining({ kind: 'atom', verb: 'boundToRemove', args: expect.objectContaining({ refreshAfter: true }) }), expect.objectContaining({ kind: 'atom', verb: 'sceneRemove', args: expect.objectContaining({ filter: { levelMax: { dyn: '$bound.$revealed.levelSum' } } }) })]) });
    // qa: card:B04064:e28fd7bbe07db2e51cc91ab6fbffcec555afa2cd61d8614f13e9f55b5b752486
    expect(ability(B04064, 'a1').effect).toMatchObject({ kind: 'sequence', steps: expect.arrayContaining([expect.objectContaining({ kind: 'atom', verb: 'sceneRemove', args: expect.objectContaining({ max: 1 }) }), expect.objectContaining({ kind: 'atom', verb: 'sceneEnter', args: expect.objectContaining({ from: 'hand', max: 1 }) })]) });
    // qa: card:B04068:f9ca6c1f234b459fe5e73452949fcd02e3b7ec4cf30f2df07134d771866a5398
    expect(ability(B04068, 'a1').effect).toMatchObject({ kind: 'optional', effect: { kind: 'chain', steps: expect.arrayContaining([expect.objectContaining({ kind: 'atom', verb: 'sceneEnter', args: expect.objectContaining({ from: 'hand', max: 1 }) })]) } });
    // qa: card:B04069:6cd559c25f4af4c5114724182b329df1d86d704c4c2de67761a4dc9d94a33fe1
    expect(ability(B04069, 'a2')).toMatchObject({ type: 'continuous', continuousModifier: { apDeltaAura: 1000, auraFilter: { cardName: '高木渉' } } });
    // qa: card:B04069:9d7937996526fe2bcdb8f793e037205d798379f578fa5653cfa93ffc750e4d58
    expect(ability(B04069, 'a3')).toMatchObject({ trigger: { hook: 'enter', selfOnly: true }, effect: { kind: 'conditional', if: { kind: 'removeTraitAtLeast', trait: '警察', n: 3 } } });
    // qa: card:B04069:df46799cf1f399345631404650f5c38e9d1637bd536e70f17adc3d4569d31dd1
    expect(ability(B04069, 'a1').condition).toMatchObject({ kind: 'sceneHas', query: { filter: { trait: '警察' } }, nMin: 3 });
    // qa: card:B04071:0ef2d51f41291a5623b50db154106ed1af484e122db6536ff1f82dd555041c60
    expect(ability(B04071, 'a1').effect).toMatchObject({ if: { kind: 'sceneHas', query: { filter: { trait: '警察' } }, nMin: 3 } });
    // qa: card:B04072:8c9b38b506caa2af7392e03b3434d3b28d54717fdd1d64e5439287c8e4f0d4a6
    expect(ability(B04072, 'a1').condition).toMatchObject({ kind: 'charStateIs', ref: { kind: 'self' }, state: 'sleep' });
    // qa: card:B04072:dae226bbb0df2cb9e06298ed98fd2ca0d89daab5b50c611db1d9e9fc8a4a8fb8
    expect(ability(B04072, 'a1').continuousModifier).toMatchObject({ untargetableByActionAura: { levelMax: 5, color: ['青', '黄'] } });
    // qa: card:B04073:f4d8d68b88bfcb0f5152cef533ffdf63eb2394be57534035ecb2b0eaa94f9b17
    expect(ability(B04073, 'a1')).toMatchObject({ trigger: { hook: 'action:guarded', matcherCondition: { payloadKey: 'guardUid', side: 'self' } } });
    // qa: card:B04075:62e723bd73c86e05739414612fd8e70bd9ce774b5335c8bffcd6dd9782e03553
    expect(ability(B04075, 'a1')).toMatchObject({ trigger: { hook: 'cutin:used', hooks: ['disguise:into'], matcherCondition: { kind: 'triggerPlayerIs', side: 'opp' } } });
    // qa: card:B04077:4f757078c956fc19a19d91abc09b005bfb32d0f3f73768736b1f438173822897
    expect(ability(B04077, 'a1').cost).toMatchObject({ kind: 'removeDeckTop', player: 'self', n: 3 });
    // qa: card:B04077:d2b99e9114d35150ffe6603359073c0c9e1c92688ace3ba18af837ea40e8f085
    expect(ability(B04077, 'a1').effect).toMatchObject({ then: expect.objectContaining({ kind: 'atom', verb: 'charSetTurnEffect', args: expect.objectContaining({ key: 'actionTargetsActive', val: true }) }) });
  });
});
