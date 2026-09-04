import { describe, expect, it } from 'vitest';
import { D02008 } from '@/cards/ct-d02/D02008';
import { D02013 } from '@/cards/ct-d02/D02013';
import { D03002 } from '@/cards/ct-d03/D03002';
import { D03011 } from '@/cards/ct-d03/D03011';
import { D04005 } from '@/cards/ct-d04/D04005';
import { D04007 } from '@/cards/ct-d04/D04007';
import { D05006 } from '@/cards/ct-d05/D05006';
import { D06003 } from '@/cards/ct-d06/D06003';
import { D06004 } from '@/cards/ct-d06/D06004';
import { D06005 } from '@/cards/ct-d06/D06005';
import { D06006 } from '@/cards/ct-d06/D06006';
import { D06009 } from '@/cards/ct-d06/D06009';
import { D06012 } from '@/cards/ct-d06/D06012';

function ability(card: { abilities: readonly { id: string }[] }, id: string) {
  const found = card.abilities.find((entry) => entry.id === id);
  expect(found, `${card.id}.${id}`).toBeDefined();
  return found!;
}

describe('official QA Wave242: CT-D02 through CT-D06 certification links', () => {
  it('pins the selected Wave242 contracts', () => {
    // qa: card:D02008:a0d3e0f0f9fd45773df6277c36cc61a0547e6a9d6d65f053af130390e77e9dbd
    expect(ability(D02008, 'a1')).toMatchObject({ trigger: { hook: 'action:declare', selfOnly: true }, effect: { kind: 'atom', verb: 'charSetTurnEffect', args: { uid: '$self', key: 'cutinBanOpp_action', val: true } } });
    // qa: card:D02013:6ed7fb4878a594ec4f9c792b4c397f1b45d3002fe8332abb0844397edb79da4a
    expect(ability(D02013, 'a1')).toMatchObject({ type: 'declared', condition: { kind: 'sceneHas', query: { side: 'opp', state: ['sleep', 'stun'] }, nMin: 2 }, cost: { kind: 'removeFromHand' }, effect: { kind: 'choice', chooser: 'self' } });
    // qa: card:D03002:f411327f3c4736453cfecf12fbbff6ec8e038e8439f21efc99001a2064266eaa
    expect(ability(D03002, 'a1')).toMatchObject({ condition: { kind: 'partnerColor', color: '白' }, trigger: { hook: 'enter', selfOnly: true }, effect: { kind: 'chain' } });
    // qa: card:D03011:1dea0a6c88a5b70ffd336626e495de1caefb3d893aacf4eaee293bf0bc06a71f
    expect(ability(D03011, 'a1')).toMatchObject({ trigger: { hook: 'phase:end:start' }, condition: { kind: 'turn', player: 'self' }, effect: { kind: 'chain' } });
    // qa: card:D04005:bd93a4215da265963e49dcb37160f02177a597ae13cbdfeb957995ec02c1b9de
    expect(ability(D04005, 'a1')).toMatchObject({ trigger: { hook: 'action:declare' }, effect: { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃', scope: 'turn' } } });
    // qa: card:D04007:e4f3057a9481c59c24970bd355024c6ba9a4bfd774f77af403718b5b9fac9421
    expect(ability(D04007, 'a2')).toMatchObject({ limit: { kind: 'turn', n: 1 }, trigger: { hook: 'evidence:gain' }, effect: { kind: 'optional' } });
    // qa: card:D05006:d80f04fd9ed2fa2cc2d120f6086e1121f6342b9135da0bfe0abfeb59a2967713
    // qa: card:D05006:f2b633a6ffd5ee6f7d275173234a6e82640e084b59e60cfe1c0670c81a936ce2
    expect(ability(D05006, 'a1')).toMatchObject({ trigger: { hook: 'enter', selfOnly: true }, effect: { kind: 'optional' } });
    // qa: card:D06003:9ea9e951976b7b481f3538dfa2c67472c03f2d3d0c695ea8b025b8d9c4fb5051
    expect(ability(D06003, 'a2')).toMatchObject({ trigger: { hook: 'action:declare', selfOnly: true }, limit: { kind: 'turn', n: 1 }, effect: { kind: 'atom', verb: 'handAddFromRemove', args: { max: 1, filter: { cutinTextIncludes: 'AP＋' } } } });
    // qa: card:D06004:9ea9e951976b7b481f3538dfa2c67472c03f2d3d0c695ea8b025b8d9c4fb5051
    expect(ability(D06004, 'a2')).toMatchObject({ trigger: { hook: 'action:declare', selfOnly: true }, limit: { kind: 'turn', n: 1 }, effect: { kind: 'atom', verb: 'handAddFromRemove', args: { max: 1, filter: { cutinTextIncludes: 'AP＋' } } } });
    // qa: card:D06005:d46653f9ce3c4a4116e8e275baa71f6ee044521d741ce0be6481e57a25c61304
    expect(ability(D06005, 'a1')).toMatchObject({ trigger: { hook: 'action:declare', selfOnly: true }, limit: { kind: 'turn', n: 1 }, effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$self', delta: 1000, scope: 'turn' } } });
    // qa: card:D06006:9a924c2361fd57be0465117515cc95264f49e8a2829d02021c45d52a10e07ddc
    expect(ability(D06006, 'a1')).toMatchObject({ trigger: { hook: 'enter', selfOnly: true }, effect: { kind: 'conditional', if: { kind: 'sceneHas', query: { side: 'self', filter: { color: '白' } }, nMin: 1 }, then: { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃', scope: 'turn' } } } });
    // qa: card:D06006:bd183abb316a8e188155130b9c93ba845c1e7ce433065008a71df0f5791774e0
    // qa: card:D06006:ebb2b216aa47abd1ae204ada71556a33dcd60a3620bdaadad9ed9c2bd245c766
    expect(ability(D06006, 'a1')).toMatchObject({ trigger: { hook: 'enter', selfOnly: true }, effect: { kind: 'conditional', then: { kind: 'atom', verb: 'charGrantKeyword', args: { scope: 'turn' } } } });
    // qa: card:D06009:e51b08ef629b4a7be3566afd8fe1612278aab796d4c52d9641c03fa155be073c
    expect(ability(D06009, 'a1')).toMatchObject({ trigger: { hook: 'leave:to-remove', selfOnly: true, matcherCondition: { kind: 'removedCharMatches', cause: 'contact-ap' } }, effect: { kind: 'atom', verb: 'sceneSetState', args: { state: 'sleep', max: 1, side: 'either' } } });
    // qa: card:D06012:08a6f03e83445d03761efcb498cbdda2da7faa1112e75e648503e3492fa1d41b
    expect(ability(D06012, 'a1')).toMatchObject({ type: 'icon-disguise', condition: { kind: 'and', cs: [{ kind: 'caseColor', color: '白' }, { kind: 'fileAtLeast', n: 5 }] } });
    // qa: card:D06012:25661aa5514a785e941eda72ef4593c2dd75b741d82b3f7efd4b4c1c83373dae
    // qa: card:D06012:af2e6ed023a8c1b3a655ec0717ea39fff9f6f2e41f4c0e68a8d1e839016ab941
    expect(ability(D06012, 'a2')).toMatchObject({ scope: 'on-evidence', trigger: { hook: 'evidence:remove-by-action', optional: true }, effect: { kind: 'atom', verb: 'sceneSetState', args: { uid: '$pick', state: 'sleep' } } });
  });
});
