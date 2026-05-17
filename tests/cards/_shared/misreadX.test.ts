// Phase 8 完全クローズ Commit 3b: misreadX shared class tests
//
// rules: 13-keywords.md §ミスリード
// spec: 計画 — Commit 3b

import { describe, it, expect } from 'vitest';
import { misreadX } from '@/cards/_shared/misreadX';

describe('misreadX shared class', () => {
  it('returns AbilityDef with type=icon-misread and args.x', () => {
    const ability = misreadX({ x: 2000 });
    expect(ability.type).toBe('icon-misread');
    expect(ability.scope).toBe('on-scene');
    expect(ability.id).toBe('a_misread');
    expect(ability.description).toContain('2000');
    // effect.args.x が listener に渡る重要 metadata
    const args = (ability.effect as { args?: { x?: number } } | undefined)?.args;
    expect(args?.x).toBe(2000);
  });

  it('respects custom abilityId', () => {
    const ability = misreadX({ x: 1000, abilityId: 'a3' });
    expect(ability.id).toBe('a3');
  });
});
