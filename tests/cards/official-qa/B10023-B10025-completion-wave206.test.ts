// qa: card:B10023:4785304193e3d6050fab9e20bbeb9ff17ea702ee22abfe3cfd5cce4db0ff3238
// qa: card:B10023:7124f41d3267d0e2df2692070acfdd9e66fca11edbbbfb6b64ada8bee4c94b79
// qa: card:B10024:e9d4a9a28f9f02d72ddfd54907e7b28df76f61520a2cf8d6002b072dd8cff2f9
// qa: card:B10025:126440a108af3a02e2f2bf52d8a4da7e8a5e14dcdd0705f889a383985a1e20a1

import { describe, expect, it } from 'vitest';
import { B10023 } from '@/cards/ct-p10/B10023';
import { B10024 } from '@/cards/ct-p10/B10024';
import { B10025 } from '@/cards/ct-p10/B10025';

describe('official QA Wave206: CT-P10 entry, reveal, and turn-limit contracts', () => {
  it('allows B10023 declared cost to remove two face-down cards across scene hosts', () => {
    const cost = B10023.abilities.find((candidate) => candidate.id === 'a2')!.cost!;

    expect(cost).toMatchObject({ kind: 'removeSetCard', n: 2 });
    expect(cost).not.toHaveProperty('hostQuery');
  });

  it('allows B10023 to effect-enter the discarded eligible Police character from remove', () => {
    expect(B10023.abilities.find((candidate) => candidate.id === 'a1')).toMatchObject({
      type: 'triggered',
      trigger: { hook: 'enter', selfOnly: true },
      effect: {
        kind: 'conditional',
        then: {
          kind: 'optional',
          effect: {
            kind: 'chain',
            steps: [
              { kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'sleep' } },
              { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
              { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', from: 'remove', viaEffect: true, max: 1, filter: { kind: 'character', color: '緑', trait: '警察', levelMax: 6 } } },
            ],
          },
        },
      },
    });
  });

  it('keeps B10024 Police reveal public only for the resolving effect', () => {
    const ability = B10024.abilities.find((candidate) => candidate.id === 'a1')!;
    const [reveal] = (ability.effect as { kind: string; steps: unknown[] }).steps;

    expect(ability).toMatchObject({ type: 'triggered', effect: { kind: 'chain' } });
    expect(reveal).toMatchObject({
      kind: 'atom',
      verb: 'handReveal',
      args: { player: 'self', audience: 'all', lifetime: 'effect', max: 1, filter: { kind: 'character', trait: '警察' } },
    });
  });

  it('consumes B10025 turn-1 even when its optional sleep target is skipped', () => {
    expect(B10025.abilities.find((candidate) => candidate.id === 'a3')).toMatchObject({
      type: 'triggered',
      limit: { kind: 'turn', n: 1 },
      effect: {
        kind: 'atom',
        verb: 'sceneSetState',
        args: {
          state: 'sleep',
          target: { kind: 'pick', n: { min: 0, max: 1 } },
        },
      },
    });
  });
});
