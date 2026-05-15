// Phase 7 Task 7.6: CaseArea
// プレイヤーの「事件」ゾーンを静的表示。
// 操作系 (解決判定 / 推理マーカー操作) は Phase 8。
// rules: 01-victory-conditions.md, 06-card-types.md §事件カード
// 視覚: design-mockups/01-board-mockup.html 1297-1311 (opp) / 1425-1437 (self),
//       CSS 516-585 行
// 由来: Claude Design (Research Preview) — engine 型に接続して取込み

import { Fragment } from 'react';
import type { JSX } from 'react';
import './CaseArea.css';

export type CaseColor = 'blue' | 'yellow' | 'red' | 'green' | 'purple';
export type CaseStatus = '事件編' | '解決編';

/**
 * 表示用の事件メタ。engine の `players[side].case` (cardId / status / requiredEvidence
 * / colors) を cards.json から解決した結果を渡す想定。
 */
export type CaseInfo = {
  cardId: string;
  title: string;            // 事件タイトル (例: "月光に潜む古城の影")
  color: CaseColor;         // 事件色 (mock の "EVT・青" のように表示)
  level: number;            // 事件レベル
  status: CaseStatus;
  requiredEvidence: number; // 7 (先攻) or 6 (後攻)
};

export type CaseAreaProps = {
  /** 事件メタ。null なら空ゾーン (ゲーム未開始) */
  caseInfo: CaseInfo | null;
  turnOrder: 'first' | 'second';
  side: 'self' | 'opp';
};

const COLOR_LABEL: Record<CaseColor, string> = {
  blue:   '青',
  yellow: '黄',
  red:    '赤',
  green:  '緑',
  purple: '紫',
};

const TURN_LABEL: Record<'first' | 'second', string> = {
  first:  '先攻',
  second: '後攻',
};

export function CaseArea(props: CaseAreaProps): JSX.Element {
  const { caseInfo, turnOrder, side } = props;

  if (caseInfo === null) {
    return (
      <div
        className={`case-area side-${side}`}
        data-side={side}
        data-turn-order={turnOrder}
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

  const { title, color, level, status, requiredEvidence } = caseInfo;
  const isResolved = status === '解決編';

  // タイトル中の \n を <br /> に変換
  const titleNodes = title.split(/\r?\n/).map((line, i, arr) => (
    <Fragment key={i}>
      {line}
      {i < arr.length - 1 ? <br /> : null}
    </Fragment>
  ));

  return (
    <div
      className={`case-area side-${side}`}
      data-side={side}
      data-turn-order={turnOrder}
    >
      <div className="zone case-zone">
        <div className="zone-label">
          <span>事件</span>
        </div>

        <div className={`case-card portrait color-${color}`} data-card-id={caseInfo.cardId}>
          <div className="case-title">{titleNodes}</div>
          <div className="case-meta">
            <span>EVT・{COLOR_LABEL[color]}</span>
            <span className="case-lv">Lv {level}</span>
          </div>
          <div className={`case-stamp${isResolved ? ' resolved' : ''}`}>
            {status}
          </div>
        </div>

        <div className="evidence-required">
          必要証拠 <strong>{requiredEvidence}</strong>（{TURN_LABEL[turnOrder]}）
        </div>
      </div>
    </div>
  );
}
