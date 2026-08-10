import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { createEmptyGameState } from '@/engine/state-factory';
import {
  _resetPendingHirameki,
  registerHiramekiListener,
} from '@/engine/listeners/hirameki';
import { registerTriggeredListener } from '@/engine/listeners/triggered';
import { useHiramekiFlowDriver } from '@/ui/hooks/useHiramekiFlowDriver';
import { useGameStateStore } from '@/ui/state/store';
import { openCaseHirameki } from '../../helpers/open-case-hirameki';

function Harness(): null {
  useHiramekiFlowDriver();
  return null;
}

describe('useHiramekiFlowDriver real dispatch', () => {
  beforeAll(() => {
    registerAll();
    registerHiramekiListener();
    registerTriggeredListener();
  });

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
    _resetPendingHirameki();
    const state = createEmptyGameState();
    state.players.self.deck = ['D08015'];
    openCaseHirameki(state, 'D08013');
    useGameStateStore.setState({ spectatorMode: true, pendingEffectPick: null });
  });

  it('resolves a spectator-owned Hirameki, clears the decision, and commits its effect', () => {
    const root = createRoot(document.createElement('div'));

    try {
      act(() => root.render(<Harness />));

      const store = useGameStateStore.getState();
      expect(store.pendingHirameki).toBeNull();
      expect(store.gameState?.players.self.hand).toEqual(['D08015']);
      expect(store.gameState?.players.self.deck).toEqual([]);
    } finally {
      act(() => root.unmount());
      useGameStateStore.setState({ gameState: null, pendingHirameki: null, spectatorMode: false });
    }
  });
});
