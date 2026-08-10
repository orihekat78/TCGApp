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
import { isCausalLogEntry } from '@/engine/log/causal.js';
import { useGameStateStore } from '@/ui/state/store.js';

export function useCutinDemoDriver(): void {
  const mode = useGameStateStore((s) => s.cutinDemoMode);
  const runToken = useGameStateStore((s) => s.cutinDemoRunToken);
  const gameState = useGameStateStore((s) => s.gameState);
  /** mode='playing' に「初めて」入った時の log 長 (基準点)。以降は固定。 */
  const baseLogLenRef = useRef<number | null>(null);
  const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduledRunTokenRef = useRef<number | null>(null);

  // mode 遷移を監視: 'playing' に入った瞬間だけ baseLogLen を記録、それ以外で reset
  useEffect(() => {
    if (mode === 'playing') {
      baseLogLenRef.current = useGameStateStore.getState().gameState?.log.length ?? 0;
      scheduledRunTokenRef.current = null;
    } else {
      // playing 以外に戻ったら次回 playing 用に reset
      baseLogLenRef.current = null;
      scheduledRunTokenRef.current = null;
    }
    return () => {
      if (completionTimerRef.current !== null) {
        clearTimeout(completionTimerRef.current);
        completionTimerRef.current = null;
      }
    };
  }, [mode, runToken]);

  // log を監視: playing 中に base 以降に 'contact-cutin' action が出たら完了
  useEffect(() => {
    if (mode !== 'playing' || !gameState) return;
    if (baseLogLenRef.current === null) return;
    const recent = gameState.log.slice(baseLogLenRef.current);
    const cutinFired = recent.some((entry) => entry.action === 'contact-cutin'
      || (isCausalLogEntry(entry)
        && entry.kind === 'use'
        && entry.tags?.includes('contact') === true
        && entry.tags.includes('cutin')));
    if (cutinFired && scheduledRunTokenRef.current !== runToken) {
      scheduledRunTokenRef.current = runToken;
      // contact 終了まで少し待つ (judge / contact-end / action-end を経て log が安定)
      completionTimerRef.current = setTimeout(() => {
        completionTimerRef.current = null;
        const store = useGameStateStore.getState();
        if (store.cutinDemoMode === 'playing' && store.cutinDemoRunToken === runToken) {
          store.setCutinDemoMode('completed');
        }
      }, 400);
    }
  }, [mode, gameState, runToken]);
}
