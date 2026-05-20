// Phase 8.10a + Round 4l (BUG-010): opp ターン視覚化オーバーレイ
//
// rules: 05-turn-phases.md (ターン進行)
//
// 役割:
//   - turn.player === 'opp' のとき半透明オーバーレイを表示
//   - "相手のターン処理中" テキスト + 3 ドットスピナー で進行を視覚化
//   - useOppTurnDriver の 400ms 遅延と組み合わせ、ユーザが opp ターンの存在を認識できるように
//   - Round 4l: activeActionId 進行中なら 「相手がアクション中…」表示、MAX_MOVES safety cap も明示
//
// 親 (App.tsx) が gameState を subscribe して再描画 → 本コンポーネントも再評価される設計
// (GameSetupModal と同じパターン)。Round 4l では useGameStateStore hook で直接購読し
// activeActionId 変化にも追従する。

import type { JSX } from 'react';
import { useGameStateStore } from '@/ui/state/store.js';
import './OppTurnOverlay.css';

const MAX_MOVES_PER_TURN = 200; // = PLAY_TURN_SAFETY_CAP (src/ai/policy.ts:121)

export function OppTurnOverlay(): JSX.Element | null {
  // Round 4l (BUG-010): getState() で SSR 互換性維持。親 (App.tsx) が gameState を
  // subscribe するため再描画は親経由で伝搬する。activeActionId 変化も親再描画でカバー。
  const store = useGameStateStore.getState();
  const gameState = store.gameState;
  if (gameState === null) return null;
  if (gameState.turn.player !== 'opp') return null;

  const inAction = store.activeActionId !== null;

  return (
    <div className="opp-turn-overlay" role="status" aria-live="polite" data-testid="opp-turn-overlay">
      <div className="opp-turn-message">
        <span className="opp-turn-label">
          {inAction ? '相手がアクション解決中…' : '相手のターン処理中'}
        </span>
        <span className="opp-turn-dots" aria-hidden="true">
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
        </span>
        <span className="opp-turn-safety-cap" aria-label={`安全上限 ${MAX_MOVES_PER_TURN} 手`}>
          (安全上限 {MAX_MOVES_PER_TURN} 手)
        </span>
      </div>
    </div>
  );
}
