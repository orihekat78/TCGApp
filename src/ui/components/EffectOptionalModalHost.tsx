// 2026-06-06 タスクC: optional (「〜してもよい」) を surface する store 駆動 modal。
//
// rules: 15-abilities-effects.md (「〜してもよい」= プレイヤー任意・行わない選択が可能)
//
// 役割:
//   - store.pendingEffectOptional を subscribe (resolve-picks の optional case が pause 時に
//     side-channel set → useEngineDispatch drain で本 field に転送)。
//   - pending.player === 'self' のとき「する / しない」択一を表示。発動カード名 + ability の
//     description を提示し、テキスト文言通りの任意効果かを確認できるようにする (§7 text-faithfulness)。
//   - する → optionalResolve(run:true) / しない → optionalResolve(run:false)。
//   - 「〜してもよい」は任意効果のため cancel = しない (run:false) と同義。
//
// EffectChoiceModalHost (複数 option choice、必須) と別系統。optional は boolean 決定 (する/しない)。

import type { JSX } from 'react';
import { useGameStateStore } from '@/ui/state/store.js';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch.js';
import { def as readDef } from '@/engine/read/def.js';
import './ChoicePickerModal.css';

export function EffectOptionalModalHost(): JSX.Element | null {
  const pending = useGameStateStore((s) => s.pendingEffectOptional);
  if (!pending || pending.player !== 'self') return null;

  const def = pending.source.cardId ? readDef.card(pending.source.cardId) : undefined;
  const sourceName = def?.names?.[0] ?? pending.source.cardId ?? '効果';
  const desc = def?.abilities?.find((a) => a.id === pending.source.abilityId)?.description ?? '';

  const resolve = (run: boolean): void => {
    dispatchEngineAction({ type: 'optionalResolve', run });
  };

  return (
    <div
      className="cp-overlay"
      role="dialog"
      aria-labelledby="opt-title"
      aria-modal="true"
      data-testid="optional-picker-modal"
    >
      <div className="cp-modal">
        <div className="cp-header">
          <h2 id="opt-title">任意効果</h2>
          <p className="cp-sub">{desc ? `${sourceName}: ${desc}` : `${sourceName}: 効果を使いますか?`}</p>
        </div>
        <div className="cp-body"><p className="cp-sub">Choose whether to continue.</p></div>
        <div className="cp-actions">
          <ul className="cp-list">
            <li>
              <button type="button" className="cp-cand" onClick={() => resolve(true)} data-testid="opt-run-yes">
                する
              </button>
            </li>
            <li>
              <button type="button" className="cp-cand" onClick={() => resolve(false)} data-testid="opt-run-no">
                しない
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
