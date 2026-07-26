import { describe, expect, it } from 'vitest';
import { validateCards } from '@/engine/effect';
import { B10081, B10081P } from '@/cards/ct-p10/B10081';
import { B10097, B10097P } from '@/cards/ct-p10/B10097';

describe('CT-P10 B10081/B10097 effective-level cards', () => {
  it('B10081 moves the selected remove card to hand and then removes a character at least that level', () => {
    expect(validateCards([B10081])).toEqual({ ok: true });
    const steps = (B10081.abilities[0].effect as { steps: Array<{ args?: Record<string, unknown>; then?: { args?: Record<string, unknown> } }> }).steps;
    expect(steps[0].args?.bind).toBe('$moved');
    expect(steps[1].then?.args?.filter).toMatchObject({ levelMinBound: { bindKey: '$moved' } });
  });

  it('B10097 uses the post-move hand binding for its level-five discard condition', () => {
    expect(validateCards([B10097])).toEqual({ ok: true });
    const steps = (B10097.abilities[1].effect as { steps: Array<{ then?: { args?: Record<string, unknown> } }> }).steps;
    expect(steps[1].then?.args?.bind).toBe('$added');
    expect(B10097.abilities[1].effect).toMatchObject({ steps: [
      {},
      { then: { args: { bind: '$added' } } },
      {},
      { if: { kind: 'boundMatchesFilter', bindKey: '$added', filter: { levelMin: 5 } } },
    ] });
  });

  it('parallel printings preserve all gameplay fields', () => {
    expect({ ...B10081P, id: B10081.id, no: B10081.no, rarity: B10081.rarity, imageUrl: B10081.imageUrl }).toEqual(B10081);
    expect({ ...B10097P, id: B10097.id, no: B10097.no, rarity: B10097.rarity, imageUrl: B10097.imageUrl }).toEqual(B10097);
  });
});
