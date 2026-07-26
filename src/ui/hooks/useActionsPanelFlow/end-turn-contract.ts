import type { GameState } from '@/engine/types/game-state.js';
import { useGameStateStore } from '@/ui/state/store.js';
import { selectInteractionLocked } from '@/ui/state/interactionLock.js';
import { useConfirmationStore } from '../useConfirmation.js';
import { useTargetPickerStore } from '../useTargetPicker.js';
import { useNextHintPickerStore } from '../useNextHintPicker.js';
import { useSceneSwitchPickerStore } from '../useSceneSwitchPickerStore.js';
import { useEvidenceFlipPickerStore } from '../useEvidenceFlipPicker.js';
import { useHandCostPickerStore } from '../useHandCostPicker.js';
import { useStackedCardCostPickerStore } from '../useStackedCardCostPicker.js';
import { useChoicePickerStore } from '../useChoicePicker.js';
import { useDeclareNamePickerStore } from '../useDeclareNamePicker.js';
import { useContactModalStore } from '../useContactModalStore.js';

type Player = 'self' | 'opp';

type EndTurnBlockSource = {
  subscribe: (listener: () => void) => () => void;
  isBlocked: (state: GameState, player: Player) => boolean;
};

/**
 * 終了可否の読取りとsubscribeを同じ一覧で管理する。
 * source追加時に「判定に入れたが再描画はされない」分離を防ぐ。
 */
const END_TURN_BLOCK_SOURCES: readonly EndTurnBlockSource[] = [
  {
    subscribe: (listener) => useGameStateStore.subscribe(listener),
    isBlocked: (state) => {
      const store = useGameStateStore.getState();
      return (
        selectInteractionLocked({ ...store, gameState: state }) ||
        store.activeActionId !== null ||
        store.pendingDeckReorder !== null ||
        store.pendingDeckPlace !== null ||
        store.pendingRps !== null
      );
    },
  },
  {
    subscribe: (listener) => useTargetPickerStore.subscribe(listener),
    isBlocked: () => useTargetPickerStore.getState().phase.phase !== 'idle',
  },
  {
    subscribe: (listener) => useConfirmationStore.subscribe(listener),
    isBlocked: () => useConfirmationStore.getState().current !== null,
  },
  {
    subscribe: (listener) => useNextHintPickerStore.subscribe(listener),
    isBlocked: () => useNextHintPickerStore.getState().current !== null,
  },
  {
    subscribe: (listener) => useChoicePickerStore.subscribe(listener),
    isBlocked: () => useChoicePickerStore.getState().current !== null,
  },
  {
    subscribe: (listener) => useDeclareNamePickerStore.subscribe(listener),
    isBlocked: () => useDeclareNamePickerStore.getState().current !== null,
  },
  {
    subscribe: (listener) => useEvidenceFlipPickerStore.subscribe(listener),
    isBlocked: () => useEvidenceFlipPickerStore.getState().current !== null,
  },
  {
    subscribe: (listener) => useHandCostPickerStore.subscribe(listener),
    isBlocked: () => useHandCostPickerStore.getState().current !== null,
  },
  {
    subscribe: (listener) => useStackedCardCostPickerStore.subscribe(listener),
    isBlocked: () => useStackedCardCostPickerStore.getState().current !== null,
  },
  {
    subscribe: (listener) => useSceneSwitchPickerStore.subscribe(listener),
    isBlocked: () => useSceneSwitchPickerStore.getState().current !== null,
  },
  {
    subscribe: (listener) => useContactModalStore.subscribe(listener),
    isBlocked: () => {
      const contact = useContactModalStore.getState();
      return contact.guardPicker !== null || contact.cutInDisguise !== null;
    },
  },
];

/** render/flow/direct dispatcherが共有する唯一のターン終了契約。 */
export function canEndTurnByContract(state: GameState, player: Player): boolean {
  if (state.turn.player !== player || state.turn.phase !== 'main') return false;
  return !END_TURN_BLOCK_SOURCES.some((source) => source.isBlocked(state, player));
}

export function canEndTurnForUi(player: Player): boolean {
  const state = useGameStateStore.getState().gameState;
  return state !== null && canEndTurnByContract(state, player);
}

export function subscribeEndTurnContract(listener: () => void): () => void {
  const unsubscribers = END_TURN_BLOCK_SOURCES.map((source) => source.subscribe(listener));
  return () => {
    for (const unsubscribe of unsubscribers) unsubscribe();
  };
}
