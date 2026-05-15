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

import { useState, type JSX } from 'react';
import type { GameState } from '@/engine/types/game-state.js';
import { SceneArea, type ResolvedCardMeta } from './SceneArea.js';
import { PartnerArea } from './PartnerArea.js';
import { DeckArea } from './DeckArea.js';
import { RemoveArea } from './RemoveArea.js';
import { LogPanel } from './LogPanel.js';
import { CaseArea, type CaseInfo, type CaseColor } from './CaseArea.js';
import { FileArea } from './FileArea.js';
import { EvidenceArea } from './EvidenceArea.js';
import { HandZone, type HandCardMeta } from './HandZone.js';
import { TopBar } from './TopBar.js';
import { ActionsPanel, type ActionItemId } from './ActionsPanel.js';
import { ConfirmModal } from './ConfirmModal.js';
import { runEndTurnFlow } from '../hooks/useActionsPanelFlow.js';
import { useConfirmation, useConfirmationStore } from '../hooks/useConfirmation.js';
import './Playmat.css';

// engine の `players[side].case.colors` (日本語色名) を CaseInfo.color (英名) に変換
const JP_COLOR_TO_EN: Record<string, CaseColor> = {
  '青': 'blue', '黄': 'yellow', '赤': 'red', '緑': 'green', '紫': 'purple',
};

export type PlaymatProps = {
  gameState: GameState | null;
  resolveCard: (cardId: string) => ResolvedCardMeta;
  /**
   * 事件 cardId → 表示用メタ解決 (任意)。
   * 指定なしの場合は cardId をタイトルにフォールバックする placeholder ロジック。
   */
  resolveCase?: (cardId: string) => { title: string; color: CaseColor; level: number };
  /**
   * 手札 cardId → HandCardMeta 解決 (任意)。
   * 指定なしの場合は HandZone は空表示。
   */
  resolveHandCard?: (cardId: string) => HandCardMeta;
};

type PlayerMatProps = {
  side: 'self' | 'opp';
  state: GameState | null;
  resolveCard: (cardId: string) => ResolvedCardMeta;
  resolveCase?: (cardId: string) => { title: string; color: CaseColor; level: number };
};

function PlayerMat({ side, state, resolveCard, resolveCase }: PlayerMatProps): JSX.Element {
  const scene = state?.players[side].scene ?? [];
  const engineCase = state?.players[side].case;

  // engine の case → 表示用 CaseInfo に変換。resolveCase があれば title/color/level
  // を cards.json 由来で解決、なければ cardId / requiredEvidence で placeholder。
  const caseInfo: CaseInfo | null = engineCase
    ? (() => {
        const resolved = resolveCase ? resolveCase(engineCase.cardId) : null;
        return {
          cardId: engineCase.cardId,
          title: resolved?.title ?? engineCase.cardId,
          color: resolved?.color ?? JP_COLOR_TO_EN[engineCase.colors[0] ?? '青'] ?? 'blue',
          level: resolved?.level ?? engineCase.requiredEvidence,
          status: engineCase.status,
          requiredEvidence: engineCase.requiredEvidence,
        };
      })()
    : null;
  const turnOrder = side === 'self' && (state?.players.self.case.requiredEvidence ?? 7) === 7
    ? 'first'
    : side === 'opp' && (state?.players.opp.case.requiredEvidence ?? 7) === 7
    ? 'first'
    : 'second';

  const evidenceCount = state?.players[side].evidence.length ?? 0;
  const requiredEvidence = engineCase?.requiredEvidence ?? 7;

  // レイアウト構造 (対称配置、エリア重なりなし):
  //   .mat (3-col grid)
  //     ├─ .left-col   : CaseArea (上) + FileArea (下)
  //     ├─ .center-col : SceneArea (上) + .below-scene (下: EvidenceArea | PartnerArea)
  //     └─ .right-col  : DeckArea (上) + RemoveArea (下)
  //   opp は transform: rotate(180deg) で全体が上下逆転 (対称配置)
  return (
    <div className={`mat ${side}`} data-side={side}>
      <div className="left-col">
        <CaseArea caseInfo={caseInfo} turnOrder={turnOrder} side={side} />
        <FileArea
          cards={state?.players[side].file ?? []}
          side={side}
          resolveCard={resolveCard}
        />
      </div>
      <div className="center-col">
        <SceneArea characters={scene} side={side} resolveCard={resolveCard} />
        <div className="below-scene">
          <EvidenceArea
            count={evidenceCount}
            requiredEvidence={requiredEvidence}
            side={side}
          />
          <PartnerArea
            partner={state?.players[side].partner ?? null}
            side={side}
            resolveCard={resolveCard}
          />
        </div>
      </div>
      <div className="right-col">
        <DeckArea count={state?.players[side].deck.length ?? 0} side={side} />
        <RemoveArea
          cards={state?.players[side].remove ?? []}
          side={side}
          resolveCard={resolveCard}
        />
      </div>
    </div>
  );
}

export function Playmat({ gameState, resolveCard, resolveCase, resolveHandCard }: PlaymatProps): JSX.Element {
  // Phase 8.5: 手札は default で collapsed (小さいストリップ)、クリックで expanded (実寸 + ×)
  const [handExpanded, setHandExpanded] = useState(false);
  const handCards: HandCardMeta[] = resolveHandCard
    ? (gameState?.players.self.hand ?? []).map(resolveHandCard)
    : [];
  return (
    <div className="scaler" id="scaler">
      <div className="stage">
        <div className="bg" />
        <div className="vignette" />

        {/* TopBar (Task 7.12) */}
        <TopBar
          turn={{
            number: gameState?.turn.number ?? 1,
            player: gameState?.turn.player ?? 'self',
          }}
          scratchTrace={gameState?.scratchTrace ?? { self: '未発見', opp: '未発見' }}
          effectStackCount={gameState?.pendingEffects.length ?? 0}
        />

        <div className="play-area">
          {/* Opponent hand strip (top of opp mat, count + mini card-backs) */}
          <div className="opp-hand-strip" aria-label="相手手札">
            <span className="opp-hand-label">相手の手札</span>
            <div className="mini-cards">
              {Array.from({ length: gameState?.players.opp.hand.length ?? 0 }).map((_, i) => (
                <div key={i} className="mini-card-back" aria-hidden="true">DC</div>
              ))}
            </div>
            <span className="opp-hand-count">{gameState?.players.opp.hand.length ?? 0} 枚</span>
          </div>

          <PlayerMat side="opp" state={gameState} resolveCard={resolveCard} resolveCase={resolveCase} />

          {/* KEEP OUT divider removed — Phase 7.5 layout pivot per user feedback */}

          <PlayerMat side="self" state={gameState} resolveCard={resolveCard} resolveCase={resolveCase} />
        </div>

        {/* HandZone (Task 7.11) */}
        <HandZone
          cards={handCards}
          expanded={handExpanded}
          onExpand={() => setHandExpanded(true)}
          onCollapse={() => setHandExpanded(false)}
        />

        {/* ActionsPanel (Phase 8.5 で endTurn 配線開始、他は 8.6+) */}
        <ActionsPanel
          handCount={handCards.length}
          handUseRemaining={gameState?.turnState.self.handUseUsed ? 0 : 1}
          nextHintFileCount={gameState?.players.self.file.length ?? 0}
          nextHintUsed={gameState?.turnState.self.nextHintUsed ?? false}
          partnerActive={gameState?.players.self.partner.state === 'active'}
          declaredTargetCount={0}
          reasoningTotalLP={0}
          actionMode="idle"
          currentPhase={gameState?.turn.phase ?? 'main'}
          canEndTurn={
            (gameState?.turn.player === 'self') &&
            (gameState?.turn.phase === 'main')
          }
          onEndTurn={() => { void runEndTurnFlow({ player: 'self' }); }}
          onActionItemClick={(id: ActionItemId) => {
            // Phase 8.6+ で各アクションのフローを配線する。
            // 現状は console に出して未配線であることを示す。
            // eslint-disable-next-line no-console
            console.log(`[Phase 8.5] action item clicked (not yet wired): ${id}`);
          }}
        />

        {/* ConfirmModal — useConfirmation の state を全画面オーバーレイで描画 */}
        <PlaymatConfirmModal />

        {/* Narrator message bar (bottom, 操作説明用 — Phase 8 で動的に) */}
        <div className="narrator-msg" role="status">
          あなたは ⑥ <strong>アクション</strong> を選択しました。攻撃元キャラを指定し、相手のスリープ/スタン状態のキャラからアクション対象を選んでください。
        </div>

        {/* LogPanel (閉時は .log-btn のみ。開閉は Phase 8) */}
        <LogPanel entries={gameState?.log ?? []} open={false} />
      </div>
    </div>
  );
}

/**
 * Playmat 内部の ConfirmModal ラッパ。
 * useConfirmation store を subscribe して controlled な ConfirmModal に渡す。
 * ConfirmModal 本体は presentation のみ (SSR/test 容易性のため)。
 */
function PlaymatConfirmModal(): JSX.Element | null {
  const current = useConfirmationStore((s) => s.current);
  const { accept, reject } = useConfirmation();
  return <ConfirmModal current={current} onAccept={accept} onReject={reject} />;
}
