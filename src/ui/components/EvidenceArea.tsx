// Phase 7 Task 7.9: EvidenceArea
// 証拠ゾーン (裏向き縦カードスタック + 必要証拠進捗) を静的表示。
// 操作系 (クリック→展開モーダル) は Phase 8。アクセシビリティ属性のみ付与。
// rules: 01-victory-conditions.md (先攻 7 / 後攻 6)
// 視覚: design-mockups/01-board-mockup.html 1312-1322 (opp) / 1438-1449 (self)
// 由来: Claude Design (Research Preview) — engine 型に接続して取込み

import type { JSX } from 'react';
import './EvidenceArea.css';

// ------------------------------------------------------------------
// 型
// ------------------------------------------------------------------

export type EvidenceAreaProps = {
  /** 現在の証拠枚数 (0..requiredEvidence+) */
  count: number;
  /** 必要証拠数 (先攻=7 / 後攻=6) */
  requiredEvidence: number;
  side: 'self' | 'opp';
  /** Round 2: エリアクリックで内容モーダルを開く callback */
  onClick?: () => void;
};

// ------------------------------------------------------------------
// 本体
// ------------------------------------------------------------------

export function EvidenceArea(props: EvidenceAreaProps): JSX.Element {
  const { count, requiredEvidence, side, onClick } = props;

  const safeCount = Math.max(0, count);
  const fillPct = Math.min(
    100,
    (safeCount / Math.max(1, requiredEvidence)) * 100,
  );
  const isEmpty = safeCount === 0;
  const isComplete = safeCount >= requiredEvidence;

  return (
    <div
      className={`zone evidence-zone evidence-area side-${side}${
        isComplete ? ' complete' : ''
      }`}
      role="button"
      tabIndex={0}
      aria-label={`${side === 'self' ? '自分の' : '相手の'}証拠 ${safeCount} / ${requiredEvidence} 枚${onClick ? ' (クリックで内容表示)' : ''}`}
      data-side={side}
      data-count={safeCount}
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      <div className="zone-label">
        <span>証拠</span>
        <span className="count">
          {safeCount} / {requiredEvidence}
        </span>
      </div>

      <div className="stack-display evidence">
        {!isEmpty && (
          <>
            <div className="stack-shadow s3" aria-hidden="true" />
            <div className="stack-shadow s2" aria-hidden="true" />
            <div className="stack-shadow s1" aria-hidden="true" />
            <div className="card-back" aria-hidden="true">
              <div className="monogram">DC</div>
              <div className="magnifier" />
            </div>
          </>
        )}
        {/* Phase 8.10g: count-overlay は count 値を key にして remount → CSS animation 再起動 */}
        <div className="count-overlay" key={safeCount}>{safeCount}</div>
      </div>

      <div
        className="progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={requiredEvidence}
        aria-valuenow={Math.min(safeCount, requiredEvidence)}
      >
        <div className="progress-fill" style={{ width: `${fillPct}%` }} />
      </div>
    </div>
  );
}

export default EvidenceArea;
