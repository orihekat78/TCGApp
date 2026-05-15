// Task 8.4: ゲーム開始モーダル
//
// rules: 04-game-setup.md
// spec: .claude/specs/2026-05-11-ui-modal-flows-other.md ゲーム開始モーダル
//
// 役割:
//   - 起動時 gameState === null のとき表示
//   - 「対戦開始」ボタンで sampleGameState (MVP) を setGameState
//   - Task 8.4b 以降で engine.flow.setup を使った正規初期化に置換予定

import type { JSX } from 'react';
import { useGameStateStore } from '@/ui/state/store.js';
import { createSampleGameState } from '@/ui/fixtures/sampleGameState.js';
import './GameSetupModal.css';

export function GameSetupModal(): JSX.Element | null {
  // 親 (App.tsx) が gameState を subscribe して再描画 → 本コンポーネントも再評価される。
  // 自前の subscription は不要 (SSR テスト互換性 + zustand 不要な hooks 回避)。
  const gameState = useGameStateStore.getState().gameState;
  if (gameState !== null) return null;

  const handleStart = (): void => {
    // Task 8.4b で engine.flow.setup を使った正規初期化に置換予定。
    // 現状は sampleGameState (turn-4 中盤状態) で代用。
    useGameStateStore.getState().setGameState(createSampleGameState());
  };

  return (
    <div className="game-setup-modal-overlay" role="dialog" aria-labelledby="setup-title">
      <div className="game-setup-modal">
        <h1 id="setup-title">名探偵コナンTCG</h1>
        <p className="game-setup-subtitle">MVP 開発版</p>
        <button
          type="button"
          className="game-setup-start-btn"
          onClick={handleStart}
          data-testid="game-setup-start"
        >
          対戦開始
        </button>
        <p className="game-setup-note">
          ※ 現在は中盤状態 (turn 4) からの開始です。正規の turn-1 初期化は今後対応予定。
        </p>
      </div>
    </div>
  );
}
