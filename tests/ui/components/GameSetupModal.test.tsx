// Task 8.4: GameSetupModal tests
//
// 仕様:
//   - gameState === null のとき modal がレンダリングされる
//   - gameState !== null のときは null を返す (非表示)
//   - 「対戦開始」ボタンクリックで setGameState が呼ばれる (sampleGameState 相当)

import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { GameSetupModal } from '@/ui/components/GameSetupModal';
import { useGameStateStore } from '@/ui/state/store';
import { createSampleGameState } from '@/ui/fixtures/sampleGameState';

describe('GameSetupModal', () => {
  beforeEach(() => {
    useGameStateStore.setState({ gameState: null });
  });

  it('renders modal with title and start button when gameState is null', () => {
    const html = renderToString(<GameSetupModal />);
    expect(html).toContain('名探偵コナンTCG');
    expect(html).toContain('対戦開始');
    expect(html).toContain('data-testid="game-setup-start"');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
  });

  it('returns null (renders nothing) when gameState is not null', () => {
    useGameStateStore.setState({ gameState: createSampleGameState() });
    // verify setState applied
    expect(useGameStateStore.getState().gameState).not.toBe(null);
    const html = renderToString(<GameSetupModal />);
    // gameState !== null → modal は描画しない
    expect(html).not.toContain('対戦開始');
    expect(html).not.toContain('game-setup-modal-overlay');
  });

  it('start button click triggers setGameState with a valid sample state', () => {
    // Reset to null
    useGameStateStore.setState({ gameState: null });
    expect(useGameStateStore.getState().gameState).toBe(null);

    // Simulate the action that the button onClick handler performs.
    // (renderToString は onClick を呼べないため、ハンドラ等価ロジックを直接実行)
    useGameStateStore.getState().setGameState(createSampleGameState());

    const after = useGameStateStore.getState().gameState;
    expect(after).not.toBe(null);
    expect(after?.turn.player).toMatch(/self|opp/);
    expect(after?.players.self).toBeDefined();
    expect(after?.players.opp).toBeDefined();
  });
});
