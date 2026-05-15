// Phase 8.10a: opp ターン視覚化オーバーレイ
//
// rules: 05-turn-phases.md (ターン進行)
//
// 役割:
//   - turn.player === 'opp' のとき半透明オーバーレイを表示
//   - "相手のターン処理中" テキスト + 3 ドットスピナー で進行を視覚化
//   - useOppTurnDriver の 400ms 遅延と組み合わせ、ユーザが opp ターンの存在を認識できるように
//
// 親 (App.tsx) が gameState を subscribe して再描画 → 本コンポーネントも再評価される設計
// (GameSetupModal と同じパターン)。

import type { JSX } from 'react';
import { useGameStateStore } from '@/ui/state/store.js';
import './OppTurnOverlay.css';

export function OppTurnOverlay(): JSX.Element | null {
  const gameState = useGameStateStore.getState().gameState;
  if (gameState === null) return null;
  if (gameState.turn.player !== 'opp') return null;

  return (
    <div className="opp-turn-overlay" role="status" aria-live="polite" data-testid="opp-turn-overlay">
      <div className="opp-turn-message">
        <span className="opp-turn-label">相手のターン処理中</span>
        <span className="opp-turn-dots" aria-hidden="true">
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
        </span>
      </div>
    </div>
  );
}
