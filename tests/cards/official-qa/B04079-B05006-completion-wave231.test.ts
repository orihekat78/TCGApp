import { describe, expect, it } from 'vitest';
import type { CardDef } from '@/engine/types';
import { B04079 } from '@/cards/ct-p04/B04079';
import { B04080 } from '@/cards/ct-p04/B04080';
import { B04082 } from '@/cards/ct-p04/B04082';
import { B04084 } from '@/cards/ct-p04/B04084';
import { B04088 } from '@/cards/ct-p04/B04088';
import { B04089 } from '@/cards/ct-p04/B04089';
import { B04090 } from '@/cards/ct-p04/B04090';
import { B04091 } from '@/cards/ct-p04/B04091';
import { B04092 } from '@/cards/ct-p04/B04092';
import { B04093 } from '@/cards/ct-p04/B04093';
import { B05006 } from '@/cards/ct-p05/B05006';

function ability(card: CardDef, id: string) {
  const found = card.abilities.find((entry) => entry.id === id);
  expect(found, `${card.id}.${id}`).toBeDefined();
  return found!;
}

describe('official QA Wave231: CT-P04/CT-P05 certification links', () => {
  it('pins the selected Wave231 contracts', () => {
    // qa: card:B04079:06842c90040967bd542ad22610c2e6ecb688ce4126383ea2baef4df739beb14c
    expect(JSON.stringify(ability(B04079, 'a2').effect)).toContain('"bindKey":"$matched"');
    // qa: card:B04080:4cb9eb794508ac2f92175d3c096a93cf15e87868ae7115ce4461da634cb8eae5
    expect(JSON.stringify(ability(B04080, 'a1').effect)).toContain('"state":"active"');
    // qa: card:B04082:20d1c8b6bc8c05dc9e2c61dd764e967f006f3847935ccacedacf165ffc4a8a17
    expect(ability(B04082, 'a1')).toMatchObject({ trigger: { hook: 'action:declare', matcherCondition: { kind: 'triggerCharMatches', side: 'self', filter: { cardName: '千葉和伸' } } } });
    // qa: card:B04084:15791ebc97a24cde50303a6e8ee76cc43d81510978962fa7d882651a61579115
    expect(JSON.stringify(ability(B04084, 'a1').effect)).toContain('"minimumPolicy":"exact"');
    // qa: card:B04084:653e42c083b0ff2e4cae9bb63457de430cd8e9beb4f8d509682e5a4da50857a2
    expect(JSON.stringify(ability(B04084, 'a1').effect)).toContain('"viaEffect":true');
    // qa: card:B04088:2c8cffe713bc14b0f21962d80fb72ee56daeec74f21c65a124b1b0c690cbca36
    expect(JSON.stringify(ability(B04088, 'a1').cost)).toContain('"dyn":"$self.oppSceneCount*2"');
    // qa: card:B04088:b066ea50358427fae7daf06a8802e85fa0281e2e711d13677b3a199d8d9ca394
    expect(ability(B04088, 'a1')).toMatchObject({ type: 'declared', cost: { kind: 'pay' } });
    // qa: card:B04089:2fb8c0912dba73c084f3f120f5bc7508357fec3a55b07e9ec00dfc87af7fce4d
    expect(JSON.stringify(ability(B04089, 'a1'))).toContain('"byPlayer":"self"');
    // qa: card:B04090:5f5e9e621be5ae498d457e2af1d6435d394a3e3ebee1d307bd8f8fead7f77442
    expect(ability(B04090, 'a2')).toMatchObject({ trigger: { hook: 'cutin:used', matcherCondition: { kind: 'triggerPlayerIs', side: 'self' } } });
    // qa: card:B04090:7f1ae0bce0cdf8a001d292c56d381d5d2c4c43ff040f867fe277f19c9785402a
    expect(ability(B04090, 'a2').effect).toMatchObject({ then: { kind: 'atom', verb: 'sceneEnter', args: { from: 'remove', viaEffect: true, target: { n: { min: 0, max: 1 } } } } });
    // qa: card:B04090:a0165bfd71fbbe6aac666593165179c74a4b5075f44dbdfc421b58790882153e
    expect(ability(B04090, 'a2').effect).toMatchObject({ then: { args: { target: { query: { filter: { color: '黒', levelMax: 3, kind: 'character' } } } } } });
    // qa: card:B04091:4c46fd7fa4a42a6490a220d032289b21718f5c35f9a380bbe6ea24b4ee5406ba
    expect(JSON.stringify(ability(B04091, 'a1').effect)).toContain('"verb":"discard"');
    // qa: card:B04092:63c33efbf6377c81ab5472eb465f733d7e82d65b430078705f12a46d6ba0d601
    expect(ability(B04092, 'a1')).toMatchObject({ trigger: { hook: 'contact:start' }, effect: { if: { kind: 'charStateIs', state: 'active' } } });
    // qa: card:B04092:65acd5a3820a8bdf77b58c13b11916e953402d3e434d28526d2bda9354897f23
    expect(JSON.stringify(ability(B04092, 'a1').effect)).toContain('"delta":2000');
    // qa: card:B04093:63c33efbf6377c81ab5472eb465f733d7e82d65b430078705f12a46d6ba0d601
    expect(ability(B04093, 'a1')).toMatchObject({ trigger: { hook: 'contact:start' }, effect: { if: { kind: 'charStateIs', state: 'active' } } });
    // qa: card:B04093:65acd5a3820a8bdf77b58c13b11916e953402d3e434d28526d2bda9354897f23
    expect(JSON.stringify(ability(B04093, 'a1').effect)).toContain('"delta":1000');
    // qa: card:B05006:8d9b6001dd16aedc46e85a0c2cc173cf00a4685af7d08cc15c5c375c9b6d7411
    expect(JSON.stringify(ability(B05006, 'a1'))).toContain('"color":"青"');
    // qa: card:B05006:efa9f544acc2cbe68980b4a2bca340cd5b73c7148c75e23a6e91308cea492722
    expect(JSON.stringify(ability(B05006, 'a1').effect)).toContain('"kw":"突撃"');
  });
});
