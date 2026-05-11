// rules: 01-victory-conditions.md (解決編→事件編は不可)
import { describe, it, expect } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { caseMonotonic } from '@/engine/invariant/caseMonotonic';

describe('engine.invariant.caseMonotonic', () => {
  it('事件編→事件編は OK', () => {
    const s = createEmptyGameState();
    s.players.self.case.status = '事件編';
    expect(() => caseMonotonic(s, 'self', '事件編')).not.toThrow();
  });

  it('事件編→解決編は OK', () => {
    const s = createEmptyGameState();
    s.players.self.case.status = '解決編';
    expect(() => caseMonotonic(s, 'self', '事件編')).not.toThrow();
  });

  it('解決編→解決編は OK', () => {
    const s = createEmptyGameState();
    s.players.self.case.status = '解決編';
    expect(() => caseMonotonic(s, 'self', '解決編')).not.toThrow();
  });

  it('解決編→事件編は throw (rules/01 一方通行)', () => {
    const s = createEmptyGameState();
    s.players.self.case.status = '事件編';
    expect(() => caseMonotonic(s, 'self', '解決編')).toThrow(/caseMonotonic/);
  });

  it('opp も確認できる', () => {
    const s = createEmptyGameState();
    s.players.opp.case.status = '事件編';
    expect(() => caseMonotonic(s, 'opp', '解決編')).toThrow(/caseMonotonic/);
  });
});
