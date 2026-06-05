// BUG-121: enter トリガ等の human 複数 option choice を surface する store 駆動 modal。
//
// rules: 15-abilities-effects.md (「以下から1つ選んで行う」= プレイヤー択一・必須効果)
//
// 役割:
//   - store.pendingEffectChoice を subscribe (resolve-picks が pause 時に side-channel set →
//     useEngineDispatch drain で本 field に転送)。
//   - pending.player === 'self' のとき既存 ChoicePickerModal (testid choice-picker-modal / cp-opt-N)
//     を再利用して択一を表示。option クリック → choiceResolve dispatch。
//   - choice は必須効果のため cancel 不可 (onCancel は no-op、modal は選択するまで閉じない)。
//
// 既存の declared-ability choice (useChoicePicker + useActionsPanelFlow:606 の Promise 経路) とは別系統。
// declared は dispatch 前 await、enter は dispatch 後 store surface で時系列が重ならない。

import type { JSX } from 'react';
import type { Effect } from '@/engine/types';
import { useGameStateStore } from '@/ui/state/store.js';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch.js';
import { choiceOptionLabel } from '@/ui/hooks/useActionsPanelFlow.js';
import { def as readDef } from '@/engine/read/def.js';
import { ChoicePickerModal } from './ChoicePickerModal.js';

export function EffectChoiceModalHost(): JSX.Element | null {
  const pending = useGameStateStore((s) => s.pendingEffectChoice);
  if (!pending || pending.player !== 'self') return null;

  const sourceName = pending.source.cardId
    ? readDef.card(pending.source.cardId)?.names?.[0] ?? pending.source.cardId
    : '効果';

  const options = pending.options.map((o) => ({
    index: o.index,
    label: o.verb
      ? choiceOptionLabel({ kind: 'atom', verb: o.verb, args: o.args ?? {} } as Effect)
      : `効果 ${o.index + 1}`,
  }));

  const handlePick = (index: number): void => {
    dispatchEngineAction({ type: 'choiceResolve', choiceIndex: index });
  };

  return (
    <ChoicePickerModal
      open
      sourceName={sourceName}
      options={options}
      onPick={handlePick}
      onCancel={() => {
        // enter トリガの choice は必須効果 (rules/15)。cancel 不可 — modal は option 選択まで閉じない。
      }}
    />
  );
}
