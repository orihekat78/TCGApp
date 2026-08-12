import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { Playmat } from '@/ui/components/Playmat';
import { useTargetPickerStore } from '@/ui/hooks/useTargetPicker';
import { useGameStateStore } from '@/ui/state/store';

const captured = vi.hoisted(() => ({
  props: null as null | {
    onActionItemClick: (id: 'hand-use') => void;
    onLogToggle: () => void;
  },
}));

vi.mock('@/ui/components/ActionsPanel', () => ({
  ActionsPanel: (props: NonNullable<typeof captured.props>) => {
    captured.props = props;
    return null;
  },
}));

describe('Playmat terminal callback boundary', () => {
  afterEach(() => {
    captured.props = null;
    useTargetPickerStore.getState()._reset();
    useGameStateStore.getState().resetMatchSessionState();
  });

  it('rejects action and log callbacks retained before the match became terminal', () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const state = createEmptyGameState();
    state.turn = { number: 1, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.hand = ['D08015'];
    useGameStateStore.getState().setGameState(state);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      act(() => root.render(<Playmat
        gameState={state}
        resolveCard={() => ({ name: 'card', color: 'blue', ap: 0, lp: 0, lv: 0 })}
        resolveHandCard={(cardId) => ({
          cardId, name: cardId, color: 'blue', type: 'character', cost: 1, ap: 1, lp: 1, lv: 1,
        })}
      />));
      const retainedAction = captured.props!.onActionItemClick;
      const retainedLog = captured.props!.onLogToggle;
      const terminal = structuredClone(state);
      terminal.gameResult = { winner: 'self', reason: 'evidence' };
      act(() => root.render(<Playmat
        gameState={terminal}
        resolveCard={() => ({ name: 'card', color: 'blue', ap: 0, lp: 0, lv: 0 })}
        resolveHandCard={(cardId) => ({
          cardId, name: cardId, color: 'blue', type: 'character', cost: 1, ap: 1, lp: 1, lv: 1,
        })}
      />));

      act(() => retainedAction('hand-use'));
      act(() => retainedLog());
      expect(container.querySelector('.hand-zone--expanded')).toBeNull();
      expect(container.querySelector('.log-panel')).toBeNull();
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });
});
