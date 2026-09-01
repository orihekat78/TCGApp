// qa: card:B09106:b7713abe7876ef1ad566c125fa172a4f2a13b192f2b22a4a2cea136020526dac
// qa: card:B09106:c54b5549bd11a1622d7ffa672c7f30ab5fc40d02abb96c921f5e3a24acc3acdd
// qa: card:B09106:ef2849caee7180cda9c275655743b8c0f8ccc524228510f100ce9dd045396741
// qa: card:B09107:4f848afcdc0e788f64c05c38b92bfb367407f6be7f9fc578ced2a8b5c406a824

import { describe, expect, it } from 'vitest';
import { B09106 } from '@/cards/ct-p09/B09106';
import { B09107 } from '@/cards/ct-p09/B09107';

describe('official QA Wave198: CT-P09 effect contracts', () => {
  it('keeps B09106 zero-pick paths optional and its unseen-trace mill mandatory', () => {
    expect(B09106.abilities.find(candidate => candidate.id === 'a1')?.effect).toMatchObject({
      kind: 'sequence',
      steps: [
        { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { levelMax: 7 } } },
        { kind: 'conditional', if: { kind: 'scratchTrace', player: 'self', v: '発見済' }, then: { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', from: 'remove', max: 1, viaEffect: true, filter: { color: ['赤', '黒'], levelMax: 4, kind: 'character' } } } },
        { kind: 'conditional', if: { kind: 'scratchTrace', player: 'self', v: '未発見' }, then: { kind: 'atom', verb: 'mill', args: { player: 'opp', n: 3 } } },
      ],
    });
  });

  it('counts only culprit evidence for B09107 alternate defeat', () => {
    expect(B09107.abilities.find(candidate => candidate.id === 'a2')?.effect).toMatchObject({
      kind: 'sequence', steps: [expect.anything(), {
        kind: 'conditional', if: { kind: 'evidenceTraitAtLeast', player: 'self', trait: '犯人', n: 8 },
        then: { kind: 'atom', verb: 'opponentLoses', args: { player: 'self' } },
      }],
    });
  });
});
