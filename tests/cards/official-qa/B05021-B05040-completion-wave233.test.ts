import { describe, expect, it } from 'vitest';
import type { CardDef } from '@/engine/types';
import { B05021 } from '@/cards/ct-p05/B05021';
import { B05022 } from '@/cards/ct-p05/B05022';
import { B05027 } from '@/cards/ct-p05/B05027';
import { B05028 } from '@/cards/ct-p05/B05028';
import { B05032 } from '@/cards/ct-p05/B05032';
import { B05033 } from '@/cards/ct-p05/B05033';
import { B05035 } from '@/cards/ct-p05/B05035';
import { B05037 } from '@/cards/ct-p05/B05037';
import { B05039 } from '@/cards/ct-p05/B05039';
import { B05040 } from '@/cards/ct-p05/B05040';

function ability(card: CardDef, id: string) {
  const found = card.abilities.find((entry) => entry.id === id);
  expect(found, `${card.id}.${id}`).toBeDefined();
  return found!;
}

describe('official QA Wave233: CT-P05 certification links', () => {
  it('pins the selected Wave233 contracts', () => {
    // qa: card:B05021:89b522ce835a37dac9fee81250f2c1a6717f0d0089accd61b9836d60071f3535
    // qa: card:B05021:d810fb7cd9be7306e60cb17c4b25893c474d7acb2bc7e226916ed97721cdb5e4
    // qa: card:B05021:f17c0d50e0e45a97cb037115b5ee66af04dfb4287d6827cd79a1320dfd4649aa
    expect(JSON.stringify(ability(B05021, 'a1').effect)).toContain('"cardName":"毛利小五郎"');
    // qa: card:B05022:05863fa35054fd302da46dd33e377bfdcf15c8eb2fd6e3ba5d2ec04f14008de8
    // qa: card:B05022:d51a411135bc5022a0407a48c33083b0458e30245aa7d23be0e4f498f050c9b2
    expect(ability(B05022, 'a1').effect).toMatchObject({ kind: 'sequence', steps: [{ kind: 'atom', verb: 'bindPick', args: { side: 'opp', max: 5 } }, { kind: 'forEach', do: { kind: 'atom', verb: 'charOverrideAP', args: { val: 0, scope: 'turn' } } }] });
    // qa: card:B05027:81bf0a34b9565c11671cea04d1284643649178004f3813011d7f0f60163e5ed0
    expect(ability(B05027, 'a2')).toMatchObject({ scope: 'on-partner-area', trigger: { hook: 'enter', matcherCondition: { kind: 'triggerCharMatches', side: 'self', filter: { cardName: ['服部平次', '遠山和葉'] } } } });
    // qa: card:B05028:5e818c2539179187de0b4c3347dd7c7d4edb8e1892e10cac08119a69b2047579
    // qa: card:B05028:dcca4a14c96528cd8f1bb61876ceaced35e1c4399840384226b61a0dbb209a0c
    expect(JSON.stringify(ability(B05028, 'a2').effect)).toContain('"faceUp":false');
    // qa: card:B05032:0f058da851b97ca7040483888e03f1ef3561aecdb6a5c3cd6ecb25ecb5bb551b
    // qa: card:B05032:d6abc4befbfcdf9f0ab6de49b222a1c7fb7ea4d96752af2c8c03d2d8801b1b4e
    expect(JSON.stringify(B05032.abilities)).toContain('"hook":"leave:to-remove"');
    // qa: card:B05033:745a9086e75cfeba612d1c7a9514e1c36f8edad401f1ff6d86f3762ba969a691
    // qa: card:B05033:bc41e88e40a99d4267884056bfbc485505430ea4a149660d44cf240924fba73e
    // qa: card:B05033:f9b0e80b4f0475d5eb3295b4602a015b0dfadbe83bfabd56dd47bcc8ff6eec8f
    expect(ability(B05033, 'a1')).toMatchObject({ type: 'continuous', scope: 'on-scene', continuousModifier: { alternativeCostProvider: { targetFilter: { kind: 'character', trait: '探偵' } } } });
    // qa: card:B05035:54f125e07235a27465d7d431dc4ef5947a9551a038b6f2012d0af5dc1a5594ec
    expect(JSON.stringify(ability(B05035, 'a1').effect)).toContain('"faceUp":false');
    // qa: card:B05037:8f24799e5eca568ffe84583d70e6b49a3ed1a650be4e5a2c8be86e3038e436ff
    expect(ability(B05037, 'a1').cost).toMatchObject({ kind: 'pay', items: [{ kind: 'sleepSelf' }, { kind: 'fileFrom', n: 1 }] });
    // qa: card:B05039:02302fc0994ea1eebd94ba851a2e38a51fa3e6dc54324f9029105bc44473bef0
    // qa: card:B05039:49cb99eef7ed216b0e2881df24d6c92f2707461f9db4c72407dbe6d21c709b17
    // qa: card:B05039:5fa35fa54516eb74ecc9e519984989145dbe91b8377579347e47453f96099722
    expect(ability(B05039, 'a2').effect).toMatchObject({ kind: 'conditional', if: { kind: 'turn', player: 'self' }, then: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' } }, { kind: 'conditional', if: { kind: 'contactCharMatches', who: 'byUid', filter: { trait: ['探偵'] } }, then: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } } }] } });
    // qa: card:B05040:e4a36acb6bbbb1c8b11eac5e65600d839bba033d5a2b7f0e5ecfc84bacd47a4c
    expect(ability(B05040, 'a1')).toMatchObject({ condition: { kind: 'turn', player: 'self' } });
  });
});
