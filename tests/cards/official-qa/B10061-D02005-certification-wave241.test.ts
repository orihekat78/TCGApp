import { describe, expect, it } from 'vitest';
import { B10061 } from '@/cards/ct-p10/B10061';
import { B10067 } from '@/cards/ct-p10/B10067';
import { B10068 } from '@/cards/ct-p10/B10068';
import { B10069 } from '@/cards/ct-p10/B10069';
import { B10070 } from '@/cards/ct-p10/B10070';
import { B10072 } from '@/cards/ct-p10/B10072';
import { B10073 } from '@/cards/ct-p10/B10073';
import { B10076 } from '@/cards/ct-p10/B10076';
import { D01006 } from '@/cards/ct-d01/D01006';
import { D01008 } from '@/cards/ct-d01/D01008';
import { D02004 } from '@/cards/ct-d02/D02004';
import { D02005 } from '@/cards/ct-d02/D02005';

function ability(card: { abilities: readonly { id: string }[] }, id: string) {
  const found = card.abilities.find((entry) => entry.id === id);
  expect(found, `${card.id}.${id}`).toBeDefined();
  return found!;
}

describe('official QA Wave241: CT-P10 through CT-D02 certification links', () => {
  it('pins the selected Wave241 contracts', () => {
    // qa: card:B10061:519dbfdee2bdc93fae5b2e546bd43cfb5c3617f78e7cd15de0fbe041fd18815d
    // qa: card:B10061:6b40bc9cc445b5df49373927a5f69d9cdec6822bf54820ddc202ad2320813f28
    // qa: card:B10061:73d26452e5e10a45e8ee0fe0be06c4a5215f9d51bf4d147c02e87c69cdb5aa13
    expect(ability(B10061, 'a2')).toMatchObject({ type: 'declared', condition: { kind: 'caseStatus', status: '解決編' }, limit: { kind: 'turn', n: 1 }, effect: { kind: 'choice', chooser: 'self' } });
    // qa: card:B10067:7d52f4c6d6ea659aeed6d473974e2f900610689554eaa9ef95662bff6912ffdd
    expect(ability(B10067, 'a2')).toMatchObject({ trigger: { hook: 'phase:end:start' }, condition: { kind: 'and', cs: [{ kind: 'bond', cardName: '伊達航' }, { kind: 'turn', player: 'self' }] }, effect: { kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'active' } } });
    // qa: card:B10068:132b6ee607cc3a33eb9e91d1f3bda4dc39dfcf54b0a2f045cc2168294ce8a923
    expect(ability(B10068, 'a1')).toMatchObject({ condition: { kind: 'partnerColor', color: '黄' }, trigger: { hook: 'enter', selfOnly: true }, effect: { kind: 'atom', verb: 'sceneRemove', args: { max: 1, filter: { apMax: 8000 } } } });
    // qa: card:B10068:15e4cae14b711705c2941e1bfebdcb912404db008f6e717734d1aefdb943637c
    // qa: card:B10068:a7d1e268a61494137da24668c59cb4cf8426932db4b0b4918497ae68d17198a3
    expect(ability(B10068, 'a2')).toMatchObject({ trigger: { hook: 'phase:end:start' }, effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'deckRevealUntil' }, { kind: 'conditional', then: { kind: 'atom', verb: 'handAddFromDeck' } }, { kind: 'atom', verb: 'boundToRemove' }] } });
    // qa: card:B10069:461a5eb14e2596f2c3a914d080eb93d30253118b92b71f09174815134cae80f7
    expect(ability(B10069, 'a1')).toMatchObject({ type: 'continuous', condition: { kind: 'and', cs: [{ kind: 'partnerColor', color: '黄' }, { kind: 'bond', cardName: '佐藤美和子' }] }, continuousModifier: { lpDelta: 1 } });
    // qa: card:B10069:b9fe5960816ff4d0b7b0cc3e2a662c36947283aee1e4d85b637105d2be9a06cc
    expect(ability(B10069, 'a2')).toMatchObject({ type: 'declared', limit: { kind: 'turn', n: 1 }, effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'sceneRemove' }, { kind: 'atom', verb: 'draw' }] } });
    // qa: card:B10070:0e0a980e8bd27d7b1e99856973569ea1d66df41702431455b179d458e108f9fc
    expect(ability(B10070, 'a1')).toMatchObject({ condition: { kind: 'removeFilterAtLeast', filters: [{ keyword: '疾風' }], n: 3 }, continuousModifier: { grantKeywords: expect.any(Function) } });
    // qa: card:B10070:c9c203bdfe2621b9699139d3b3064c23103cc578f99037464160028250f79e02
    expect(ability(B10070, 'a2')).toMatchObject({ trigger: { hook: 'enter', selfOnly: true, matcherCondition: { kind: 'enterOrderEquals', n: 1 } }, effect: { kind: 'conditional', then: { kind: 'optional' } } });
    // qa: card:B10072:a3ef757172af5d4f1e0e941ac2a55ee53fcbee85aaf3d04007d754f9901d4284
    expect(ability(B10072, 'a1')).toMatchObject({ type: 'declared', effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'deckRevealUntil' }, { kind: 'conditional', then: { kind: 'atom', verb: 'handAddFromDeck' } }, { kind: 'atom', verb: 'deckToBottomBound' }, { kind: 'atom', verb: 'deckShuffle' }] } });
    // qa: card:B10073:77877415fb6fd8b0d17eee578a36acd1043ac2500b0f75eb1beb704e9954c7ca
    expect(ability(B10073, 'a1')).toMatchObject({ trigger: { hook: 'enter', selfOnly: true }, condition: { kind: 'and', cs: [{ kind: 'caseStatus', status: '解決編' }, { kind: 'enterSource' }] }, effect: { kind: 'atom', verb: 'draw' } });
    // qa: card:B10076:f2397b8ee69af3696bad6d8e09ad86ebb5ad51ccc83f56ae1e323123cac20941
    expect(ability(B10076, 'a1')).toMatchObject({ scope: 'on-hand', trigger: { hook: 'effect:declared', optional: true, selfOnly: true }, effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'charModifyAP' }, { kind: 'conditional' }] } });
    // qa: card:D01006:a2402f0f947b17dedfb683450387bbde4289fb96ef27c31d22ccd970140ffc8a
    expect(ability(D01006, 'a1')).toMatchObject({ type: 'declared', limit: { kind: 'turn', n: 1 }, effect: { kind: 'atom', verb: 'charModifyAP', args: { delta: 1000, max: 1, side: 'either', scope: 'turn' } } });
    // qa: card:D01008:a9dffc672577e2ac01bc57bd294c9f3f7c3ffda97cd64317682cac6760520d7e
    expect(ability(D01008, 'a1')).toMatchObject({ trigger: { hook: 'enter', selfOnly: true }, effect: { kind: 'sequence' } });
    // qa: card:D02004:6f2a6b6ad6c5c7a0f0ed5c02ebfbcefeced904e167f2e3ff9f4c48fe240e66c7
    expect(ability(D02004, 'a1')).toMatchObject({ trigger: { hook: 'action:declare', selfOnly: true }, effect: { kind: 'forEach' } });
    // qa: card:D02005:065c77d631c9becb58c07dc838ebdc5f661493cc7039093fe079bb7e260af6f7
    // qa: card:D02005:2beb8a75778b881e50e72a1484237d7719b7d057b41fa6e98de7dc27a2755b4a
    expect(ability(D02005, 'a1')).toMatchObject({ limit: { kind: 'turn', n: 1 }, trigger: { hook: 'enter' }, effect: { kind: 'atom', verb: 'sceneSetState', args: { state: 'sleep', max: 1, side: 'either' } } });
  });
});
