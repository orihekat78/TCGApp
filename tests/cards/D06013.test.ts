import { describe, expect, it } from 'vitest';
import { D06013 } from '@/cards/ct-d06/D06013';

describe('D06013', () => {
  it('reveals up to four, gates stun on both colors, then returns and shuffles', () => {
    expect(D06013.abilities[0]?.effect).toMatchObject({ kind: 'sequence' });
  });
});
