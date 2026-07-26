// cards-data/ct-d09/character.tsv image mapping regression

import { describe, expect, it } from 'vitest';
import { D09014 } from '@/cards/ct-d09/D09014';

describe('D09014 大和敢助', () => {
  it('uses the authoritative card image filename', () => {
    expect(D09014.imageUrl).toBe('1743742875201036.jpg');
  });
});
