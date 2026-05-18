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
import { useTutorialStore } from '@/ui/state/tutorialStore.js';
import { performGameStart } from '@/ui/services/gameStarter.js';
import { createSampleGameState } from '@/ui/fixtures/sampleGameState.js';
import './GameSetupModal.css';

export function GameSetupModal(): JSX.Element | null {
  // 親 (App.tsx) が gameState を subscribe して再描画 → 本コンポーネントも再評価される。
  // 自前の subscription は不要 (SSR テスト互換性 + zustand 不要な hooks 回避)。
  const gameState = useGameStateStore.getState().gameState;
  if (gameState !== null) return null;

  const handleStart = async (): Promise<void> => {
    // Round 2: performGameStart は async (マリガン UI await)
    const state = await performGameStart();
    useGameStateStore.getState().setGameState(state);
  };

  const handleDemo = (): void => {
    // 開発用: turn-4 中盤状態の sampleGameState
    useGameStateStore.getState().setGameState(createSampleGameState());
  };

  const handleTutorial = async (): Promise<void> => {
    // Round 2: performGameStart は async
    const state = await performGameStart();
    useGameStateStore.getState().setGameState(state);
    useTutorialStore.getState().start();
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
        <button
          type="button"
          className="game-setup-tutorial-btn"
          onClick={handleTutorial}
          data-testid="game-setup-tutorial"
        >
          チュートリアル開始
        </button>
        <button
          type="button"
          className="game-setup-demo-btn"
          onClick={handleDemo}
          data-testid="game-setup-demo"
        >
          デモ (turn-4) を読込
        </button>
        <p className="game-setup-note">
          ※「対戦開始」で CT-D08 vs CT-D11 の turn-1 を正規開始 (手札の引き直し UI が表示されます)。
          「デモ」は中盤の動作確認用。
        </p>
      </div>
    </div>
  );
}
