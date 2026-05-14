// Phase 7 Task 7.3: Playmat レイアウト (1920×1080 / 最低 1280×720)
// rules: 03-field-areas.md (8 エリア構成)
// 視覚: design-mockups/01-board-mockup.html .stage / .play-area / .mat
//
// 構造:
//   .scaler > .stage[1920×1080] > .bg + .topbar + .play-area + .hand-zone + .log-btn
//   .play-area > .opp-hand-strip + .mat.opp + .keep-out + .mat.self
//   .mat > .case-col + .scene-col + .partner-col + .deck-col + .remove-col + .file-row
//
// Phase 7 では SceneArea のみ実体接続。他 zone (Partner/Case/Deck/Remove/File,
// TopBar, HandZone, LogPanel) は Task 7.5-7.13 で実装するため placeholder。
// 操作系 (クリック・DnD) は Phase 8。

import type { JSX } from 'react';
import type { GameState } from '@/engine/types/game-state.js';
import { SceneArea, type ResolvedCardMeta } from './SceneArea.js';
import { PartnerArea } from './PartnerArea.js';
import { DeckArea } from './DeckArea.js';
import './Playmat.css';

export type PlaymatProps = {
  gameState: GameState | null;
  resolveCard: (cardId: string) => ResolvedCardMeta;
};

type PlayerMatProps = {
  side: 'self' | 'opp';
  state: GameState | null;
  resolveCard: (cardId: string) => ResolvedCardMeta;
};

function PlayerMat({ side, state, resolveCard }: PlayerMatProps): JSX.Element {
  const scene = state?.players[side].scene ?? [];

  return (
    <div className={`mat ${side}`} data-side={side}>
      <div className="zone case-col case-zone" aria-label="事件" />
      <SceneArea characters={scene} side={side} resolveCard={resolveCard} />
      <PartnerArea
        partner={state?.players[side].partner ?? null}
        side={side}
        resolveCard={resolveCard}
      />
      <DeckArea count={state?.players[side].deck.length ?? 0} side={side} />
      <div className="zone remove-col remove-zone" aria-label="リムーブ" />
      <div className="file-row" aria-label="FILE" />
    </div>
  );
}

export function Playmat({ gameState, resolveCard }: PlaymatProps): JSX.Element {
  return (
    <div className="scaler" id="scaler">
      <div className="stage">
        <div className="bg" />
        <div className="vignette" />

        {/* TopBar slot — Task 7.12 で実装 */}
        <div className="topbar topbar-placeholder" aria-label="TopBar" />

        <div className="play-area">
          {/* Opponent hand strip (top of opp mat) — Task 7.11 関連 */}
          <div className="opp-hand-strip" aria-label="相手手札" />

          <PlayerMat side="opp" state={gameState} resolveCard={resolveCard} />

          {/* KEEP OUT divider — spec 要求 (mock では display:none) */}
          <div className="keep-out" role="separator" aria-label="KEEP OUT" />

          <PlayerMat side="self" state={gameState} resolveCard={resolveCard} />
        </div>

        {/* HandZone slot — Task 7.11 で実装 */}
        <div className="hand-zone hand-placeholder" aria-label="手札" />

        {/* LogPanel button — Task 7.13 で実装 */}
        <button
          type="button"
          className="log-btn"
          aria-label="ログを開く"
          disabled
        />
      </div>
    </div>
  );
}
