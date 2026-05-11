// rules: 13-keywords.md, 26-qa-deck-refresh.md (一度発見済になるとずっと維持)
import { describe, it, expect } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { scratchTraceMonotonic } from '@/engine/invariant/scratchTraceMonotonic';

describe('engine.invariant.scratchTraceMonotonic', () => {
  it('未発見→未発見は OK', () => {
    const s = createEmptyGameState();
    s.scratchTrace.self = '未発見';
    expect(() => scratchTraceMonotonic(s, 'self', '未発見')).not.toThrow();
  });

  it('未発見→発見済は OK (rules/13)', () => {
    const s = createEmptyGameState();
    s.scratchTrace.self = '発見済';
    expect(() => scratchTraceMonotonic(s, 'self', '未発見')).not.toThrow();
  });

  it('発見済→発見済は OK', () => {
    const s = createEmptyGameState();
    s.scratchTrace.self = '発見済';
    expect(() => scratchTraceMonotonic(s, 'self', '発見済')).not.toThrow();
  });

  it('発見済→未発見は throw (rules/13 一方通行)', () => {
    const s = createEmptyGameState();
    s.scratchTrace.self = '未発見';
    expect(() => scratchTraceMonotonic(s, 'self', '発見済')).toThrow(/scratchTraceMonotonic/);
  });

  it('opp も確認できる', () => {
    const s = createEmptyGameState();
    s.scratchTrace.opp = '未発見';
    expect(() => scratchTraceMonotonic(s, 'opp', '発見済')).toThrow(/scratchTraceMonotonic/);
  });
});
