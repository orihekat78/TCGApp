// 2026-05-28: ネクストヒント step2 picker modal
//
// rules: 12-next-hint.md
// spec: HiramekiPickerModal と同型の overlay modal
//
// 役割:
//   ネクストヒント宣言時に表示。step1 で引く FILE 最上部カード + step2 で使用可能な
//   手札カードを一覧提示し、ユーザに「使用するカード / 使用しない / キャンセル」を
//   選ばせる。useNextHintPickerStore を subscribe して open/close を制御。

import type { JSX } from 'react';
import { useNextHintPickerStore, useNextHintPicker } from '@/ui/hooks/useNextHintPicker.js';
import { CardArt } from './CardArt.js';
import './NextHintPickerModal.css';

export function NextHintPickerModal(): JSX.Element | null {
  const current = useNextHintPickerStore((s) => s.current);
  const picker = useNextHintPicker();
  if (current === null) return null;

  const { fileTopName, candidates } = current;

  return (
    <div
      className="next-hint-picker-overlay"
      role="dialog"
      aria-labelledby="next-hint-picker-title"
      aria-modal="true"
      data-testid="next-hint-picker-modal"
    >
      <div className="next-hint-picker-modal">
        <div className="next-hint-picker-header">
          <h2 id="next-hint-picker-title">ネクストヒント</h2>
          <p className="next-hint-picker-sub">
            FILE 最上部の〈{fileTopName}〉を手札に加えます。続けて 1 枚使用できます (任意)。
          </p>
        </div>

        <div className="next-hint-picker-body">
          {candidates.length === 0 ? (
            <p className="next-hint-picker-empty">
              使用可能なカードがありません (レベル / 色制限)。引くだけになります。
            </p>
          ) : (
            <ul className="next-hint-picker-list">
              {candidates.map((c, idx) => (
                <li key={`${c.cardId}-${c.source}-${idx}`}>
                  <button
                    type="button"
                    className="next-hint-picker-cand"
                    onClick={() => picker.acceptUse(c.cardId)}
                    data-testid={`next-hint-use-${c.cardId}`}
                  >
                    <CardArt cardId={c.cardId} alt={c.name} className="next-hint-picker-card-art" />
                    <span className="next-hint-picker-card-name">{c.name}</span>
                    <span className="next-hint-picker-card-meta">
                      Lv{c.level}・{c.kind === 'character' ? 'キャラ' : 'イベント'}
                      {c.source === 'file' ? '・FILEから引く' : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="next-hint-picker-actions">
          <button
            type="button"
            className="next-hint-picker-skip"
            onClick={() => picker.acceptSkip()}
            data-testid="next-hint-skip"
          >
            使用しない (引くだけ)
          </button>
          <button
            type="button"
            className="next-hint-picker-cancel"
            onClick={() => picker.acceptCancel()}
            data-testid="next-hint-cancel"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}
