import { beforeEach, describe, expect, it } from 'vitest';
import {
  _clearPendingEffectPickQueue,
  _peekPendingEffectPickQueueLength,
  _pushPendingEffectPickSideForTest,
  type PendingEffectPickSide,
} from '@/engine/effect/resolve-picks';
import {
  _drainPendingPublicHandRevealSide,
  queuePendingPublicHandRevealSide,
} from '@/engine/effect/atom-handlers';
import { surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { createEmptyGameState } from '@/engine/state-factory';

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
    _drainPendingPublicHandRevealSide();
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

  it('does not drain a stale decision into a terminal GameState', () => {
    const terminal = createEmptyGameState();
    terminal.gameResult = { winner: 'self', reason: 'evidence' };
    useGameStateStore.setState({ gameState: terminal, pendingEffectPick: null });
    _pushPendingEffectPickSideForTest(pending('self', 'STALE-TERMINAL'));

    surfacePendingSideChannels();

    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(_peekPendingEffectPickQueueLength()).toBe(1);
  });

  it('surfaces only the next completed public-hand presentation after terminal', () => {
    const terminal = createEmptyGameState();
    terminal.gameResult = { winner: 'self', reason: 'evidence' };
    useGameStateStore.setState({ gameState: terminal, pendingPublicHandReveal: null, pendingEffectPick: null });
    queuePendingPublicHandRevealSide({
      owner: 'self', audience: 'all', cardIds: ['VISIBLE'], handSnapshot: ['VISIBLE'],
      lifetime: 'presentation', resolutionToken: 'terminal-presentation', source: {},
    });

    surfacePendingSideChannels();

    expect(useGameStateStore.getState().pendingPublicHandReveal).toMatchObject({
      resolutionToken: 'terminal-presentation', cardIds: ['VISIBLE'],
    });
    expect(_drainPendingPublicHandRevealSide()).toBeNull();
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
  });
});
