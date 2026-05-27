// 2026-05-27 カットイン効果検証 demo の完了検知 driver
//
// rules: 09-cutin-disguise.md, 08-contact.md
// spec: useHiramekiDemoDriver の cutin 版
//
// 役割:
//   cutinDemoMode === 'playing' の間、log で `contact-cutin` action を
//   観測したら mode='completed' に遷移させる。
//   contact-cutin は engine.flow.contact.cutIn() 内で必ず emit されるため
//   (`mutate.log.append({ action: 'contact-cutin', target: cardId })`)
//   demo 中に cutin 効果が走った事実の確実な signal となる。

import { useEffect, useRef } from 'react';
import { useGameStateStore } from '@/ui/state/store.js';

export function useCutinDemoDriver(): void {
  const mode = useGameStateStore((s) => s.cutinDemoMode);
  const gameState = useGameStateStore((s) => s.gameState);
  /** mode='playing' に「初めて」入った時の log 長 (基準点)。以降は固定。 */
  const baseLogLenRef = useRef<number | null>(null);

  // mode 遷移を監視: 'playing' に入った瞬間だけ baseLogLen を記録、それ以外で reset
  useEffect(() => {
    if (mode === 'playing') {
      // 既に記録済みなら触らない (log 更新による re-run でも安定)
      if (baseLogLenRef.current === null) {
        baseLogLenRef.current = useGameStateStore.getState().gameState?.log.length ?? 0;
      }
    } else {
      // playing 以外に戻ったら次回 playing 用に reset
      baseLogLenRef.current = null;
    }
  }, [mode]);

  // log を監視: playing 中に base 以降に 'contact-cutin' action が出たら完了
  useEffect(() => {
    if (mode !== 'playing' || !gameState) return;
    if (baseLogLenRef.current === null) return;
    const recent = gameState.log.slice(baseLogLenRef.current);
    const cutinFired = recent.some((l) => l.action === 'contact-cutin');
    if (cutinFired) {
      // contact 終了まで少し待つ (judge / contact-end / action-end を経て log が安定)
      setTimeout(() => {
        const m = useGameStateStore.getState().cutinDemoMode;
        if (m === 'playing') {
          useGameStateStore.getState().setCutinDemoMode('completed');
        }
      }, 400);
    }
  }, [mode, gameState]);
}
