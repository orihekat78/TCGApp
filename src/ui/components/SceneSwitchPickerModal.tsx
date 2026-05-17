// Phase 8 完全クローズ Commit 4: SceneSwitchPickerModal (scaffold)
//
// rules: 20-color-and-switch.md §スイッチ
// spec: 計画 — Commit 4
//
// 役割:
//   - 現場 5 枚が埋まっている状態で新キャラが登場する際、リムーブする 1 体を選択
//   - rules/20: 名乗り状態 / スリープ / スタン 全て対象
//
// 注: MVP デッキでは現場 5 枚到達 + キャラ登場が極めて稀。本モーダルは Phase 5 で
//     実カード追加または高密度プレイ時に発動。Commit 4 は scaffold (UI + SSR) のみ。

import type { JSX } from 'react';
import './SceneSwitchPickerModal.css';

export type SceneSwitchCharView = {
  uid: string;
  cardId: string;
  name: string;
  state: 'active' | 'sleep' | 'stun';
  isNamed: boolean;
};

export type SceneSwitchPickerModalProps = {
  open: boolean;
  /** 現場の全キャラ (リムーブ候補) */
  sceneChars: readonly SceneSwitchCharView[];
  /** 新たに登場するキャラ名 (ヘッダ表示用) */
  newCardName: string;
  onPick: (removeUid: string) => void;
  onCancel: () => void;
};

export function SceneSwitchPickerModal(props: SceneSwitchPickerModalProps): JSX.Element | null {
  const { open, sceneChars, newCardName, onPick, onCancel } = props;
  if (!open) return null;
  return (
    <div
      className="ssp-overlay"
      role="dialog"
      aria-labelledby="ssp-title"
      aria-modal="true"
      data-testid="scene-switch-modal"
    >
      <div className="ssp-modal">
        <div className="ssp-header">
          <h2 id="ssp-title">スイッチ</h2>
          <p className="ssp-sub">{`${newCardName} を登場させるためにリムーブするキャラを選んでください`}</p>
        </div>
        <div className="ssp-body">
          {sceneChars.length === 0 ? (
            <p className="ssp-empty">現場にキャラがいません</p>
          ) : (
            <ul className="ssp-list">
              {sceneChars.map((c) => (
                <li key={c.uid}>
                  <button
                    type="button"
                    className="ssp-cand"
                    onClick={() => onPick(c.uid)}
                    data-testid={`ssp-cand-${c.uid}`}
                  >
                    <span className="ssp-name">{c.name}</span>
                    <span className="ssp-state">{`[${c.state}${c.isNamed ? '/名乗り' : ''}]`}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="ssp-actions">
          <button
            type="button"
            className="ssp-btn ssp-btn-cancel"
            onClick={onCancel}
            data-testid="ssp-cancel-btn"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}
