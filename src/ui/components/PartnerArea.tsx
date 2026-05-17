// Phase 7 Task 7.5: PartnerArea
// プレイヤーのパートナーゾーン (1 枚) を静的表示。
// rules: 06-card-types.md §パートナー, 18-mr.md, 13-keywords.md §アシスト
// 視覚: design-mockups/01-board-mockup.html 1358-1378 (opp) / 1484-1505 (self)
// 操作系は Phase 8。

import type { JSX } from 'react';
import type { PartnerOnBoard } from '@/engine/types/game-state.js';
import type { ResolvedCardMeta } from './SceneArea.js';
import { CardArt } from './CardArt.js';
import './PartnerArea.css';

export type PartnerAreaProps = {
  partner: PartnerOnBoard | null;
  side: 'self' | 'opp';
  resolveCard: (cardId: string) => ResolvedCardMeta;
  /** Phase 8.5: 推理/宣言能力/アシスト 対象選択中のハイライト */
  isCandidate?: boolean;
  /** Phase 8.5: 候補としてクリックされたとき。uid は親が知っている (`partner:self` 等)。 */
  onClick?: () => void;
};

const STATE_LABEL: Record<PartnerOnBoard['state'], string> = {
  active: 'アクティブ',
  sleep:  'スリープ',
  stun:   'スタン',
};

const STATE_COLOR: Record<PartnerOnBoard['state'], string> = {
  active: 'var(--neon-blue)',
  sleep:  '#5a8ec4',
  stun:   'var(--state-stun)',
};

const COLOR_LABEL: Record<ResolvedCardMeta['color'], string> = {
  blue:   '青',
  yellow: '黄',
  red:    '赤',
  green:  '緑',
  purple: '紫',
};

/**
 * パートナーカードの表示。location='partner-area' のときのみカードを描画し、
 * 'file-area' (アシスト中) / 'mr-removed' (MR リムーブ) のときは
 * キーホール透かしのみ + 状態ラベルを表示する。
 */
export function PartnerArea({ partner, side, resolveCard, isCandidate, onClick }: PartnerAreaProps): JSX.Element {
  const isOnBoard = partner !== null && partner.location === 'partner-area';
  const assisted  = partner !== null && partner.location === 'file-area';
  const mrRemoved = partner !== null && partner.location === 'mr-removed';

  const meta = isOnBoard ? resolveCard(partner.cardId) : null;

  return (
    <div className={`zone partner-col partner-zone partner-area side-${side}`}>
      <div className="zone-watermark-keyhole" aria-hidden="true">
        <svg viewBox="0 0 64 84" fill="none">
          <path
            d="M32 8 C 20 8 14 18 14 28 C 14 36 19 42 24 45 L 20 76 L 44 76 L 40 45 C 45 42 50 36 50 28 C 50 18 44 8 32 8 Z"
            stroke="rgba(255,255,255,0.55)"
            strokeWidth="1.5"
            strokeDasharray="2 2"
          />
        </svg>
        <div className="lbl">パートナー</div>
      </div>

      <div className="zone-label">
        <span>パートナー</span>
        {assisted && <span className="status-tag assist">アシスト中</span>}
        {mrRemoved && <span className="status-tag mr">MR リムーブ</span>}
      </div>

      <div className="partner-slot">
        {isOnBoard && partner !== null && meta !== null && (
          <>
            <div
              className={`card color-${meta.color}${partner.state === 'sleep' ? ' sleep' : ''}${partner.state === 'stun' ? ' stun' : ''}${isCandidate ? ' candidate' : ''}`}
              onClick={isCandidate && onClick ? onClick : undefined}
              style={isCandidate ? { cursor: 'pointer' } : undefined}
              data-card-id={partner.cardId}
            >
              <div className="color-stripe" />
              <div className="art">
                <CardArt cardId={partner.cardId} alt={meta.name} />
              </div>
              <div className="name">{meta.name}</div>
              <div className="stats">
                <span className="lp">LP {meta.lp}</span>
              </div>
            </div>
            <div className="partner-info">
              <span className="name">{meta.name}</span>
              <span className="meta">
                {COLOR_LABEL[meta.color]} / LP {meta.lp}
              </span>
              <span className="meta state" style={{ color: STATE_COLOR[partner.state] }}>
                ● {STATE_LABEL[partner.state]}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
