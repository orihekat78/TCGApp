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
import { bindPendingDecision } from '@/ui/hooks/useEngineDispatch/types.js';
import { choiceOptionLabel } from '@/ui/hooks/useActionsPanelFlow.js';
import { def as readDef } from '@/engine/read/def.js';
import { sceneCap } from '@/engine/read/scene-cap.js';
import { useSceneSwitchPickerStore } from '@/ui/hooks/useSceneSwitchPickerStore.js';
import { currentInteractionEpoch, isCurrentLiveInteraction } from '@/ui/services/terminalInteractionGate.js';
import { ChoicePickerModal } from './ChoicePickerModal.js';
import { LinkedPublicHandReveal } from './PublicHandRevealWindow.js';
import { isHumanDecisionOwner } from '@/ui/services/humanDecisionOwner.js';
import { effectSourceDisplayName } from '@/ui/services/uidNames.js';

export function EffectChoiceModalHost(): JSX.Element | null {
  const pending = useGameStateStore((s) => s.pendingEffectChoice);
  const gameState = useGameStateStore((s) => s.gameState);
  const spectatorMode = useGameStateStore((s) => s.spectatorMode);
  const switchPicker = useSceneSwitchPickerStore((s) => s.current);
  // The switch surface is a direct-manipulation layer in Playmat. Suspend this
  // full-screen host while it owns the next decision; otherwise .cp-overlay
  // catches every pointer event above the scene cards.
  if (!pending || !isHumanDecisionOwner(pending.player, spectatorMode) || switchPicker) return null;

  const sourceName = effectSourceDisplayName(pending.source, { gameState });

  const options = pending.options.map((o) => ({
    index: o.index,
    label: o.label ?? (o.verb
      ? choiceOptionLabel({ kind: 'atom', verb: o.verb, args: o.args ?? {} } as Effect)
      : `効果 ${o.index + 1}`),
  }));

  const handlePick = async (index: number): Promise<void> => {
    const option = pending.options.find((candidate) => candidate.index === index);
    const state = useGameStateStore.getState().gameState;
    const isB04030EnterChoice = (pending.source.cardId === 'B04030' || pending.source.cardId === 'B04030P')
      && option?.index === 1;
    if (isB04030EnterChoice && state && state.players[pending.player].scene.length >= sceneCap(state, pending.player)) {
      const interactionEpoch = currentInteractionEpoch();
      const candidates = state.players[pending.player].scene.map((character) => ({
        uid: character.uid,
        cardId: character.cardId,
        name: readDef.card(character.cardId)?.names?.[0] ?? character.cardId,
        state: character.state,
        isNamed: character.isNamed,
      }));
      const switchRemoveUid = await new Promise<string | null>((resolve) => {
        useSceneSwitchPickerStore.getState()._open({
          player: pending.player,
          cardId: '', newCardName: '登場するキャラ', candidates, resolve,
        });
      });
      if (!isCurrentLiveInteraction(interactionEpoch)) return;
      if (switchRemoveUid !== null) {
        dispatchEngineAction(bindPendingDecision(
          pending,
          { type: 'choiceResolve', choiceIndex: index, switchRemoveUid },
        ));
      } else {
        dispatchEngineAction(bindPendingDecision(pending, { type: 'choiceResolve', choiceIndex: index }));
      }
      return;
    }
    dispatchEngineAction(bindPendingDecision(pending, { type: 'choiceResolve', choiceIndex: index }));
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
      contentBeforeOptions={(
        <LinkedPublicHandReveal resolutionToken={pending.publicHandRevealToken} />
      )}
    />
  );
}
