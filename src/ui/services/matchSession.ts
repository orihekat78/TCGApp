import type { GameState } from '@/engine/types/game-state';
import { flow, _resetPendingHirameki, _resetPendingMisread } from '@/engine';
import { resetPendingEffectSession } from '@/engine/effect/pending-state';
import { resetRuntimeAtomTargetPolicySession } from '@/engine/effect/resolve-picks';
import { resetPendingAtomSession } from '@/engine/effect/atom-handlers';
import { cancelChoicePicker } from '@/ui/hooks/useChoicePicker';
import { rejectPendingConfirmation } from '@/ui/hooks/useConfirmation';
import { useContactModalStore } from '@/ui/hooks/useContactModalStore';
import { cancelDeclareNamePicker } from '@/ui/hooks/useDeclareNamePicker';
import { cancelEvidenceFlipPicker } from '@/ui/hooks/useEvidenceFlipPicker';
import { cancelHandCostPicker } from '@/ui/hooks/useHandCostPicker';
import { useMulliganStore, resolveMulligan } from '@/ui/hooks/useMulligan';
import { cancelNextHintPicker } from '@/ui/hooks/useNextHintPicker';
import { useSceneSwitchPickerStore } from '@/ui/hooks/useSceneSwitchPickerStore';
import { cancelStackedCardCostPicker } from '@/ui/hooks/useStackedCardCostPicker';
import { cancelTargetPicker } from '@/ui/hooks/useTargetPicker';
import { _resetIsDriving } from '@/ui/hooks/useOppTurnDriver';
import { _resetSpectatorDriving } from '@/ui/hooks/useSpectatorTurnDriver';
import { MATCH_SESSION_RESET_STATE, useGameStateStore } from '@/ui/state/store';
import { _setHumanPlayerSide } from '@/engine/listeners/triggered';
import { _resetResolutionLock } from '@/engine/resolve/stack';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { usePresentationStore } from '@/ui/presentation/store';
import {
  discardLiveReplayRecording,
  finalizeLiveReplayRecording,
  startLiveReplayRecording,
} from '@/ui/services/liveReplayRecorder';
import { matchSessionId, type MatchSessionToken } from '@/ui/services/matchSessionId';

export { matchSessionId, type MatchSessionToken } from '@/ui/services/matchSessionId';

let currentGeneration = 0;
let matchSessionActive = false;

/** Promise を先に決着させ、その後に対戦の UI/engine 一時状態を破棄する。 */
export function resetMatchSession(options: { preserveGameState?: boolean } = {}): void {
  const preservedGameState = options.preserveGameState
    ? useGameStateStore.getState().gameState
    : null;
  _setHumanPlayerSide(null);
  cancelTargetPicker();
  rejectPendingConfirmation();
  cancelChoicePicker();
  cancelDeclareNamePicker();
  cancelEvidenceFlipPicker();
  cancelHandCostPicker();
  cancelNextHintPicker();
  cancelStackedCardCostPicker();

  const sceneSwitch = useSceneSwitchPickerStore.getState();
  sceneSwitch.current?.resolve(null);
  sceneSwitch._close();

  if (useMulliganStore.getState().current !== null) resolveMulligan([]);
  useContactModalStore.getState()._reset();
  _resetIsDriving();
  _resetSpectatorDriving();

  // Direct setState also upgrades a long-running Vite/HMR store instance that
  // predates resetMatchSessionState; READY must not throw on the first click.
  useGameStateStore.setState(options.preserveGameState
    ? { ...MATCH_SESSION_RESET_STATE, gameState: preservedGameState }
    : MATCH_SESSION_RESET_STATE);
  flow.action._resetActionContexts();
  _resetResolutionLock();
  resetPendingEffectSession();
  resetRuntimeAtomTargetPolicySession();
  resetPendingAtomSession();
  _resetPendingHirameki();
  _resetPendingMisread();
  usePresentationStore.getState().resetPresentationControls({
    preserveCompletionNotice: options.preserveGameState === true,
  });
  resetPresentationQueue();
}

/** 新しい非同期対戦開始の所有権を発行する。 */
export function beginMatchSession(humanPlayer: 'self' | null = 'self'): MatchSessionToken {
  const token = ++currentGeneration;
  resetMatchSession();
  const sessionId = matchSessionId(token);
  resetPresentationQueue(sessionId);
  startLiveReplayRecording({
    sessionId,
    viewerMode: humanPlayer === null ? 'spectator' : 'solo-self',
  });
  _setHumanPlayerSide(humanPlayer);
  matchSessionActive = true;
  return token;
}

/** Invalidate late async completion and settle prompts. Result routes opt into retaining GameState. */
export function endMatchSession(options: { preserveGameState?: boolean } = {}): void {
  const sessionId = currentGeneration > 0 ? matchSessionId(currentGeneration) : null;
  try {
    if (sessionId !== null) {
      if (options.preserveGameState === true) {
        const finalized = finalizeLiveReplayRecording(sessionId);
        if (!finalized) discardLiveReplayRecording(sessionId);
      } else discardLiveReplayRecording(sessionId);
    }
  } catch {
    // A malformed or oversized recording must only make Replay unavailable.
    // It must never trap a completed match on MATCH or discard its RESULT state.
    if (sessionId !== null) discardLiveReplayRecording(sessionId);
  } finally {
    matchSessionActive = false;
    currentGeneration += 1;
    resetMatchSession(options);
  }
}

/** True only while a setup-owned match session is alive in this runtime. */
export function isMatchSessionActive(): boolean {
  return matchSessionActive;
}

export function isCurrentMatchSession(token: MatchSessionToken): boolean {
  return token === currentGeneration;
}

/** 古いマリガン等が後から完了しても、最新開始の GameState だけを採用する。 */
export function commitMatchSession(token: MatchSessionToken, state: GameState): boolean {
  if (!isCurrentMatchSession(token)) return false;
  return useGameStateStore.getState().setGameState(state);
}
