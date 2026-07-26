// Phase 7 Task 7.5: PartnerArea
// プレイヤーのパートナーゾーン (1 枚) を静的表示。
// rules: 06-card-types.md §パートナー, 18-mr.md, 13-keywords.md §アシスト
// 視覚: design-mockups/01-board-mockup.html 1358-1378 (opp) / 1484-1505 (self)
// 操作系は Phase 8。

import type { JSX } from 'react';
import type { PartnerOnBoard, SceneCharacter } from '@/engine/types/game-state.js';
import type { ResolvedCardMeta } from './SceneArea.js';
import { CardArt } from './CardArt.js';
import './PartnerArea.css';

export type PartnerAreaProps = {
  partner: PartnerOnBoard | null;
  side: 'self' | 'opp';
  resolveCard: (cardId: string) => ResolvedCardMeta;
  /** engine wave-12 (G39): PA 一般カード枠 (「このカードをパートナーエリアに移す」で常駐したカード)。
   *  rules/03 §パートナーエリア — 枚数上限なし。undefined/空 = 非表示 (既存表示不変)。 */
  paCards?: string[];
  /** M3 PA batch (rules/18 §MR能力①): 相手ターン中に現場を離れた MR の常駐 slot。
   *  null/undefined = 非表示 (既存表示不変)。 */
  partnerAreaMR?: SceneCharacter | null;
  /** Phase 8.5: 推理/宣言能力/アシスト 対象選択中のハイライト */
  isCandidate?: boolean;
  /** Phase 8.5: 候補としてクリックされたとき。uid は親が知っている (`partner:self` 等)。 */
  onClick?: () => void;
  /** M3 PA batch: PA-MR が宣言能力 source 候補のとき (uid `partnerMR:${side}` は親が知っている) */
  isMrCandidate?: boolean;
  onMrClick?: () => void;
  /** Round 4l (BUG-001): 候補でないとき click で expand modal を開く */
  onExpand?: (cardId: string) => void;
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
  black:  '黒',
  white:  '白',
};

/**
 * パートナーカードの表示。location='partner-area' のときのみカードを描画し、
 * 'file-area' (アシスト中) / 'mr-removed' (MR リムーブ) のときは
 * キーホール透かしのみ + 状態ラベルを表示する。
 */
export function PartnerArea({ partner, side, resolveCard, paCards, partnerAreaMR, isCandidate, onClick, isMrCandidate, onMrClick, onExpand }: PartnerAreaProps): JSX.Element {
  const isOnBoard = partner !== null && partner.location === 'partner-area';
  const assisted  = partner !== null && partner.location === 'file-area';
  const mrRemoved = partner !== null && partner.location === 'mr-removed';

  const meta = isOnBoard ? resolveCard(partner.cardId) : null;
  const mrMeta = partnerAreaMR != null ? resolveCard(partnerAreaMR.cardId) : null;

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
              onClick={
                isCandidate && onClick
                  ? onClick
                  : onExpand
                    ? () => onExpand(partner.cardId)
                    : undefined
              }
              style={isCandidate || onExpand ? { cursor: 'pointer' } : undefined}
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
        {/* M3 PA batch (rules/18 §MR能力①): PA 常駐 MR — パートナーと同 slot に並べて描画。
            宣言能力 source 候補 (isMrCandidate) のとき既存 .card.candidate pulse を流用。 */}
        {partnerAreaMR != null && mrMeta !== null && (
          <div
            className={`card pa-mr color-${mrMeta.color}${partnerAreaMR.state === 'sleep' ? ' sleep' : ''}${partnerAreaMR.state === 'stun' ? ' stun' : ''}${isMrCandidate ? ' candidate' : ''}`}
            onClick={
              isMrCandidate && onMrClick
                ? onMrClick
                : onExpand
                  ? () => onExpand(partnerAreaMR.cardId)
                  : undefined
            }
            style={isMrCandidate || onExpand ? { cursor: 'pointer' } : undefined}
            data-card-id={partnerAreaMR.cardId}
            data-testid={`pa-mr-${side}`}
          >
            <div className="color-stripe" />
            <div className="art">
              <CardArt cardId={partnerAreaMR.cardId} alt={mrMeta.name} />
            </div>
            <div className="name">{mrMeta.name}</div>
            <div className="stats">
              <span className="mr-state" style={{ color: STATE_COLOR[partnerAreaMR.state] }}>
                MR ● {STATE_LABEL[partnerAreaMR.state]}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* engine wave-12 (G39): PA 一般カード枠 — 「このカードをパートナーエリアに移す」常駐カード (上限なし) */}
      {paCards !== undefined && paCards.length > 0 && (
        <div className="pa-cards" data-testid={`pa-cards-${side}`}>
          {paCards.map((cardId, i) => {
            const m = resolveCard(cardId);
            const expand = (): void => onExpand?.(cardId);
            const detailLabel = `${m.name}${paCards.length > 1 ? `（${i + 1}枚目）` : ''}の詳細を表示`;
            return (
              <div
                key={`${cardId}#${i}`}
                className={`pa-card color-${m.color}`}
                data-card-id={cardId}
              >
                <div
                  className="pa-card-select"
                  data-testid={`pa-card-${side}-${i}`}
                >
                  <CardArt cardId={cardId} alt="" />
                  <span className="pa-card-name">{m.name}</span>
                </div>
                {onExpand && (
                  <button
                    type="button"
                    className="pa-card-detail"
                    data-testid={`pa-card-detail-${side}-${i}`}
                    aria-label={detailLabel}
                    onClick={expand}
                  >
                    <span aria-hidden="true">🔍</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
