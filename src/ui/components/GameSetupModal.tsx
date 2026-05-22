// Task 8.4: ゲーム開始モーダル
//
// rules: 04-game-setup.md
// spec: .claude/specs/2026-05-11-ui-modal-flows-other.md ゲーム開始モーダル
//
// 役割:
//   - 起動時 gameState === null のとき表示
//   - 「対戦開始」ボタンで sampleGameState (MVP) を setGameState
//   - Task 8.4b 以降で engine.flow.setup を使った正規初期化に置換予定

import { useState, type JSX } from 'react';
import { useGameStateStore } from '@/ui/state/store.js';
import { useTutorialStore } from '@/ui/state/tutorialStore.js';
import { performGameStart } from '@/ui/services/gameStarter.js';
import { createSampleGameState } from '@/ui/fixtures/sampleGameState.js';
import { AVAILABLE_DECKS, type DeckId } from '@/ui/services/deckBuilder.js';
import './GameSetupModal.css';

export type GameSetupModalProps = {
  /**
   * Phase 9-G.2: リプレイ JSON が読込まれたら呼ばれる callback (App.tsx
   * 側で useReplayDriver.loadLog を渡す)。未指定なら「リプレイ読込」button 非表示。
   */
  onLoadReplay?: (log: unknown) => void;
};

export function GameSetupModal(props: GameSetupModalProps = {}): JSX.Element | null {
  const { onLoadReplay } = props;
  const handleReplayFile = (e: import('react').ChangeEvent<HTMLInputElement>): void => {
    if (!onLoadReplay) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(String(reader.result));
        onLoadReplay(json);
      } catch (err) {
        console.error('replay load: invalid JSON', err);
      }
    };
    reader.readAsText(file);
  };
  // 親 (App.tsx) が gameState を subscribe して再描画 → 本コンポーネントも再評価される。
  // 自前の subscription は不要 (SSR テスト互換性 + zustand 不要な hooks 回避)。
  const gameState = useGameStateStore.getState().gameState;
  // BUG-042 (#17): self / opp のデッキを独立選択可能化
  const [selfDeckId, setSelfDeckId] = useState<DeckId>('CT-D08');
  const [oppDeckId, setOppDeckId] = useState<DeckId>('CT-D11');
  if (gameState !== null) return null;

  const deckSelection = { selfDeckId, oppDeckId };

  const handleStart = async (): Promise<void> => {
    // Round 2: performGameStart は async (マリガン UI await)
    // BUG-042: deckSelection を渡してユーザー選択のデッキで開始
    const state = await performGameStart(undefined, deckSelection);
    useGameStateStore.getState().setGameState(state);
  };

  const handleDemo = (): void => {
    // 開発用: turn-4 中盤状態の sampleGameState (固定 CT-D08 vs CT-D11)
    useGameStateStore.getState().setGameState(createSampleGameState());
  };

  const handleTutorial = async (): Promise<void> => {
    // Round 2: performGameStart は async
    const state = await performGameStart(undefined, deckSelection);
    useGameStateStore.getState().setGameState(state);
    useTutorialStore.getState().start();
  };

  const handleSpectate = async (): Promise<void> => {
    // Round 4l (B5 観戦モード): AI vs AI 自動進行
    // - spectatorMode=true で useSpectatorTurnDriver が self ターンも自動進行
    // - 既存 useOppTurnDriver が opp ターンを自動進行 (変更なし)
    // - 勝敗 detect (gameResult set) で両 driver が停止
    const state = await performGameStart(undefined, deckSelection);
    useGameStateStore.getState().setGameState(state);
    useGameStateStore.getState().setSpectatorMode(true);
  };

  return (
    <div className="game-setup-modal-overlay" role="dialog" aria-labelledby="setup-title">
      <div className="game-setup-modal">
        <h1 id="setup-title">名探偵コナンTCG</h1>
        <p className="game-setup-subtitle">MVP 開発版</p>
        {/* BUG-042 (#17): デッキ選択。MVP では CT-D08 / CT-D11 の 2 種。 */}
        <fieldset className="game-setup-deck-select">
          <legend>デッキ選択</legend>
          <label className="game-setup-deck-row">
            <span className="game-setup-deck-label">自分</span>
            <select
              value={selfDeckId}
              onChange={(e) => setSelfDeckId(e.target.value as DeckId)}
              data-testid="game-setup-self-deck"
              aria-label="自分のデッキ"
            >
              {AVAILABLE_DECKS.map((d) => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          </label>
          <label className="game-setup-deck-row">
            <span className="game-setup-deck-label">CPU</span>
            <select
              value={oppDeckId}
              onChange={(e) => setOppDeckId(e.target.value as DeckId)}
              data-testid="game-setup-opp-deck"
              aria-label="CPU のデッキ"
            >
              {AVAILABLE_DECKS.map((d) => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          </label>
        </fieldset>
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
        <button
          type="button"
          className="game-setup-spectate-btn"
          onClick={handleSpectate}
          data-testid="game-setup-spectate"
        >
          観戦モード (AI vs AI)
        </button>
        {onLoadReplay && (
          <label className="game-setup-replay-label" data-testid="game-setup-replay-label">
            リプレイ JSON 読込
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleReplayFile}
              data-testid="game-setup-replay-file"
            />
          </label>
        )}
        <p className="game-setup-note">
          ※「対戦開始」で CT-D08 vs CT-D11 の turn-1 を正規開始 (手札の引き直し UI が表示されます)。
          「デモ」は中盤の動作確認用。
        </p>
      </div>
    </div>
  );
}
