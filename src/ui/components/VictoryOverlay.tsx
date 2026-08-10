// Phase 8.10j: 勝利演出
//
// rules: 01-victory-conditions.md / 14-refresh.md (deck-out)
//
// 役割:
//   - gameState.gameResult が non-null になったら全画面オーバーレイ
//   - 自分視点 (self) を主役にし、winner === 'self' なら WIN / 'opp' なら LOSE
//   - reason: evidence (事件解決), deck-out (デッキ切れ), concede (投了)
//   - pointer-events:auto で背景操作をブロック (再戦ボタンは未実装、本 PR では表示のみ)

import { useSyncExternalStore, type JSX } from 'react';
import { useGameStateStore } from '@/ui/state/store.js';
import { getPresentationQueue } from '@/ui/presentation/coordinator.js';
import './VictoryOverlay.css';

const REASON_LABEL: Record<string, string> = {
  evidence: '事件解決!',
  'deck-out': 'デッキ切れ',
  concede: '投了',
  'alt-lose': '証拠隠滅', // engine E3 (2026-07-02) — 「相手はゲームに敗北する」alt-lose 勝利ルート
};

export function VictoryOverlay(): JSX.Element | null {
  useGameStateStore((state) => state.gameState);
  useGameStateStore((state) => state.pendingDeckReveal);
  useGameStateStore((state) => state.pendingPublicHandReveal);
  const { gameState, pendingDeckReveal, pendingPublicHandReveal } = useGameStateStore.getState();
  const queue = getPresentationQueue();
  useSyncExternalStore(
    (listener) => queue.subscribe(listener),
    () => queue.revision(),
    () => queue.revision(),
  );
  const result = gameState?.gameResult;
  if (!result) return null;

  const presentationPending = queue.outstandingCount() > 0
    || pendingDeckReveal !== null
    || pendingPublicHandReveal?.lifetime === 'presentation';

  const selfWon = result.winner === 'self';
  const headline = selfWon ? 'YOU WIN' : 'YOU LOSE';
  const reasonText = REASON_LABEL[result.reason] ?? result.reason;

  return (
    <div
      className={`victory-overlay ${selfWon ? 'win' : 'lose'}${presentationPending ? ' is-presentation-pending' : ''}`}
      data-testid="victory-overlay"
      role={presentationPending ? undefined : 'alertdialog'}
      aria-hidden={presentationPending ? true : undefined}
      aria-labelledby={presentationPending ? undefined : 'victory-headline'}
    >
      <div className="victory-card">
        <div id="victory-headline" className="victory-headline">{headline}</div>
        <div className="victory-reason">{reasonText}</div>
        <div className="victory-sub">
          {selfWon ? 'おめでとうございます!' : '次のチャレンジへ'}
        </div>
      </div>
    </div>
  );
}
