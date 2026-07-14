import { describe, expect, it } from 'vitest';
import { B09047 } from '@/cards/ct-p09/B09047';

describe('B09047', () => {
  it('offers remove reentry or the two-color partner-MR branch after action/reasoning', () => {
    expect(B09047.abilities[0]?.effect).toMatchObject({ kind: 'choice', options: expect.any(Array) });
  });
});
