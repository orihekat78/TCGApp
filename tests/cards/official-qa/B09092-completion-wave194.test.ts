// qa: card:B09092:0a7b79351a135f0b5277f183d8028ddc88073d99a54bf083bff74d1b3c1a1358
// qa: card:B09092:61f7cb6171a13e222c9bca6a09d3cca6e453562364041127705fd3a83111d391
// Rules: 10, 13, 14, 15, 17.

import { describe, expect, it } from 'vitest';
import { B09092 } from '@/cards/ct-p09/B09092';

describe('official QA Wave194: B09092 option and Hirameki contracts', () => {
  it('keeps both end-turn choices selectable; each condition alone determines its no-op', () => {
    const effect = B09092.abilities[0]?.effect;
    expect(effect).toMatchObject({
      kind: 'choice',
      chooser: 'self',
      options: [
        { kind: 'conditional', if: { kind: 'scratchTrace', player: 'self', v: '発見済' } },
        { kind: 'conditional', if: { kind: 'scratchTrace', player: 'self', v: '未発見' } },
      ],
    });
  });

  it('keeps the evidence Hirameki optional before its opponent deck mill', () => {
    expect(B09092.abilities[2]).toMatchObject({
      trigger: { hook: 'evidence:remove-by-action', optional: true },
      effect: { kind: 'atom', verb: 'mill', args: { player: 'opp', n: 4 } },
    });
  });
});
