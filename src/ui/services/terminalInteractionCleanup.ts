import { cancelChoicePicker } from '@/ui/hooks/useChoicePicker';
import { rejectPendingConfirmation } from '@/ui/hooks/useConfirmation';
import { useContactModalStore } from '@/ui/hooks/useContactModalStore';
import { _resetCutinDemoDriver } from '@/ui/hooks/useCutinDemoDriver';
import { cancelDeclareNamePicker } from '@/ui/hooks/useDeclareNamePicker';
import { cancelEvidenceFlipPicker } from '@/ui/hooks/useEvidenceFlipPicker';
import { cancelHandCostPicker } from '@/ui/hooks/useHandCostPicker';
import { useMulliganStore, resolveMulligan } from '@/ui/hooks/useMulligan';
import { cancelNextHintPicker } from '@/ui/hooks/useNextHintPicker';
import { _resetIsDriving } from '@/ui/hooks/useOppTurnDriver';
import { useSceneSwitchPickerStore } from '@/ui/hooks/useSceneSwitchPickerStore';
import { cancelSetCardCostChoice } from '@/ui/hooks/useSetCardCostPicker';
import { _resetSpectatorDriving } from '@/ui/hooks/useSpectatorTurnDriver';
import { cancelStackedCardCostPicker } from '@/ui/hooks/useStackedCardCostPicker';
import { cancelTargetPicker } from '@/ui/hooks/useTargetPicker';
import { blockTerminalInteractions, reopenMatchInteractions } from './terminalInteractionGate.js';

function settleLiveInteractions(): void {
  const isolate = (settle: () => void): void => {
    try { settle(); } catch { /* one observer must not skip later settlers */ }
  };
  isolate(() => useContactModalStore.getState()._reset());
  isolate(cancelTargetPicker);
  isolate(rejectPendingConfirmation);
  isolate(cancelChoicePicker);
  isolate(cancelDeclareNamePicker);
  isolate(cancelEvidenceFlipPicker);
  isolate(cancelHandCostPicker);
  isolate(cancelNextHintPicker);
  isolate(cancelSetCardCostChoice);
  isolate(cancelStackedCardCostPicker);
  isolate(() => {
    const sceneSwitch = useSceneSwitchPickerStore.getState();
    sceneSwitch.current?.resolve(null);
    sceneSwitch._close();
  });
  isolate(() => { if (useMulliganStore.getState().current !== null) resolveMulligan([]); });
  isolate(_resetIsDriving);
  isolate(_resetSpectatorDriving);
  isolate(_resetCutinDemoDriver);
}

/** Settle live UI work after a terminal GameState commits. Presentation history stays owned elsewhere. */
export function cleanupTerminalInteractions(): void {
  blockTerminalInteractions();
  settleLiveInteractions();
}

/** Reset uses the same settlement primitives, then enables the next match session. */
export function resetLiveMatchInteractions(): void {
  settleLiveInteractions();
  reopenMatchInteractions();
}
