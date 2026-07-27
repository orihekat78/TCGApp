import { describe, expect, it } from 'vitest';
import { countUnresolvedEffects } from '@/ui/hooks/useTopBar';
import type { GameState } from '@/engine/types/game-state';

describe('countUnresolvedEffects', () => {
  it('excludes resolved and cancelled history from the visible effect-stack count', () => {
    const gameState = {
      pendingEffects: [
        { id: 'resolved', state: 'resolved' },
        { id: 'cancelled', state: 'cancelled' },
        { id: 'pending', state: 'pending' },
      ],
    } as unknown as GameState;

    expect(countUnresolvedEffects(gameState)).toBe(1);
  });
});
