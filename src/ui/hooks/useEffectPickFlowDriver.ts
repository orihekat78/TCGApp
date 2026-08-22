// 公開UIの保留decisionをresolver順に監視するdriver。
// 現在のhuman ownerならmodalへ残し、それ以外は決定種別ごとの
// deterministic fallbackをengine authority付きでdispatchする。

import { useEffect } from 'react';
import { useGameStateStore } from '@/ui/state/store.js';
import { dispatchEngineAction } from './useEngineDispatch.js';
import { bindPendingDecision } from './useEngineDispatch/types.js';
import { isHumanDecisionOwner } from '@/ui/services/humanDecisionOwner.js';
import {
  effectivePendingPickRange,
  maximumFeasiblePendingPickSelection,
} from '@/engine/effect/pick-selection.js';
import {
  autonomousDeckPlacement,
  autonomousDeckReorder,
  chooseAutonomousReplacementTarget,
  chooseAutonomousRpsHand,
  chooseAutonomousSetCardInstance,
} from '@/engine/effect/autonomous-decision.js';

export function useEffectPickFlowDriver(enabled = true): void {
  const pending = useGameStateStore((s) => s.pendingEffectPick);
  const pendingChoice = useGameStateStore((s) => s.pendingEffectChoice);
  const pendingOptional = useGameStateStore((s) => s.pendingEffectOptional);
  const pendingChooseIntercept = useGameStateStore((s) => s.pendingChooseIntercept);
  const pendingRepeatOptional = useGameStateStore((s) => s.pendingEffectRepeatOptional);
  const pendingRps = useGameStateStore((s) => s.pendingRps);
  const pendingSetCardChoice = useGameStateStore((s) => s.pendingSetCardChoice);
  const pendingSetCardReplacement = useGameStateStore((s) => s.pendingSetCardReplacement);
  const pendingDeckReorder = useGameStateStore((s) => s.pendingDeckReorder);
  const pendingDeckPlace = useGameStateStore((s) => s.pendingDeckPlace);
  const spectatorMode = useGameStateStore((s) => s.spectatorMode);
  useEffect(() => {
    if (!enabled) return;
    if (pendingChoice) {
      if (!isHumanDecisionOwner(pendingChoice.player, spectatorMode)) {
        const choiceIndex = pendingChoice.options[0]?.index;
        if (choiceIndex !== undefined) {
          dispatchEngineAction(bindPendingDecision(pendingChoice, { type: 'choiceResolve', choiceIndex }));
        }
      }
      return;
    }

    if (pendingOptional) {
      if (!isHumanDecisionOwner(pendingOptional.player, spectatorMode)) {
        dispatchEngineAction(bindPendingDecision(pendingOptional, { type: 'optionalResolve', run: false }));
      }
      return;
    }

    if (pendingRepeatOptional) {
      if (!isHumanDecisionOwner(pendingRepeatOptional.player, spectatorMode)) {
        dispatchEngineAction(bindPendingDecision(
          pendingRepeatOptional,
          { type: 'repeatOptionalResolve', run: false },
        ));
      }
      return;
    }

    if (pendingChooseIntercept) {
      if (!isHumanDecisionOwner(pendingChooseIntercept.player, spectatorMode)) {
        if (pendingChooseIntercept.kind === 'order') {
          const first = pendingChooseIntercept.choices[0];
          if (first) {
            dispatchEngineAction(bindPendingDecision(pendingChooseIntercept, {
              type: 'chooseInterceptOrderResolve',
              protectorUid: first.protector.uid,
              targetUid: first.targetUid,
              ...(first.protector.abilityOrigin !== undefined
                ? {
                    abilityOrigin: first.protector.abilityOrigin,
                    abilityIndex: first.protector.abilityIndex,
                  }
                : {}),
              ...(first.protector.setCardInstanceId
                ? { setCardInstanceId: first.protector.setCardInstanceId }
                : {}),
            }));
          }
        } else {
          const hand = useGameStateStore.getState().gameState
            ?.players[pendingChooseIntercept.player].hand ?? [];
          dispatchEngineAction(bindPendingDecision(
            pendingChooseIntercept,
            { type: 'chooseInterceptResolve', discardIndex: hand.length > 0 ? 0 : null },
          ));
        }
      }
      return;
    }

    if (pendingRps) {
      if (!isHumanDecisionOwner(pendingRps.player, spectatorMode)) {
        dispatchEngineAction(bindPendingDecision(pendingRps, {
          type: 'rpsResolve',
          hand: chooseAutonomousRpsHand(pendingRps.aiHand),
        }));
      }
      return;
    }

    if (pendingSetCardChoice) {
      if (!isHumanDecisionOwner(pendingSetCardChoice.player, spectatorMode)) {
        const instanceId = chooseAutonomousSetCardInstance(pendingSetCardChoice.entries);
        if (instanceId !== null) {
          dispatchEngineAction(bindPendingDecision(pendingSetCardChoice, {
            type: 'setCardChoiceResolve',
            instanceId,
          }));
        }
      }
      return;
    }

    if (pendingSetCardReplacement) {
      if (!isHumanDecisionOwner(pendingSetCardReplacement.player, spectatorMode)) {
        dispatchEngineAction(bindPendingDecision(pendingSetCardReplacement, {
          type: 'setCardReplacementResolve',
          targetUid: chooseAutonomousReplacementTarget(pendingSetCardReplacement.candidates),
        }));
      }
      return;
    }

    if (pendingDeckReorder) {
      if (!isHumanDecisionOwner(pendingDeckReorder.player, spectatorMode)) {
        dispatchEngineAction(bindPendingDecision(pendingDeckReorder, {
          type: 'deckReorderResolve',
          order: autonomousDeckReorder(pendingDeckReorder.cardIds),
        }));
      }
      return;
    }

    if (pendingDeckPlace) {
      if (!isHumanDecisionOwner(pendingDeckPlace.ownerPlayer, spectatorMode)) {
        dispatchEngineAction(bindPendingDecision(pendingDeckPlace, {
          type: 'deckPlaceResolve',
          ...autonomousDeckPlacement(pendingDeckPlace.cardIds),
        }));
      }
      return;
    }

    if (pending && !isHumanDecisionOwner(pending.player, spectatorMode)) {
      const feasible = maximumFeasiblePendingPickSelection(pending);
      const range = effectivePendingPickRange(pending);
      const forcedCount = new Set(
        (pending.forcedUids ?? []).filter(uid => pending.candidates.some(candidate => candidate.uid === uid)),
      ).size;
      const selected = feasible.slice(0, Math.max(range.min, forcedCount, feasible.length > 0 ? 1 : 0));
      dispatchEngineAction(bindPendingDecision(pending, {
        type: 'effectPickResolve',
        pickedUid: selected[0] ?? null,
        ...(selected.length > 0 ? { pickedUids: selected } : {}),
      }));
    }
  }, [
    enabled,
    pending,
    pendingChoice,
    pendingOptional,
    pendingChooseIntercept,
    pendingRepeatOptional,
    pendingRps,
    pendingSetCardChoice,
    pendingSetCardReplacement,
    pendingDeckReorder,
    pendingDeckPlace,
    spectatorMode,
  ]);
}
