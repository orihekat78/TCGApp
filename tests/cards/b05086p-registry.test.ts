import { describe, expect, it } from 'vitest';
import { REUSE_CARDS } from '@/cards';

describe('B05086P production registry', () => {
  it('registers the printed P twin', () => {
    expect(REUSE_CARDS.some((card) => card.id === 'B05086P')).toBe(true);
  });
});
