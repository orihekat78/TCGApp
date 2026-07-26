import { describe, expect, it } from 'vitest';

import { B10074 } from '@/cards/ct-p10/B10074';

describe('CT-P10 B10074 validation repair', () => {
  it('keeps the entry ability and the printed Hirameki as separate abilities', () => {
    expect(B10074.abilities).toHaveLength(2);
    expect(B10074.abilities[0]).toMatchObject({
      type: 'triggered',
      scope: 'on-scene',
      trigger: { hook: 'enter', selfOnly: true },
    });
    expect(B10074.abilities[1]).toMatchObject({
      type: 'triggered',
      scope: 'on-evidence',
      trigger: { hook: 'evidence:remove-by-action', optional: true },
      effect: {
        kind: 'atom',
        verb: 'sceneSetState',
        args: { player: 'self', max: 1, side: 'either', filter: { kind: 'character' }, state: 'sleep' },
      },
    });
  });
});
