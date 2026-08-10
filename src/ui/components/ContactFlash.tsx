// Phase 8.10f: コンタクト判定フラッシュ
//
// 役割:
//   - 正規化済み因果イベント列の末尾がコンタクト判定のとき、画面全体に短時間フラッシュ
//   - hit (相手キャラリムーブ) は赤系 / miss (AP 不足) は青系
//   - 自動 fade-out (~700ms)。新しい judge が来たら即座に再フラッシュ
//
// SSR 互換: useGameStateStore.getState() 直読 (subscribe は親 App.tsx に任せる)。

import { useEffect, useState, type JSX } from 'react';
import { useGameStateStore } from '@/ui/state/store.js';
import { normalizedGameLogForUi } from '@/ui/presentation/normalizedLog.js';
import './ContactFlash.css';

const FLASH_DURATION_MS = 700;

type FlashKind = 'hit' | 'miss';

type ContactFlashProps = {
  suppressed?: boolean;
};

export function ContactFlash({ suppressed = false }: ContactFlashProps = {}): JSX.Element | null {
  const gameState = useGameStateStore.getState().gameState;
  const last = !suppressed && gameState
    ? normalizedGameLogForUi(gameState).nodes.at(-1)
    : undefined;
  const kind: FlashKind | null =
    last?.tags.includes('contact') && last.outcome.type === 'state'
      ? last.outcome.state === 'success'
        ? 'hit'
        : last.outcome.state === 'failed'
          ? 'miss'
          : null
      : null;

  const [cleared, setCleared] = useState(false);
  const eventId = last?.id ?? null;

  useEffect(() => {
    if (kind === null) return undefined;
    setCleared(false);
    const t = setTimeout(() => setCleared(true), FLASH_DURATION_MS);
    return () => clearTimeout(t);
  }, [eventId, kind]);

  if (kind === null || cleared) return null;
  return (
    <div
      className={`contact-flash contact-flash-${kind}`}
      data-testid="contact-flash"
      aria-hidden="true"
    />
  );
}
