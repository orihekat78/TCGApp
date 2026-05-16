// Phase 8.10f: コンタクト判定フラッシュ
//
// 役割:
//   - state.log の末尾が 'contact-judge' のとき、画面全体に短時間フラッシュ
//   - hit (相手キャラリムーブ) は赤系 / miss (AP 不足) は青系
//   - 自動 fade-out (~700ms)。新しい judge が来たら即座に再フラッシュ
//
// SSR 互換: useGameStateStore.getState() 直読 (subscribe は親 App.tsx に任せる)。

import { useEffect, useState, type JSX } from 'react';
import { useGameStateStore } from '@/ui/state/store.js';
import './ContactFlash.css';

const FLASH_DURATION_MS = 700;

type FlashKind = 'hit' | 'miss';

export function ContactFlash(): JSX.Element | null {
  const gameState = useGameStateStore.getState().gameState;
  const last = gameState?.log[gameState.log.length - 1];
  const kind: FlashKind | null =
    last?.action === 'contact-judge'
      ? last.result === 'hit'
        ? 'hit'
        : 'miss'
      : null;

  const [cleared, setCleared] = useState(false);
  const logLen = gameState?.log.length ?? 0;

  useEffect(() => {
    if (kind === null) return undefined;
    setCleared(false);
    const t = setTimeout(() => setCleared(true), FLASH_DURATION_MS);
    return () => clearTimeout(t);
  }, [logLen, kind]);

  if (kind === null || cleared) return null;
  return (
    <div
      className={`contact-flash contact-flash-${kind}`}
      data-testid="contact-flash"
      aria-hidden="true"
    />
  );
}
