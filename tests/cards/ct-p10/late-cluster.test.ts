import { describe, expect, it } from 'vitest';
import { B10084, B10084P } from '@/cards/ct-p10/B10084';

describe('CT-P10 late cluster', () => {
  it('keeps B10084 and its CP printing on the shared partner-rule path', () => {
    for (const card of [B10084, B10084P]) {
      expect(card).toMatchObject({
        kind: 'partner', names: ['キール'], colors: ['黒'], lp: 1, abilities: [],
      });
    }
    expect(B10084.id).toBe('B10084');
    expect(B10084P.id).toBe('B10084P');
  });
});
