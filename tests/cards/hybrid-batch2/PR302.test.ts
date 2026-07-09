// hybrid-batch2 probe — PR302 TVアニメ「名探偵コナン」放送30周年！ (case / 青 / vanilla)
// T0 (vanilla case、能力なし)。probe = shape pin のみ (crosscheck が印字テキスト⇔DSL を担保)。
// rules: rules/15-abilities-effects.md
import { describe, it, expect } from 'vitest';
import { PR302 } from '@/cards/pr-01/PR302';

describe('PR302 — vanilla case shape', () => {
  it('kind=case / 青 / 能力 0 件 (vanilla)', () => {
    expect(PR302.id).toBe('PR302');
    expect(PR302.kind).toBe('case');
    expect(PR302.colors).toEqual(['青']);
    expect(PR302.abilities).toHaveLength(0);
    expect(PR302.caseTraits).toEqual([]);
  });
});
