// Phase 8.10i: refresh が state.log にエントリを残すことを保証
// rules: 14-refresh.md

import { describe, it, expect } from 'vitest';
import { produce } from '@/engine/produce';
import { deck } from '@/engine/mutate/deck';
import { createEmptyGameState } from '@/engine/state-factory';

describe('mutate.deck.refresh — log entry', () => {
  it('appends one log entry with action="refresh" on successful refresh', () => {
    const before = produce(createEmptyGameState(), (d) => {
      d.players.self.remove = ['x1', 'x2', 'x3'];
      d.players.self.deck = [];
      d.turn.number = 5;
    });

    const after = produce(before, (d) => {
      deck.refresh(d, 'self');
    });

    const refreshLogs = after.log.filter((e) => e.action === 'refresh');
    expect(refreshLogs).toHaveLength(1);
    expect(refreshLogs[0]?.player).toBe('self');
    expect(refreshLogs[0]?.turn).toBe(5);
    expect(refreshLogs[0]?.result).toBe('3');
  });

  it('does NOT append log entry when refresh fails (remove empty)', () => {
    const before = produce(createEmptyGameState(), (d) => {
      d.players.self.remove = [];
      d.players.self.deck = [];
    });

    const after = produce(before, (d) => {
      const r = deck.refresh(d, 'self');
      expect(r.ok).toBe(false);
    });

    const refreshLogs = after.log.filter((e) => e.action === 'refresh');
    expect(refreshLogs).toHaveLength(0);
  });
});
