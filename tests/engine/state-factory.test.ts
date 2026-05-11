import { describe, it, expect } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';

describe('createEmptyGameState', () => {
  it('turn 初期値', () => {
    const s = createEmptyGameState();
    expect(s.turn.number).toBe(0);
    expect(s.players.self.scene).toEqual([]);
    expect(s.pendingEffects).toEqual([]);
    expect(s.scratchTrace.self).toBe('未発見');
    expect(s.players.self.case.requiredEvidence).toBe(7);
    expect(s.players.opp.case.requiredEvidence).toBe(6);
  });
});
