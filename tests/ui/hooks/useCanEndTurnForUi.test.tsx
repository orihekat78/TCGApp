import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { useCanEndTurnForUi } from '@/ui/hooks/useActionsPanelFlow';
import { useGameStateStore, type PendingEffectPick } from '@/ui/state/store';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function GateProbe(): JSX.Element {
  const canEnd = useCanEndTurnForUi('self');
  return <output data-testid="end-turn-gate">{canEnd ? 'enabled' : 'blocked'}</output>;
}

describe('useCanEndTurnForUi', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    const state = createEmptyGameState();
    state.turn = { number: 1, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    useGameStateStore.setState({ gameState: state, pendingEffectPick: null });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    useGameStateStore.setState({ gameState: null, pendingEffectPick: null });
  });

  it('共有gateがpendingEffectPickの発生をsubscribeして即時に無効化する', () => {
    act(() => root.render(<GateProbe />));
    expect(container.textContent).toBe('enabled');

    const pending: PendingEffectPick = {
      player: 'self',
      candidates: [{ uid: 'hand:self:X#0', cardId: 'X', player: 'self' }],
      atomVerb: 'discard',
      atomArgs: {},
      nMin: 1,
      nMax: 1,
      source: { cardId: 'X', abilityId: 'a1' },
    };
    act(() => useGameStateStore.setState({ pendingEffectPick: pending }));

    expect(container.textContent).toBe('blocked');
  });
});
