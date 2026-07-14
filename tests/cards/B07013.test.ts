import { describe, expect, it } from 'vitest';
import { B07013 } from '@/cards/ct-p07/B07013';

describe('B07013', () => {
  it('uses the optional Conan branch as the all-three replacement', () => {
    const effect = B07013.abilities[0]?.effect;
    expect(effect).toMatchObject({
      kind: 'choice',
      options: expect.arrayContaining([expect.objectContaining({ kind: 'sequence' })]),
    });
    expect(JSON.stringify(effect)).toContain('"presence":"exists"');
    expect(JSON.stringify(effect).match(/"state":"active"/g)).toHaveLength(1);
  });
});
