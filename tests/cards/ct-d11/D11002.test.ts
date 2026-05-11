// tests/cards/ct-d11/D11002
// spec: .claude/specs/cards-analysis/D11001.md (全パートナー共通)

import { describe, it, expect } from 'vitest';
import { D11002 } from '@/cards/ct-d11/D11002';

describe('D11002 横溝重悟 (partner)', () => {
  it('shape: id, kind, names, colors, lp', () => {
    expect(D11002.id).toBe('D11002');
    expect(D11002.no).toBe('P077/D11002');
    expect(D11002.kind).toBe('partner');
    expect(D11002.names).toEqual(['横溝重悟']);
    expect(D11002.colors).toEqual(['黄']);
    expect(D11002.lp).toBe(1);
    expect(D11002.rarity).toBe('D');
  });

  it('abilities は空配列', () => {
    expect(D11002.abilities).toEqual([]);
  });

  it('ruleRefs 非空', () => {
    expect(D11002.ruleRefs.length).toBeGreaterThan(0);
  });
});
