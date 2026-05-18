// Round 2 — マリガン UI モーダル
//
// rules: 04-game-setup.md §5 (1回のみ、好きな枚数戻し→シャッフル→同枚数引き直し)
// spec: .claude/specs/2026-05-11-ui-game-setup-flows.md §マリガン
//
// 設計:
//   - useMulliganStore の current を購読し、null ならレンダリングしない
//   - 手札カードを横並びで表示、各カードクリックで「戻す/残す」トグル
//   - 「シャッフル & 引き直し」 button で resolveMulligan(selected)
//   - 「マリガンしない」 button で resolveMulligan([]) (= 権利消費だけ)
//   - Esc キーは扱わない (誤操作で skip 扱いされないように。明示 button で確定)
//
// アクセシビリティ: dialog role / aria-modal / aria-labelledby

import { useState, useMemo, type JSX } from 'react';
import { useMulliganStore, resolveMulligan } from '@/ui/hooks/useMulligan.js';
import { cardIdToDisplayName, cardIdToPrintedNumber } from '@/ui/services/uidNames.js';
import { CardArt } from './CardArt.js';
import './MulliganModal.css';

const PLAYER_LABEL: Record<'self' | 'opp', string> = {
  self: '自分',
  opp:  '相手',
};

export function MulliganModal(): JSX.Element | null {
  const current = useMulliganStore((s) => s.current);
  const [selectedIdx, setSelectedIdx] = useState<ReadonlySet<number>>(new Set());
  // Round 2: ユーザ追加要望 — クリック中のカードを拡大表示するための idx
  const [zoomIdx, setZoomIdx] = useState<number | null>(null);

  const handIds = current?.hand ?? null;
  const playerLabel = current ? PLAYER_LABEL[current.player] : '';

  // current 切替時に選択状態をリセット (useEffect 不要 — current null → 次 open 時に初期化)
  // useMemo で current ref が変わったら selectedIdx を空にする (React state は外で保持されるので
  // current key で identity 比較を入れる)
  // ※ シンプルさのため useEffect 不採用、current が変わるたび key prop でラップする手も可
  // ここでは local state で扱う

  const selectedIds = useMemo<ReadonlyArray<string>>(() => {
    if (!handIds) return [];
    const arr: string[] = [];
    for (const idx of selectedIdx) {
      const id = handIds[idx];
      if (id) arr.push(id);
    }
    return arr;
  }, [handIds, selectedIdx]);

  if (current === null || handIds === null) return null;

  const toggle = (idx: number): void => {
    const next = new Set(selectedIdx);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setSelectedIdx(next);
  };

  const openZoom = (idx: number): void => {
    setZoomIdx(idx);
  };

  const closeZoom = (): void => {
    setZoomIdx(null);
  };

  const handleConfirm = (): void => {
    setSelectedIdx(new Set());
    setZoomIdx(null);
    resolveMulligan(selectedIds);
  };

  const handleSkip = (): void => {
    setSelectedIdx(new Set());
    setZoomIdx(null);
    resolveMulligan([]);
  };

  const returnCount = selectedIdx.size;

  return (
    <div
      className="mulligan-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mulligan-modal-title"
    >
      <div className="mulligan-modal">
        <header className="mulligan-modal-header">
          <h2 id="mulligan-modal-title">引き直し ({playerLabel}手番)</h2>
          <p className="mulligan-modal-subtitle">
            戻すカードを選んでデッキに戻し、同じ枚数を引き直せます (1ゲーム 1回まで)。
          </p>
        </header>

        <div className="mulligan-cards-row">
          {handIds.map((cardId, idx) => {
            const isSelected = selectedIdx.has(idx);
            const name = cardIdToDisplayName(cardId);
            // Round 2 ユーザ指摘: 内部 ID (D08022) ではなくカード画像下部に印刷
            // されている公式番号 (0091) を表示することで視覚的に紐付けやすくする
            const printedNumber = cardIdToPrintedNumber(cardId);
            return (
              <div
                key={`${cardId}-${idx}`}
                className={`mulligan-card-wrap${isSelected ? ' selected' : ''}`}
              >
                <button
                  type="button"
                  className="mulligan-card-toggle"
                  aria-pressed={isSelected}
                  aria-label={`${name} No.${printedNumber} ${isSelected ? '(戻す予定)' : ''}`}
                  onClick={() => toggle(idx)}
                >
                  <CardArt
                    cardId={cardId}
                    alt={name}
                    className="mulligan-card-art"
                  />
                  <div className="mulligan-card-name">{name}</div>
                  <div className="mulligan-card-id">No.{printedNumber}</div>
                  {isSelected && <div className="mulligan-card-mark">戻す</div>}
                </button>
                <button
                  type="button"
                  className="mulligan-card-zoom"
                  aria-label={`${name} を拡大表示`}
                  onClick={() => openZoom(idx)}
                  title="拡大"
                >
                  🔍
                </button>
              </div>
            );
          })}
        </div>

        {/* 拡大表示オーバーレイ — Round 2 ユーザ追加要望 */}
        {zoomIdx !== null && handIds[zoomIdx] !== undefined && (
          <div
            className="mulligan-zoom-overlay"
            role="dialog"
            aria-label="カード拡大表示"
            onClick={closeZoom}
          >
            <div
              className="mulligan-zoom-content"
              onClick={(e) => e.stopPropagation()}
            >
              <CardArt
                cardId={handIds[zoomIdx]}
                alt={cardIdToDisplayName(handIds[zoomIdx])}
                className="mulligan-zoom-art"
              />
              <div className="mulligan-zoom-info">
                <div className="mulligan-zoom-name">
                  {cardIdToDisplayName(handIds[zoomIdx])}
                </div>
                <div className="mulligan-zoom-id">
                  No.{cardIdToPrintedNumber(handIds[zoomIdx])}
                </div>
              </div>
              <button
                type="button"
                className="mulligan-zoom-close"
                onClick={closeZoom}
              >
                閉じる
              </button>
            </div>
          </div>
        )}

        <footer className="mulligan-modal-footer">
          <button
            type="button"
            className="mulligan-skip"
            onClick={handleSkip}
          >
            引き直しなし
          </button>
          <button
            type="button"
            className="mulligan-confirm"
            onClick={handleConfirm}
            disabled={returnCount === 0}
            autoFocus
          >
            {returnCount === 0
              ? 'カードを選択してください'
              : `${returnCount} 枚 戻して引き直し`}
          </button>
        </footer>
      </div>
    </div>
  );
}

export default MulliganModal;
