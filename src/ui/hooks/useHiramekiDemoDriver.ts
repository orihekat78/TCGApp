// 2026-05-26 ヒラメキ効果検証 demo の完了検知 driver
//
// rules: 10-action-event.md §ヒラメキ
// spec: plan ファイル「ヒラメキ効果検証デモプレイ環境」
//
// 役割:
//   hiramekiDemoMode === 'playing' の間、pendingHirameki を監視。
//   non-null → null へ遷移 (= hirameki resolve 完了) を検知したら
//   mode を 'completed' に遷移させて HiramekiDemoBanner を表示する。
//
//   useRef で「pendingHirameki が一度でも non-null になった」事実を記録し、
//   その後 null になった瞬間に completed に遷移する。これにより、demo 開始直後
//   pendingHirameki が未 set の状態でも誤発火しない。

import { useEffect, useRef } from 'react';
import { useGameStateStore } from '@/ui/state/store.js';

export function useHiramekiDemoDriver(): void {
  const mode = useGameStateStore((s) => s.hiramekiDemoMode);
  const pendingHirameki = useGameStateStore((s) => s.pendingHirameki);
  /** demo 'playing' 中に pendingHirameki が一度でも non-null になった事実 */
  const hadPendingRef = useRef(false);

  // mode='playing' に入った瞬間は記録 reset
  useEffect(() => {
    if (mode === 'playing') {
      hadPendingRef.current = false;
    }
  }, [mode]);

  // pendingHirameki 監視: playing 中に non-null → null 遷移で完了
  useEffect(() => {
    if (mode !== 'playing') return;
    if (pendingHirameki !== null) {
      hadPendingRef.current = true;
      return;
    }
    // pendingHirameki === null かつ過去に一度 non-null だった → 完了
    if (hadPendingRef.current) {
      useGameStateStore.getState().setHiramekiDemoMode('completed');
    }
  }, [mode, pendingHirameki]);
}
