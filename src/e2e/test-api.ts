import {
  appendCausal,
  mutate,
  runAtom,
  startCausalSession,
} from '../engine/index.js';
import {
  persistPendingRuntimeState,
  resetPendingRuntimeState,
} from '../engine/effect/runtime-state.js';
import { produce } from '../engine/produce.js';
import { useMulliganStore } from '../ui/hooks/useMulligan.js';
import { useTargetPickerStore } from '../ui/hooks/useTargetPicker.js';
import { resetPresentationQueue } from '../ui/presentation/coordinator.js';
import { surfacePendingSideChannels } from '../ui/state/surface-pending.js';
import { deckOccurrenceAuthority } from '../engine/effect/deck-occurrence-authority.js';

export const e2eTestApi = {
  appendCausal,
  deckOccurrenceAuthority,
  mutate,
  persistPendingRuntimeState,
  produce,
  resetPendingRuntimeState,
  resetPresentationQueue,
  runAtom,
  startCausalSession,
  surfacePendingSideChannels,
  useMulliganStore,
  useTargetPickerStore,
};
