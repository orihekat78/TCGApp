import { describe, expect, it } from 'vitest';

import { B10086, B10086P } from '@/cards/ct-p10/B10086';

describe('CT-P10 late lane', () => {
  it.each([B10086, B10086P])('$id: スコッチの印字された3能力を保持する', (card) => {
    expect(card.keywords).toEqual(['突撃']);
    expect(card.abilities).toHaveLength(2);

    const [contactAbility, cutin] = card.abilities;
    expect(contactAbility).toMatchObject({
      type: 'triggered',
      scope: 'on-scene',
      limit: { kind: 'turn', n: 1 },
      condition: { kind: 'and' },
      trigger: { hook: 'cutin:used' },
    });
    expect(contactAbility.effect).toMatchObject({ kind: 'chain' });
    expect(cutin).toMatchObject({
      type: 'triggered',
      scope: 'on-hand',
      condition: { kind: 'turn', player: 'self' },
      trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
    });
  });
});
