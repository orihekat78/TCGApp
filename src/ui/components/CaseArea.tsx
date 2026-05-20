// Phase 7 Task 7.6: CaseArea
// プレイヤーの「事件」ゾーンを静的表示。
// 操作系 (解決判定 / 推理マーカー操作) は Phase 8。
// rules: 01-victory-conditions.md, 06-card-types.md §事件カード
// 視覚: design-mockups/01-board-mockup.html 1297-1311 (opp) / 1425-1437 (self),
//       CSS 516-585 行
// 由来: Claude Design (Research Preview) — engine 型に接続して取込み

import { Fragment } from 'react';
import type { JSX } from 'react';
import { CardArt } from './CardArt.js';
import { useCardOrientation } from '../hooks/useCardOrientation.js';
import './CaseArea.css';

export type CaseColor = 'blue' | 'yellow' | 'red' | 'green' | 'purple';
export type CaseStatus = '事件編' | '解決編';

/**
 * 表示用の事件メタ。engine の `players[side].case` (cardId / status / requiredEvidence
 * / colors) を cards.json から解決した結果を渡す想定。
 */
export type CaseOrientation = 'portrait' | 'landscape';

export type CaseInfo = {
  cardId: string;
  title: string;            // 事件タイトル (例: "月光に潜む古城の影")
  color: CaseColor;         // 事件色 (mock の "EVT・青" のように表示)
  level: number;            // 事件レベル
  status: CaseStatus;
  requiredEvidence: number; // 7 (先攻) or 6 (後攻)
  /** カードの向き。MVP の CT-D08/CT-D11 は portrait。promo / 拡張 で landscape
   *  が混ざる場合があるため、cards.json に orientation 情報が追加されたら
   *  cardResolvers 経由で渡す。default は portrait。 */
  orientation?: CaseOrientation;
};

export type CaseAreaProps = {
  /** 事件メタ。null なら空ゾーン (ゲーム未開始) */
  caseInfo: CaseInfo | null;
  turnOrder: 'first' | 'second';
  side: 'self' | 'opp';
  /** Phase 8.7a: アクション対象候補ハイライト */
  isCandidate?: boolean;
  /** Phase 8.7a: クリックで pick+confirm を 1 タップ完結 */
  onClick?: () => void;
  /** Round 4l (BUG-001): 候補でないとき click で expand modal を開く */
  onExpand?: (cardId: string) => void;
};

const TURN_LABEL: Record<'first' | 'second', string> = {
  first:  '先攻',
  second: '後攻',
};

export function CaseArea(props: CaseAreaProps): JSX.Element {
  const { caseInfo, turnOrder, side, isCandidate, onClick, onExpand } = props;
  const rootClass = `case-area side-${side}${isCandidate ? ' case-area--candidate' : ''}`;
  // Round 4l (BUG-001): isCandidate=true なら action onClick、false かつ onExpand 提供時は expand
  const effectiveClick = isCandidate && onClick
    ? onClick
    : onExpand && caseInfo?.cardId
      ? () => onExpand(caseInfo.cardId as string)
      : undefined;
  const interactiveProps = effectiveClick
    ? { onClick: effectiveClick, style: { cursor: 'pointer' as const } }
    : {};

  // Phase 9-D: cardId 画像から向きを自動判定。
  // 優先順: props.orientation 明示 > 画像実測 > portrait fallback。
  // Rules of Hooks: hook は early-return より前に必ず呼ぶ。caseInfo===null 経路でも
  // 同じ hook 数を維持しないと React 19 が "Expected static flag" を投げる。
  // null/undefined は useCardOrientation 側で受理済 (placeholder 経路に分岐)。
  const detectedOrientation = useCardOrientation(caseInfo?.cardId);

  if (caseInfo === null) {
    return (
      <div
        className={rootClass}
        data-side={side}
        data-turn-order={turnOrder}
        {...interactiveProps}
      >
        <div className="zone case-zone">
          <div className="zone-label">
            <span>事件</span>
          </div>
          <div className="case-empty" aria-label="事件未開始">未開始</div>
        </div>
      </div>
    );
  }

  // Round 3: status は Playmat 側 case-edition-tag で表示するため CaseArea では未使用に
  const { title, color, requiredEvidence } = caseInfo;
  // Round 3: isResolved は case-stamp 削除に伴い未使用に。Playmat の case-edition-tag 側で使用。
  const orientation = caseInfo.orientation ?? detectedOrientation ?? 'portrait';

  // タイトル中の \n を <br /> に変換
  const titleNodes = title.split(/\r?\n/).map((line, i, arr) => (
    <Fragment key={i}>
      {line}
      {i < arr.length - 1 ? <br /> : null}
    </Fragment>
  ));

  return (
    <div
      className={rootClass}
      data-side={side}
      data-turn-order={turnOrder}
      {...interactiveProps}
    >
      <div className="zone case-zone">
        <div className="zone-label">
          <span>事件</span>
        </div>

        <div
          className={`case-card ${orientation} color-${color}`}
          data-card-id={caseInfo.cardId}
          data-orientation={orientation}
        >
          <CardArt cardId={caseInfo.cardId} alt="" className="case-bg" />
          <div className="case-title">{titleNodes}</div>
          {/* Round 2: EVT-色 + Lv 表記は冗長 (タイトルとカード画像で十分判別可能) → 削除済
              Round 3: case-stamp も削除。事件編/解決編 は Playmat 側の余白に独立 tag で表示。 */}
        </div>

        <div className="evidence-required">
          必要証拠 <strong>{requiredEvidence}</strong>（{TURN_LABEL[turnOrder]}）
        </div>
      </div>
    </div>
  );
}
