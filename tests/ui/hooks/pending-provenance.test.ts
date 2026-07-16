import { beforeEach, describe, expect, it } from 'vitest';
import {
  _clearPendingEffectPickQueue,
  _peekPendingEffectPickQueueLength,
  _pushPendingEffectPickSideForTest,
  type PendingEffectPickSide,
} from '@/engine/effect/resolve-picks';
import { surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';

function pending(player: 'self' | 'opp', sourceCardId: string): PendingEffectPickSide {
  return {
    player,
    ownerPlayer: player,
    candidates: [{ uid: `${player}-hand#0`, cardId: sourceCardId, player }],
    atomVerb: 'discard',
    atomArgs: { player: 'self', n: 1 },
    nMin: 1,
    nMax: 1,
    source: { cardId: sourceCardId, abilityId: 'a1', uid: `${player}-source` },
  };
}

describe('pending pick provenance/FIFO', () => {
  beforeEach(() => {
    _clearPendingEffectPickQueue();
    useGameStateStore.setState({ pendingEffectPick: null });
  });

  it('表示中のhuman pendingを新しいopp pendingで上書きせずqueue順を保持する', () => {
    const staleHuman = pending('self', 'HUMAN-OLD');
    const newOpp = pending('opp', 'CPU-NEW');
    useGameStateStore.setState({ pendingEffectPick: staleHuman });
    _pushPendingEffectPickSideForTest(newOpp);

    surfacePendingSideChannels();

    expect(useGameStateStore.getState().pendingEffectPick).toBe(staleHuman);
    expect(_peekPendingEffectPickQueueLength()).toBe(1);
  });
});
