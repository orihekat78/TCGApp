import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEffectPickFlowDriver } from '@/ui/hooks/useEffectPickFlowDriver';
import { useGameStateStore } from '@/ui/state/store';

const { dispatchEngineAction } = vi.hoisted(() => ({ dispatchEngineAction: vi.fn() }));

vi.mock('@/ui/hooks/useEngineDispatch.js', () => ({ dispatchEngineAction }));

function pending(player: 'self' | 'opp') {
  return {
    player,
    candidates: [{ uid: `${player}-candidate`, cardId: 'D08015', player }],
    atomVerb: 'stackedCardPick',
    atomArgs: {},
    nMin: 1,
    nMax: 1,
    source: { cardId: 'B06005', abilityId: 'a2' },
  } as never;
}

function Harness(): null {
  useEffectPickFlowDriver();
  return null;
}

describe('useEffectPickFlowDriver decision ownership', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
    useGameStateStore.setState({
      pendingEffectPick: null,
      pendingDecisionSeq: 0,
      spectatorMode: false,
    });
    dispatchEngineAction.mockReset();
  });

  it('auto-resolves a self-owned pick when spectating', () => {
    act(() => {
      useGameStateStore.setState({ spectatorMode: true });
      useGameStateStore.getState().setPendingEffectPick(pending('self'));
    });
    const root = createRoot(document.createElement('div'));

    act(() => root.render(<Harness />));

    expect(dispatchEngineAction).toHaveBeenCalledWith({
      type: 'effectPickResolve',
      pickedUid: 'self-candidate',
      pickedUids: ['self-candidate'],
      decisionId: 'decision:1',
    });
    act(() => root.unmount());
  });

  it('waits when the actual human owns the opponent-side pick', () => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'opp';
    act(() => useGameStateStore.getState().setPendingEffectPick(pending('opp')));
    const root = createRoot(document.createElement('div'));

    act(() => root.render(<Harness />));

    expect(dispatchEngineAction).not.toHaveBeenCalled();
    act(() => root.unmount());
  });
});
