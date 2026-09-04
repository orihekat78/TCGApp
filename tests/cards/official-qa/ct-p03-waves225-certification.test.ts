import { describe, expect, it } from 'vitest';
import type { CardDef } from '@/engine/types';
import { B03049 } from '@/cards/ct-p03/B03049';
import { B03051 } from '@/cards/ct-p03/B03051';
import { B03052 } from '@/cards/ct-p03/B03052';
import { B03054 } from '@/cards/ct-p03/B03054';
import { B03056 } from '@/cards/ct-p03/B03056';
import { B03057 } from '@/cards/ct-p03/B03057';
import { B03058 } from '@/cards/ct-p03/B03058';
import { B03062 } from '@/cards/ct-p03/B03062';
import { B03063 } from '@/cards/ct-p03/B03063';
import { B03066 } from '@/cards/ct-p03/B03066';
import { B03067 } from '@/cards/ct-p03/B03067';
import { B03068 } from '@/cards/ct-p03/B03068';

function ability(card: CardDef, id: string) {
  const found = card.abilities.find((entry) => entry.id === id);
  expect(found, `${card.id}.${id}`).toBeDefined();
  return found!;
}

describe('official QA Wave225: CT-P03 certification links', () => {
  it('pins bottom-deck mandatory branches and disguise non-entry', () => {
    // qa: card:B03049:7d3de8ad1f23b23820c5a17fdd402b9584c00b0a87cc1df897a9e08cad061a9b
    expect(ability(B03049, 'a1')).toMatchObject({ effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'deckRevealUntil', args: { fromBottom: true, maxN: 1, bind: '$revealed', bindMatch: '$matched' } }, expect.anything(), { kind: 'conditional', then: { kind: 'atom', verb: 'handAddFromDeckBottom', args: { player: 'self' } } }] } });
    // qa: card:B03049:9a3dd2659b08b28ceba6e39f0a28099352763b4615219cb8d0da2f3b53e97e24
    expect(ability(B03049, 'a1')).toMatchObject({ effect: { kind: 'sequence', steps: [expect.anything(), { kind: 'conditional', then: { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', viaEffect: true, deckPos: 'bottom' } } }, expect.anything()] } });
    // qa: card:B03051:8a7180106466966e89d7a5383c2165e41f031c080fdf564825f596bb9834d3db
    expect(ability(B03051, 'a1')).toMatchObject({ trigger: { hook: 'enter', selfOnly: true }, effect: { kind: 'atom', verb: 'handAddFromDeckBottom' } });
    expect(ability(B03051, 'a2')).toMatchObject({ type: 'icon-disguise' });
    expect(JSON.stringify(ability(B03051, 'a2'))).not.toContain('enter');
    // qa: card:B03052:33d34bbd4209088105455974b7065c37a7037ad667cf2342ded69813b95a98c0
    expect(ability(B03052, 'a1')).toMatchObject({ trigger: { hook: 'disguise:replaced', selfOnly: true, matcherCondition: { kind: 'disguiseReplacedByMatches', filter: { cardName: 'ベルモット' } } } });
  });

  it('pins bond, state, declared-effect, and disguise-observer contracts', () => {
    // qa: card:B03054:57ba6dc5ac7bdb819049d2fa0690f0f5b23d97449c338662b465cf8a01ff9763
    expect(ability(B03054, 'a2')).toMatchObject({ type: 'declared', condition: { kind: 'bond', cardName: '京極真' }, limit: { kind: 'turn', n: 1 } });
    // qa: card:B03056:2a7ae93b926ee4d1cf83481b483817a89ddefee141c9b7bccd3e7e432b00b4af
    expect(ability(B03056, 'a2')).toMatchObject({ effect: { kind: 'optional', effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'sceneRemove', args: { uid: '$self' } }, { kind: 'atom', verb: 'evidenceGain', args: { player: 'self', n: 1 } }] } } });
    // qa: card:B03057:8c9b38b506caa2af7392e03b3434d3b28d54717fdd1d64e5439287c8e4f0d4a6
    expect(ability(B03057, 'a1')).toMatchObject({ type: 'continuous', condition: { kind: 'charStateIs', ref: { kind: 'self' }, state: 'sleep' }, continuousModifier: { untargetableByAction: true } });
    // qa: card:B03057:2f4816776f11529576b481625b33ede5c8f40d5125364b0af3b8ed9342a9ea1c
    expect(ability(B03057, 'a2')).toMatchObject({ trigger: { hook: 'ability:declared' }, effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'draw', args: { n: 1 } }, { kind: 'atom', verb: 'discard', args: { n: 1 } }] } });
    // qa: card:B03058:1095e1b3f361f13bbc638a8a9b108f4d7ead125a1256356201b19e3613b558a3
    expect(ability(B03058, 'a1')).toMatchObject({ condition: { kind: 'turn', player: 'self' }, trigger: { hook: 'disguise:into', matcherCondition: { kind: 'triggerCharMatches', excludeSource: true, payloadKey: 'uid' } } });
    // qa: card:B03058:aaa51c0429069cfeae5a8a4a39694a61462cf5d7ce01ebd4bc9d086451810820
    expect(ability(B03058, 'a1').trigger).not.toHaveProperty('selfOnly');
  });

  it('pins forced reveal completion and resolution-time recipients', () => {
    // qa: card:B03062:f3b41a2295286e768d85a5ab31eeebcf6b54861bc8fd1d3e3deb3c97edb5b411
    expect(ability(B03062, 'a1')).toMatchObject({ effect: { kind: 'chain', steps: [expect.anything(), { kind: 'sequence', steps: [{ kind: 'atom', verb: 'deckRevealUntil', args: { filter: { kind: 'character', levelMin: 8, levelMax: 8 }, bind: '$revealed', bindMatch: '$matched' } }, expect.anything(), { kind: 'atom', verb: 'deckToBottomBound', args: { bindKey: '$revealed', order: 'preserve' } }, { kind: 'atom', verb: 'deckShuffle', args: { player: 'self' } }] }] } });
    // qa: card:B03062:8c92026b8760a5ce51096319f2e85be0394ab96223686576dae6b0de6ed73ac8
    expect(ability(B03062, 'a1')).toMatchObject({ effect: { kind: 'chain', steps: [expect.anything(), { kind: 'sequence', steps: [expect.anything(), { kind: 'conditional', then: { kind: 'atom', verb: 'sceneEnter', args: { cardId: '$matched.cardId', viaEffect: true } } }, expect.anything(), expect.anything()] }] } });
    // qa: card:B03063:86b5b55f06648c44a11f5fab4dc84261f92dd52bce34edccb47e6794f20714f6
    expect(ability(B03063, 'a1')).toMatchObject({ effect: { kind: 'sequence', steps: [expect.anything(), { kind: 'forEach', over: { kind: 'all', query: { area: 'scene', side: 'self', filter: { trait: '空手家' } } }, do: { kind: 'atom', verb: 'charModifyAP', args: { delta: 1000, scope: 'turn' } } }] } });
  });

  it('pins partner-gated effects, declared costs, and no-entry mandatory fallback', () => {
    // qa: card:B03066:c07158b2fa2d6b6285fa77a6db81dc4594a59e8f65a4cc14b7dc4dd87338f55a
    expect(ability(B03066, 'a1')).toMatchObject({ type: 'continuous', condition: { kind: 'partnerColor', color: '赤' }, continuousModifier: { grantKeywords: expect.any(Function) } });
    // qa: card:B03066:b34f939ceba2f547ad6f01ee968061869d0f8abc4e72fa0d51c20b0c14a53ee1
    expect(ability(B03066, 'a2')).toMatchObject({ effect: { kind: 'optional', effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'evidenceGain', args: { player: 'opp', n: 1 } }, { kind: 'atom', verb: 'sceneRemove', args: { max: 1, side: 'either', filter: { levelMax: 7 } } }] } } });
    // qa: card:B03067:4472fca3c9409ba1b6c58638fa1e3d1ce3f48703709e95f268a86741dbb0da25
    expect(ability(B03067, 'a3')).toMatchObject({ cost: { kind: 'removeFromScene', target: { kind: 'pick', query: { area: 'scene', side: 'self', filterAny: [{ cardName: '赤井秀一', levelMin: 7 }, { cardName: 'ライ', levelMin: 7 }] }, n: { min: 1, max: 1 } } } });
    // qa: card:B03068:d05a134570b003183bbfbb64048b097f80a32882358698db6e17c53210171bcc
    expect(ability(B03068, 'a1')).toMatchObject({ effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'sceneEnter', args: { from: 'hand', enterSleep: true, target: { kind: 'pick', n: { min: 0, max: 1 } } } }, { kind: 'conditional', if: { kind: 'not', c: { kind: 'bound', key: '$matched', presence: 'matched' } }, then: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'evidenceGain', args: { player: 'opp', n: 1 } }, { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } }] } }] } });
    // qa: card:B03068:d80f04fd9ed2fa2cc2d120f6086e1121f6342b9135da0bfe0abfeb59a2967713
    expect(ability(B03068, 'a1')).toMatchObject({ trigger: { hook: 'enter', selfOnly: true }, effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'sceneEnter', args: { viaEffect: true } }, expect.anything()] } });
    // qa: card:B03068:b34f939ceba2f547ad6f01ee968061869d0f8abc4e72fa0d51c20b0c14a53ee1
    expect(ability(B03068, 'a1').effect).not.toMatchObject({ kind: 'optional' });
  });
});
