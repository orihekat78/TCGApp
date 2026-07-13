import { describe, expect, test } from 'vitest';
import { B05086 } from '@/cards/ct-p05/B05086.js';
import { B05086P } from '@/cards/ct-p05/B05086P.js';
import { B07030 } from '@/cards/ct-p07/B07030.js';
import { B07030P } from '@/cards/ct-p07/B07030P.js';
import { B07030P2 } from '@/cards/ct-p07/B07030P2.js';
import { B07061 } from '@/cards/ct-p07/B07061.js';
import { B07061P } from '@/cards/ct-p07/B07061P.js';

const functionalShape = (card: { abilities: unknown; colors: unknown; level?: unknown; ap?: unknown; lp?: unknown; caseLevel?: unknown; traits: unknown; caseTraits?: unknown }) => ({
  abilities: card.abilities,
  colors: card.colors,
  level: card.level,
  ap: card.ap,
  lp: card.lp,
  caseLevel: card.caseLevel,
  traits: card.traits,
  caseTraits: card.caseTraits,
});

describe('twin/P spread wave', () => {
  test('B07030 P printings preserve every functional field', () => {
    expect(B07030P.id).toBe('B07030P');
    expect(B07030P2.id).toBe('B07030P2');
    expect(functionalShape(B07030P)).toEqual(functionalShape(B07030));
    expect(functionalShape(B07030P2)).toEqual(functionalShape(B07030));
  });

  test('B07061P preserves the base case behavior', () => {
    expect(B07061P.id).toBe('B07061P');
    expect(functionalShape(B07061P)).toEqual(functionalShape(B07061));
  });

  test('B05086P preserves the base character behavior', () => {
    expect(B05086P.id).toBe('B05086P');
    expect(functionalShape(B05086P)).toEqual(functionalShape(B05086));
  });
});
