// tests/cards/ct-d11/D11016
// spec: .claude/specs/cards-analysis/D11016.md

import { describe, it, expect } from 'vitest';
import { D11016 } from '@/cards/ct-d11/D11016';

describe('D11016 大江忍 (相手ターン1 ガード反撃 → アクティブ+AP+2000)', () => {
  it('shape: id, level=3, ap=3000, lp=1, 黄, traits=[]', () => {
    expect(D11016.id).toBe('D11016');
    expect(D11016.no).toBe('0710/D11016');
    expect(D11016.kind).toBe('character');
    expect(D11016.colors).toEqual(['黄']);
    expect(D11016.level).toBe(3);
    expect(D11016.ap).toBe(3000);
    expect(D11016.lp).toBe(1);
    expect(D11016.traits).toEqual([]);
    expect(D11016.abilities.length).toBe(1);
  });

  it('a1 = triggered on action:guarded, condition=opp turn, limit=turn 1', () => {
    const a1 = D11016.abilities[0];
    expect(a1.type).toBe('triggered');
    expect(a1.trigger?.hook).toBe('action:guarded');
    expect(a1.condition).toEqual({ kind: 'turn', player: 'opp' });
    expect(a1.limit).toEqual({ kind: 'turn', n: 1 });
    expect(a1.effect?.kind).toBe('sequence');
  });
});
