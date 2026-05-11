import { describe, it, expect } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';

describe('produce', () => {
  it('Immer 経由で変更しても元 state 不変', () => {
    const s = createEmptyGameState();
    const next = produce(s, draft => { draft.turn.number = 5; });
    expect(s.turn.number).toBe(0);
    expect(next.turn.number).toBe(5);
  });
});
