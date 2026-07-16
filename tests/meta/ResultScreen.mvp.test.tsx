import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createEmptyGameState } from '@/engine/state-factory';
import type { SceneCharacter } from '@/engine/types/game-state';
import { useGameStateStore } from '@/ui/state/store';
import { ResultScreen } from '../../meta-app/src/screens/ResultScreen';

function sceneCard(cardId: string, uid: string): SceneCharacter {
  return {
    cardId,
    uid,
    state: 'active',
    isNamed: false,
    enterOrder: 1,
    setCards: [],
    stackedCards: 0,
    keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null,
    lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false },
    declaredUseCount: {},
  };
}

describe('ResultScreen MVP', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    useGameStateStore.setState({ gameState: null });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function renderResult(): string {
    act(() => {
      root.render(
        <ResultScreen
          onNav={() => undefined}
          onNext={() => undefined}
          onRematch={() => undefined}
        />,
      );
    });
    return container.innerHTML;
  }

  it('selects the highest-AP character from the actual winning side', () => {
    const state = createEmptyGameState();
    state.gameResult = { winner: 'opp', reason: 'evidence' };
    state.players.self.scene = [sceneCard('D08003', 'self-1')];
    state.players.opp.scene = [
      sceneCard('D11012', 'opp-1'),
      sceneCard('D11013', 'opp-2'),
    ];
    useGameStateStore.setState({ gameState: state });

    const html = renderResult();

    expect(html).toContain('D11012');
    expect(html).not.toContain('D08003');
  });

  it('renders a neutral no-MVP state when the winner has no resolvable scene card', () => {
    const state = createEmptyGameState();
    state.gameResult = { winner: 'opp', reason: 'evidence' };
    state.players.self.scene = [sceneCard('D08003', 'self-1')];
    state.players.opp.scene = [sceneCard('UNKNOWN-CARD', 'opp-1')];
    useGameStateStore.setState({ gameState: state });

    const html = renderResult();

    expect(html).toContain('MVPなし');
    expect(html).not.toContain('D08003');
  });

  it('selects a winner character that appeared in the log and later left the final scene', () => {
    const state = createEmptyGameState();
    state.gameResult = { winner: 'self', reason: 'evidence' };
    state.players.self.remove = ['D11012'];
    state.log.push({
      ts: 1,
      player: 'self',
      turn: 2,
      action: 'handUseCard',
      target: 'D11012',
    });
    useGameStateStore.setState({ gameState: state });

    const html = renderResult();

    expect(html).toContain('D11012');
    expect(html).not.toContain('MVPなし');
  });

  it('does not select a logged card absent from every winner-side zone', () => {
    const state = createEmptyGameState();
    state.gameResult = { winner: 'opp', reason: 'evidence' };
    state.players.self.deck = ['D11012'];
    state.log.push({
      ts: 1,
      player: 'opp',
      turn: 2,
      action: 'handUseCard',
      target: 'D11012',
    });
    useGameStateStore.setState({ gameState: state });

    const html = renderResult();

    expect(html).toContain('MVPなし');
    expect(html).not.toContain('D11012');
  });

  it('mirrors final-scene MVP selection for a self winner', () => {
    const state = createEmptyGameState();
    state.gameResult = { winner: 'self', reason: 'evidence' };
    state.players.self.scene = [sceneCard('D11012', 'self-1')];
    state.players.opp.scene = [sceneCard('D08003', 'opp-1')];
    useGameStateStore.setState({ gameState: state });

    const html = renderResult();

    expect(html).toContain('D11012');
    expect(html).not.toContain('D08003');
  });
});
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });
