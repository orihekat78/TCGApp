// Phase 8.10a + Round 4l (BUG-010): opp ターン視覚化オーバーレイ
//
// rules: 05-turn-phases.md (ターン進行) / 07-action-flow.md / 08-contact.md
//
// 役割:
//   - turn.player === 'opp' のとき半透明オーバーレイを表示
//   - "相手のターン処理中" テキスト + 3 ドットスピナー で進行を視覚化
//   - useOppTurnDriver の 400ms 遅延と組み合わせ、ユーザが opp ターンの存在を認識できるように
//   - Round 4l: activeActionId 進行中なら 「相手がアクション中…」表示、MAX_MOVES safety cap も明示
//   - user_request 20260521_01 #3 UX 改善: activeActionId 中は attacker/target/phase の具体表示
//
// 親 (App.tsx) が gameState を subscribe して再描画 → 本コンポーネントも再評価される設計
// (GameSetupModal と同じパターン)。Round 4l では useGameStateStore hook で直接購読し
// activeActionId 変化にも追従する。

import type { JSX } from 'react';
import { useGameStateStore } from '@/ui/state/store.js';
import { def as readDef } from '@/engine/read/def.js';
import * as flow from '@/engine/flow/index.js';
import type { GameState, ActionContext } from '@/engine/types/index.js';
import './OppTurnOverlay.css';

const MAX_MOVES_PER_TURN = 200; // = PLAY_TURN_SAFETY_CAP (src/ai/policy.ts:121)

function nameOfUid(state: GameState, uid: string): string {
  if (uid === 'partner:self' || uid === 'partner:opp') {
    const p = uid === 'partner:self' ? 'self' : 'opp';
    const cardId = state.players[p].partner.cardId ?? '';
    return readDef.card(cardId)?.names?.[0] ?? cardId;
  }
  for (const p of ['self', 'opp'] as const) {
    const c = state.players[p].scene.find((x) => x.uid === uid);
    if (c) return readDef.card(c.cardId)?.names?.[0] ?? c.cardId;
  }
  return uid;
}

function phaseLabel(phase: ActionContext['phase']): string {
  switch (phase) {
    case 'declared':
    case 'guard-window':
      return 'ガード判定中';
    case 'leave-resolution':
    case 'contact-pending':
      return 'コンタクト処理中';
    case 'action-1':
      return 'コンタクト (1番目)';
    case 'action-2':
      return 'コンタクト (2番目)';
    case 'action-1-redo':
      return 'コンタクト (1番目 再行動)';
    case 'judge':
      return 'AP 判定中';
    case 'contact-end':
      return 'コンタクト終了処理';
    case 'action-end':
      return 'アクション終了処理';
    default:
      return 'アクション解決中';
  }
}

function buildActionStatus(state: GameState, ax: ActionContext): string {
  const attacker = nameOfUid(state, ax.byUid);
  const target = ax.target.kind === 'char' ? nameOfUid(state, ax.target.uid) : '事件';
  return `${attacker} → ${target} (${phaseLabel(ax.phase)})`;
}

export function OppTurnOverlay(): JSX.Element | null {
  // Round 4l (BUG-010): getState() で SSR 互換性維持。親 (App.tsx) が gameState を
  // subscribe するため再描画は親経由で伝搬する。activeActionId 変化も親再描画でカバー。
  const store = useGameStateStore.getState();
  const gameState = store.gameState;
  if (gameState === null) return null;
  if (gameState.turn.player !== 'opp') return null;

  const activeActionId = store.activeActionId;
  const ax = activeActionId ? flow.action._getContext(activeActionId) : null;
  const statusText = ax
    ? buildActionStatus(gameState, ax)
    : '相手のターン処理中';

  return (
    <div className="opp-turn-overlay" role="status" aria-live="polite" data-testid="opp-turn-overlay">
      <div className="opp-turn-message">
        <span className="opp-turn-label" data-testid="opp-turn-label">
          {statusText}
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
