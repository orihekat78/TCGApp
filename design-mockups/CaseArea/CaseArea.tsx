// CaseArea.tsx
// プレイヤーの「事件」ゾーンを静的表示するコンポーネント。
// Phase 8 では操作系 (解決判定 / 推理マーカー操作) は実装しない。
//
// 依存: CaseArea.css を読み込んでおくこと。
// クラス名は design-mockups/01-board-mockup.html の構造を流用しています。

import * as React from 'react';

// ------------------------------------------------------------------
// 型 (外部から import できるよう export)
// ------------------------------------------------------------------

export type CaseColor = 'blue' | 'yellow' | 'red' | 'green' | 'purple';

export type CaseStatus = '事件編' | '解決編';

export type CaseInfo = {
  cardId: string;
  title: string;            // 事件タイトル (例: "月光に潜む古城の影")
  color: CaseColor;         // 事件色 (mock では "EVT・青" のように表示)
  level: number;            // 事件レベル (例: 7)
  status: CaseStatus;
  requiredEvidence: number; // 7 (先攻) or 6 (後攻)
};

export type CaseAreaProps = {
  case: CaseInfo;
  turnOrder: 'first' | 'second';
  side: 'self' | 'opp';
};

// ------------------------------------------------------------------
// 補助
// ------------------------------------------------------------------

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

// ------------------------------------------------------------------
// CaseArea 本体
// ------------------------------------------------------------------

export function CaseArea(props: CaseAreaProps): JSX.Element {
  // 'case' は予約語に近いため分割代入では別名にする
  const { case: caseInfo, turnOrder, side } = props;
  const { title, color, level, status, requiredEvidence } = caseInfo;

  const isResolved = status === '解決編';

  // タイトルは <br> を含む可能性があるため、改行コードと | で簡易分割可能にしておく
  // ここでは title の '\n' を <br /> に変換するだけのシンプル実装
  const titleNodes = title.split(/\r?\n/).map((line, i, arr) => (
    <React.Fragment key={i}>
      {line}
      {i < arr.length - 1 ? <br /> : null}
    </React.Fragment>
  ));

  return (
    <div
      className={`case-col case-area side-${side}`}
      data-side={side}
      data-turn-order={turnOrder}
    >
      <div className="zone case-zone">
        <div className="zone-label">
          <span>事件</span>
        </div>

        <div className={`case-card portrait color-${color}`}>
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

export default CaseArea;
