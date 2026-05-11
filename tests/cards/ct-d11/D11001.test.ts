// tests/cards/ct-d11/D11001
// spec: .claude/specs/cards-analysis/D11001.md

import { describe, it, expect } from 'vitest';
import { D11001 } from '@/cards/ct-d11/D11001';

describe('D11001 萩原千速 (partner)', () => {
  it('shape: id, kind, names, colors, lp', () => {
    expect(D11001.id).toBe('D11001');
    expect(D11001.no).toBe('P076/D11001');
    expect(D11001.kind).toBe('partner');
    expect(D11001.names).toEqual(['萩原千速']);
    expect(D11001.colors).toEqual(['黄']);
    expect(D11001.lp).toBe(1);
    expect(D11001.rarity).toBe('D');
  });

  it('abilities は空配列 (全パートナー共通能力 engine 内蔵)', () => {
    expect(D11001.abilities).toEqual([]);
  });

  it('ruleRefs 非空', () => {
    expect(D11001.ruleRefs.length).toBeGreaterThan(0);
  });
});
