import { describe, expect, it } from 'vitest';
import { B04046 } from '@/cards/ct-p04/B04046';
import { B04046P } from '@/cards/ct-p04/B04046P';

describe('B04046 / B04046P', () => {
  it('maps all printed clauses and keeps P mechanics equal', () => {
    expect(B04046.abilities).toHaveLength(3);
    expect(B04046.abilities[0]).toMatchObject({
      type: 'continuous', condition: { kind: 'turn', player: 'self' },
      continuousModifier: { lvlDeltaAuraOpp: -1 },
    });
    expect(B04046.abilities[1].effect).toMatchObject({
      kind: 'sequence', steps: [
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
        { kind: 'atom', verb: 'sceneEnter', args: { from: 'hand', filter: { trait: 'FBI', levelMax: 6, kind: 'character' } } },
      ],
    });
    expect(B04046.abilities[2]).toMatchObject({
      type: 'declared', limit: { kind: 'turn', n: 1 },
      effect: { kind: 'atom', verb: 'charGrantAbility', args: { side: 'self', filter: { trait: 'FBI' }, scope: 'turn' } },
    });

    const mechanics = (card: typeof B04046) => JSON.parse(JSON.stringify({ ...card, id: '', rarity: '', imageUrl: '' }).replaceAll('b04046p_', 'b04046_'));
    expect(mechanics(B04046P)).toEqual(mechanics(B04046));
  });
});
