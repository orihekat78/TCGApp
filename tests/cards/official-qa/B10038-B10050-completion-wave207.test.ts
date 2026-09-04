// qa: card:B10038:d563aa18553af7adc1af31a25be244d2fbd7e2298e4b0697c67511ce5953adda
// qa: card:B10038:e5c9caf866b74ff7799f8156af51462da8a870c3280b985b3b0be4c5653d5341
// qa: card:B10042:c460e62e474ee528580056dc5faeb3002a5f90796c5cd3158a864931917970c9
// qa: card:B10050:70e38b793c08ddb3385164aeddf70903780de72c6efc93d6e0d29c9fe66df4d0

import { describe, expect, it } from 'vitest';
import { B10038 } from '@/cards/ct-p10/B10038';
import { B10042 } from '@/cards/ct-p10/B10042';
import { B10050 } from '@/cards/ct-p10/B10050';

describe('official QA Wave207: CT-P10 name, disguise, and required-resolution contracts', () => {
  it('keeps B10038 Kid aliases limited to deck and remove areas', () => {
    expect(B10038).toMatchObject({ names: ['黒羽快斗'] });
    expect(B10038.nameAliasesByArea).toEqual({
      deck: ['怪盗キッド'],
      remove: ['怪盗キッド'],
    });
  });

  it('grants B10038 re-entry only after an effect-based character entry', () => {
    expect(B10038.abilities.find((candidate) => candidate.id === 'a1')).toMatchObject({
      type: 'triggered',
      trigger: { hook: 'enter', selfOnly: true },
      condition: { kind: 'enterSource', viaEffect: true, side: 'self', sourceFilter: { kind: 'character' } },
      effect: {
        kind: 'atom',
        verb: 'charGrantAbility',
        args: {
          uid: '$self',
          scope: 'turn',
          ability: {
            limit: { kind: 'turn', n: 1 },
            condition: { kind: 'removedCharMatches', side: 'opp', cause: 'contact-ap', by: 'self' },
          },
        },
      },
    });
  });

  it('requires the Uisaku bond when B10042 resolves its disguise trigger', () => {
    expect(B10042.abilities.find((candidate) => candidate.id === 'a2')).toMatchObject({
      trigger: { hook: 'disguise:into', selfOnly: true },
      condition: { kind: 'bond', cardName: '工藤優作' },
      effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$self', delta: 2000, scope: 'turn' } },
    });
  });

  it('draws for B10050 after either declining or resolving its optional removal', () => {
    expect(B10050.abilities.find((candidate) => candidate.id === 'a1')).toMatchObject({
      type: 'triggered',
      effect: {
        kind: 'sequence',
        steps: [
          { kind: 'optional', effect: { kind: 'atom', verb: 'sceneRemove', args: { max: 1, filter: { kind: 'character', levelMax: 7 } } } },
          { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
        ],
      },
    });
  });
});
