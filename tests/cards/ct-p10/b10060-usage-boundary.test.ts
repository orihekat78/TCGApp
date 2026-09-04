import { beforeEach, describe, expect, it } from 'vitest';
import { B10060 } from '@/cards/ct-p10/B10060';
import { canHandUseCard } from '@/engine/flow/main/hand-use-card';
import { register, _resetRegistry } from '@/engine/read/def';
import { createMainGameState as createEmptyGameState } from '../../helpers/main-game-state';

describe('CT-P10 B10060 hand-use level boundary', () => {
  beforeEach(() => {
    _resetRegistry();
    register(B10060);
  });

  it('requires FILE 7 for the printed level-7 event', () => {
    const state = createEmptyGameState();
    state.players.self.hand = ['B10060'];
    state.players.self.case.colors = ['赤'];
    state.players.self.file = Array.from(
      { length: 6 },
      () => ({ type: 'card-back' as const }),
    );

    expect(canHandUseCard(state, 'self', 'B10060')).toBe(false);
    state.players.self.file.push({ type: 'card-back' });
    expect(canHandUseCard(state, 'self', 'B10060')).toBe(true);
  });
});
