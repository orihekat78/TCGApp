// tests/cards/ct-d08/D08002
// spec: .claude/specs/cards-analysis/D08001.md (全パートナー共通)

import { describe, it, expect } from 'vitest';
import { D08002 } from '@/cards/ct-d08/D08002';

describe('D08002 哀 歩美 光彦 元太 (partner)', () => {
  it('shape: id, kind, names, colors, lp', () => {
    expect(D08002.id).toBe('D08002');
    expect(D08002.no).toBe('P041/D08002');
    expect(D08002.kind).toBe('partner');
    expect(D08002.names).toEqual(['哀 歩美 光彦 元太']);
    expect(D08002.colors).toEqual(['青']);
    expect(D08002.lp).toBe(1);
    expect(D08002.rarity).toBe('D');
  });

  it('abilities は空配列 (全パートナー共通能力 engine 内蔵)', () => {
    expect(D08002.abilities).toEqual([]);
  });

  it('ruleRefs 非空', () => {
    expect(D08002.ruleRefs.length).toBeGreaterThan(0);
  });
});
