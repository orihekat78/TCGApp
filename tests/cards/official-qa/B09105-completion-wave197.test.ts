// qa: card:B09105:c7ae8a0b8705f2f925f39f99642bb7a79d30f9cf38ac1993b68357ce50dd6d54
// qa: card:B09105:c9d1abbedddbedbfad74851f5da4e68d45940c5dc7b1a674e2aa635443a4df5e
// qa: card:B09105:d8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa
// qa: card:B09105:e8e3445ac6139f21bb8ab2dd70734b6ea03331a372bfd54f70907a129e263392

import { describe, expect, it } from 'vitest';
import { B09105 } from '@/cards/ct-p09/B09105';

describe('official QA Wave197: B09105 event contracts', () => {
  it('stops its optional chain after an already-sleeping partner', () => {
    const effect = B09105.abilities.find(candidate => candidate.id === 'a1')?.effect;
    expect(B09105.abilities.find(candidate => candidate.id === 'a1')?.effect?.kind).toBe('sequence');
    if (effect?.kind !== 'sequence') return;
    const optional = effect.steps[0];
    expect(optional?.kind).toBe('optional');
    if (optional?.kind !== 'optional' || optional.effect.kind !== 'chain') return;
    expect(optional.effect.steps[0]).toMatchObject({
      kind: 'atom', verb: 'partnerSetState', args: { player: 'self', state: 'sleep', requireActive: true },
    });
  });

  it('uses effect entry for the distinct-level culprit deployment', () => {
    expect(B09105.abilities.find(candidate => candidate.id === 'a1')?.effect).toMatchObject({
      kind: 'sequence',
      steps: [{
        kind: 'optional',
        effect: { kind: 'chain', steps: [expect.anything(), expect.anything(), expect.anything(), {
          kind: 'atom', verb: 'sceneEnter', args: {
            player: 'self', from: 'remove', viaEffect: true, cardIds: '$pick.cardIds',
            target: { kind: 'pick', query: { area: 'remove', side: 'self', distinctLevel: true, filter: { kind: 'character', trait: '犯人', levelMax: 8 } }, n: { min: 0, max: 5 }, chooser: 'self' },
          },
        }] },
      }, expect.anything()],
    });
  });

  it('remains an on-hand event-use ability while its next-hint ban is independent', () => {
    expect(B09105.abilities.find(candidate => candidate.id === 'a1')).toMatchObject({
      scope: 'on-hand', trigger: { hook: 'effect:declared', selfOnly: true },
      effect: { kind: 'sequence', steps: [expect.anything(), { kind: 'atom', verb: 'setNextHintBan', args: { player: 'self' } }] },
    });
  });
});
