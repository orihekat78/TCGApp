import { describe, expect, it } from 'vitest';
import type { CardDef } from '@/engine/types';
import { B06040 } from '@/cards/ct-p06/B06040';
import { B06041 } from '@/cards/ct-p06/B06041';
import { B09055 } from '@/cards/ct-p09/B09055';
import { B09064 } from '@/cards/ct-p09/B09064';
import { B09104 } from '@/cards/ct-p09/B09104';
import { B10006 } from '@/cards/ct-p10/B10006';
import { B10025 } from '@/cards/ct-p10/B10025';
import { B10028 } from '@/cards/ct-p10/B10028';
import { B10030 } from '@/cards/ct-p10/B10030';
import { B10032 } from '@/cards/ct-p10/B10032';

function ability(card: CardDef, id: string) {
  const found = card.abilities.find((entry) => entry.id === id);
  expect(found, `${card.id}.${id}`).toBeDefined();
  return found!;
}

describe('official QA Wave239: CT-P06/CT-P09/CT-P10 certification links', () => {
  it('pins the selected Wave239 contracts', () => {
    // qa: card:B06040:64bcc702a1eef11755063c85f1ed31e118d85cb0a23f222cb21932924971622d
    // qa: card:B06040:aff7468eb6ad588f973cb7b62f065ec5548f47cf7d262bf5359121e8578c9095
    expect(ability(B06040, 'a2')).toMatchObject({ trigger: { hook: 'enter', selfOnly: true }, effect: { kind: 'conditional', if: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: '高校生' }, excludeSelf: true }, nMin: 1 }, then: { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃', scope: 'turn' } } } });
    // qa: card:B06041:9bb7e012cd879bdcf2eb63f6f2811535d73800556956ac66e40ba6428413edff
    expect(ability(B06041, 'a1')).toMatchObject({ scope: 'on-hand', trigger: { hook: 'effect:declared', optional: true, selfOnly: true }, effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' } }, { kind: 'conditional', then: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } } }] } });
    // qa: card:B09055:f27845279c069c17db1301cbb3b6a52c9f2d1176f8080246c303bf3ab9b93870
    expect(ability(B09055, 'a2')).toMatchObject({ type: 'declared', condition: { kind: 'and', cs: [{ kind: 'partnerColor', color: '赤' }, { kind: 'fileAtLeast', n: 8 }] }, cost: { kind: 'pay', items: [{ kind: 'sleepSelf' }, { kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self', filter: { cardName: '赤井秀一' } }, n: { min: 1, max: 1 } } }] }, effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'sceneRemove', args: { uid: '$self', cause: 'effect' } }, { kind: 'atom', verb: 'sceneEnter', args: { target: { kind: 'pick', query: { area: ['partner-area', 'remove'], side: 'self', filter: { kind: 'character', cardName: '赤井秀一&世良真純' } }, n: { min: 0, max: 1 } } } }] } });
    // qa: card:B09064:0ef4b36903d9bb7a953ba43ff1ddda947939d66a64a069bd1385cbe9165546ab
    expect(ability(B09064, 'a1')).toMatchObject({ type: 'continuous', condition: { kind: 'scratchTrace', player: 'self', v: '発見済' }, continuousModifier: { grantKeywords: expect.any(Function) } });
    // qa: card:B09104:355b58049dd02d611cac75ef740d4fa8de857bf827775b5f717aac7fceac1899
    expect(ability(B09104, 'a1')).toMatchObject({ trigger: { hook: 'enter', selfOnly: true }, effect: { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$pick', kw: '突撃', scope: 'turn', target: { kind: 'pick', query: { area: 'scene', side: 'either', filter: { keyword: '現場リムーブ時', kind: 'character' }, excludeSelf: true }, n: { min: 0, max: 1 } } } } });
    // qa: card:B10006:2812b8d6276479b68ed440e76cb33e55dd7c99d39060b0a8cbf0f9ae7f53eb92
    expect(B10006).toMatchObject({ entersSleep: true });
    // qa: card:B10006:4145bf8dd64279beb229b05efb3c81c91c87663bdb6fc0c2a577fd220f4d74c7
    expect(ability(B10006, 'a2')).toMatchObject({ type: 'continuous', continuousModifier: { noAutoActivateSelf: true } });
    // qa: card:B10006:857b0cb3b78de34819018d536709dbc1e5fc0d25327d15b7e95cd0781f8b811d
    expect(ability(B10006, 'a3')).toMatchObject({ limit: { kind: 'turn', n: 2 }, trigger: { hook: 'hand:reveal', matcherCondition: { kind: 'or' } }, condition: { kind: 'and', cs: [{ kind: 'fileAtLeast', n: 5 }, { kind: 'turn', player: 'self' }, { kind: 'caseColor', color: ['青', '黒'], combine: 'and' }] } });
    // qa: card:B10006:c432675e2c8c5d6cb42b802fc90eaa436e043bd5448bc63c225adc3c6468addc
    expect(ability(B10006, 'a3')).toMatchObject({ effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'active' } }, { kind: 'atom', verb: 'charModifyAP', args: { uid: '$self', delta: 1000, scope: 'turn' } }] } });
    // qa: card:B10025:22815e37bb9e55964ef6fbca0dad60655148d1b1ee1b3d62410269664c6404b1
    expect(ability(B10025, 'a1')).toMatchObject({ condition: { kind: 'partnerColor', color: '緑' }, continuousModifier: { grantKeywords: expect.any(Function), printedKeywordWhenIconValid: true } });
    // qa: card:B10025:5186112e537ae66e1fd20851d377fb39a1039fdb31aa94a637ce22dbc95bbe27
    expect(ability(B10025, 'a2')).toMatchObject({ trigger: { hook: 'enter', selfOnly: true }, effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'deckRevealUntil', args: { stopAtFirstMatch: true, filter: { kind: 'event', color: '緑', levelMin: 7, keyword: 'ヒラメキ' } } }, { kind: 'conditional' }, { kind: 'atom', verb: 'deckToBottomBound', args: { order: 'preserve' } }, { kind: 'atom', verb: 'deckShuffle' }] } });
    // qa: card:B10025:defe7bd88312f994f3509cac1b1eaf98cfd768da9b415ad698a446d7cc39b2c5
    expect(ability(B10025, 'a3')).toMatchObject({ limit: { kind: 'turn', n: 1 }, trigger: { hook: 'evidence:gain' }, condition: { kind: 'and', cs: [{ kind: 'caseStatus', status: '解決編' }, { kind: 'turn', player: 'self' }, { kind: 'triggerPlayerIs', side: 'self' }] }, effect: { kind: 'atom', verb: 'sceneSetState', args: { state: 'sleep', target: { kind: 'pick', query: { area: 'scene', side: 'either' }, n: { min: 0, max: 1 } } } } });
    // qa: card:B10028:7d4e5a15f1e2869123ee4ecab7154fb5fb4d1a5b956e7206fd67775940866d4f
    expect(ability(B10028, 'a1')).toMatchObject({ scope: 'on-hand', trigger: { hook: 'effect:declared', optional: true, selfOnly: true }, condition: { kind: 'turn', player: 'self' }, effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: { dyn: '$self.sceneTrait.高校生 * 1000' }, scope: 'contact' } } });
    // qa: card:B10030:8b77789149ba06c91087cb9be96046fd5d3f4c02538e74c5ffbb114fe7c66bb2
    expect(ability(B10030, 'a2')).toMatchObject({ scope: 'on-hand', trigger: { hook: 'effect:declared', optional: true, selfOnly: true }, condition: { kind: 'contactCharMatches', who: 'byUid', filter: { color: '緑', trait: '警察' } }, effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } } });
    // qa: card:B10032:2373546c7aa92398f17cbcf20944f04013c8deed80d11938965a4cc4e57e980c
    expect(ability(B10032, 'a1')).toMatchObject({ scope: 'on-hand', trigger: { hook: 'effect:declared', selfOnly: true }, condition: { kind: 'partnerColor', color: '緑' } });
    // qa: card:B10032:3e279e863cc16f9cea2588edbb5676258217bbe7d054edaeca606f824e0f800b
    expect(ability(B10032, 'a1')).toMatchObject({ effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'charGrantKeyword', args: { kw: '突撃[キャラ]', scope: 'turn', target: { kind: 'pick', query: { area: 'scene', side: 'self', filter: { color: '緑', trait: '警察' } }, n: { min: 0, max: 1 } } } }, { kind: 'atom', verb: 'sceneEnter' }] } });
    // qa: card:B10032:87a615701ba78ae5a36c13f7fb5f94891e0979a7f97a0ec14fa68595f695e91a
    expect(ability(B10032, 'a1')).toMatchObject({ effect: { kind: 'sequence', steps: [expect.anything(), { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', from: 'remove', viaEffect: true, max: 1, filter: { kind: 'character', color: '緑', trait: '警察', levelMax: 3 } } }] } });
  });
});
