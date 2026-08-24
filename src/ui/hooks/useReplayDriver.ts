// Phase 9-G.2 (Cleanup 7-A): リプレイ playback driver hook
//
// 役割:
//   - ReplayLog (Phase 9-G.1 で記録) を読み込み、UI 経由で playback 制御
//   - play / pause / step / seek / setSpeed API を提供
//   - 現在の state を store にも書き込み、Playmat が表示
//
// 設計:
//   - currentMoveIndex (0..moves.length-1) を hold
//   - step(): 1 move 進めて state 更新
//   - play(): setInterval で speed ms ごとに step
//   - pause(): interval clear
//   - seek(i): initialState から i-1 まで再 apply して state 更新
//   - 終了後: gameResult が set されている state で停止

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReplayLog } from '@/ai/replay/recorder.js';
import { decodeReplayLog } from '@/ai/replay/decode.js';
import {
  replayStateAt,
  replayStates,
  replayStepCount,
  type ReplayViewerMode,
} from '@/ai/replay/state-frame.js';
import { stepTurn } from '@/ai/policy.js';
import { replayLog, ScriptedPolicy } from '@/ai/replay/player.js';
import { replayNondeterminism } from '@/ai/replay/nondeterminism.js';
import { withHeadlessDecisionContext } from '@/ai/headless-decision-context.js';
import { withLegacyReplayCompatibility } from '@/engine/flow/action/legacy-replay-compat.js';
import { withIsolatedPendingRuntimeState } from '@/engine/effect/runtime-state.js';
import { produce } from '@/engine/produce';
import { engine } from '@/engine';
import type { GameState } from '@/engine/types';
import {
  prepareGameStateForStore,
  useGameStateStore,
} from '@/ui/state/store.js';
import {
  currentPresentationSessionId,
  rebuildPresentationAtCurrentState,
  resetPresentationQueue,
  validatePresentationAtCurrentState,
} from '@/ui/presentation/coordinator';
import { markReplayOwnedState } from '@/ui/services/replayOwnership';
import { endMatchSession } from '@/ui/services/matchSession';
import {
  projectReplayLogForViewer,
  projectReplayStateForViewer,
} from '@/ui/services/replayViewerProjection';

export type ReplayDriverState = {
  /** loaded log (null = no replay loaded) */
  log: ReplayLog | null;
  /** 現在の move 進行 index (0 = initialState、log.moves.length = final state) */
  currentMoveIndex: number;
  /** play 中なら true */
  isPlaying: boolean;
  /** 再生間隔 ms (default 600) */
  speedMs: number;
};

export type ReplayDriverApi = {
  state: ReplayDriverState;
  loadLog: (log: unknown) => void;
  unloadLog: () => void;
  play: () => void;
  pause: () => void;
  step: () => void;
  seek: (idx: number) => void;
  setSpeed: (ms: number) => void;
};

export function replayViewerModeForLog(log: ReplayLog | null): ReplayViewerMode | undefined {
  if (log === null) return undefined;
  return log.schemaVersion === 3 ? log.viewerMode : 'solo-self';
}

export function replayTotalSteps(log: ReplayLog): number {
  if (log.schemaVersion === 3) return replayStepCount(log);
  if (log.schemaVersion === 1 || log.schemaVersion === 2) return log.moves.length;
  throw new Error('Unsupported replay schema version');
}

/** initialState から moves[0..upto-1] を apply した結果の GameState を返す */
export function computeStateAt(log: ReplayLog, upto: number): GameState {
  if (log.schemaVersion === 3) return replayStateAt(log, upto);
  if (log.schemaVersion !== 1 && log.schemaVersion !== 2) throw new Error('Unsupported replay schema version');
  const bounded = Math.max(0, Math.min(upto, log.moves.length));
  if (bounded === log.moves.length) return replayLog(log).finalState;
  const run = (): GameState => {
    let state = log.initialState;
    for (let i = 0; i < bounded; i++) {
      const recorded = log.moves[i];
      if (state.turn.number !== recorded.turn) {
        throw new Error(
          `replay turn mismatch at move ${i}: expected ${recorded.turn}, got ${state.turn.number}`,
        );
      }
      if (state.turn.player !== recorded.player) {
        throw new Error(
          `replay player mismatch at move ${i}: expected ${state.turn.player}, got ${recorded.player}`,
        );
      }
      const policy = new ScriptedPolicy(`replay-ui-${i}`, [recorded.move]);
      const step = stepTurn(state, policy, recorded.player);
      if (policy.remaining() !== 0 || !step.move) {
        throw new Error(`replay move ${i} was not consumed`);
      }
      state = step.nextState;
      if (recorded.move.kind === 'endTurn' && !state.gameResult) {
        state = produce(state, (draft) => {
          engine.flow.endTurn(draft, recorded.player, { startNextTurn: true });
          engine.resolve.runAllUntilEmpty(draft);
        });
      }
      if (state.gameResult) break;
    }
    return state;
  };
  const runHeadless = (): GameState => withLegacyReplayCompatibility(() =>
    withHeadlessDecisionContext(() =>
      withIsolatedPendingRuntimeState(log.initialState, run)));
  return log.schemaVersion === 2
    ? replayNondeterminism(log.nondeterminism, runHeadless, { requireAll: bounded === log.moves.length })
    : runHeadless();
}

export function useReplayDriver(): ReplayDriverApi {
  const [log, setLog] = useState<ReplayLog | null>(null);
  const [currentMoveIndex, setCurrentMoveIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speedMs, setSpeedMs] = useState<number>(600);
  const currentMoveIndexRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playbackGenerationRef = useRef<number>(0);
  const ownedReplayStateRef = useRef<GameState | null>(null);
  const ownedPresentationSessionRef = useRef<string | null>(null);
  const preparedReplayStatesRef = useRef<GameState[] | null>(null);
  const loadedStepCountRef = useRef<number>(0);

  const applyStateToStore = useCallback((
    newLog: ReplayLog | null,
    idx: number,
    allowClaim = false,
  ): boolean => {
    if (!newLog) {
      // unload: store.gameState を null に戻すとセットアップ画面に戻るため、
      // ユーザーが対戦をしていない前提なら null。安全側で null は touch しない。
      return false;
    }
    const store = useGameStateStore.getState();
    const owned = ownedReplayStateRef.current;
    const ownsPresentation = ownedPresentationSessionRef.current !== null
      && currentPresentationSessionId() === ownedPresentationSessionRef.current;
    if (!allowClaim && (owned === null || store.gameState !== owned || !ownsPresentation)) {
      return false;
    }
    const cachedState = preparedReplayStatesRef.current?.[idx];
    if (!cachedState) throw new Error('Replay frame cache is unavailable');
    const st = structuredClone(cachedState);
    validatePresentationAtCurrentState(st);
    rebuildPresentationAtCurrentState(st);
    store.setReplayGameState(st);
    ownedReplayStateRef.current = useGameStateStore.getState().gameState;
    ownedPresentationSessionRef.current = currentPresentationSessionId();
    if (ownedReplayStateRef.current !== null) markReplayOwnedState(ownedReplayStateRef.current);
    return true;
  }, []);

  const loadLog = useCallback((input: unknown) => {
    let newLog = decodeReplayLog(input);
    if (newLog.schemaVersion === 3) {
      // Retain only the viewer-safe artifact. Playback frames were already
      // projected below, but keeping the raw imported V3 in React state would
      // leave hidden identities available to future replay UI consumers.
      newLog = projectReplayLogForViewer(newLog);
    }
    const currentState = useGameStateStore.getState().gameState;
    const stillOwnsCurrentResources = ownedReplayStateRef.current !== null
      && currentState === ownedReplayStateRef.current
      && ownedPresentationSessionRef.current !== null
      && currentPresentationSessionId() === ownedPresentationSessionRef.current;
    if (currentState !== null && !stillOwnsCurrentResources) {
      throw new Error('Cannot load replay over an active match');
    }
    let sourceStates: GameState[];
    let viewerMode: 'solo-self' | 'spectator';
    if (newLog.schemaVersion === 3) {
      sourceStates = replayStates(newLog);
      viewerMode = newLog.viewerMode;
    } else if (newLog.schemaVersion === 1 || newLog.schemaVersion === 2) {
      replayLog(newLog);
      sourceStates = Array.from(
        { length: newLog.moves.length + 1 },
        (_entry, index) => computeStateAt(newLog, index),
      );
      // Legacy local replay files predate viewer metadata. Preserve the
      // owner's own hand while treating every opposing identity as hidden.
      viewerMode = 'solo-self';
    } else {
      throw new Error('Unsupported replay schema version');
    }
    const preparedStates = sourceStates.map((state) => {
      // Imported frames are playback data, never resumable resolver authority.
      // Remove continuations before store preparation can hydrate live globals.
      const projected = projectReplayStateForViewer(state, viewerMode);
      const validState = prepareGameStateForStore(projected).gameState;
      validatePresentationAtCurrentState(validState);
      return validState;
    });
    // Replay is a distinct runtime session. Invalidate any async match start
    // before claiming GameState so a late commit cannot overwrite playback.
    endMatchSession();
    ownedReplayStateRef.current = null;
    ownedPresentationSessionRef.current = null;
    preparedReplayStatesRef.current = preparedStates;
    loadedStepCountRef.current = newLog.schemaVersion === 3 ? newLog.frames.length : newLog.moves.length;
    playbackGenerationRef.current += 1;
    const retainedLog: ReplayLog = newLog.schemaVersion === 3
      ? newLog
      : {
          ...structuredClone(newLog),
          initialState: projectReplayStateForViewer(newLog.initialState, 'solo-self'),
        };
    setLog(structuredClone(retainedLog));
    currentMoveIndexRef.current = 0;
    setCurrentMoveIndex(0);
    setIsPlaying(false);
    applyStateToStore(newLog, 0, true);
  }, [applyStateToStore]);

  const unloadLog = useCallback(() => {
    playbackGenerationRef.current += 1;
    const store = useGameStateStore.getState();
    const ownsState = ownedReplayStateRef.current !== null
      && store.gameState === ownedReplayStateRef.current;
    const ownsPresentation = ownedPresentationSessionRef.current !== null
      && currentPresentationSessionId() === ownedPresentationSessionRef.current;
    if (ownsState && ownsPresentation) resetPresentationQueue();
    if (ownsState) {
      store.setReplayGameState(null);
    }
    ownedReplayStateRef.current = null;
    ownedPresentationSessionRef.current = null;
    preparedReplayStatesRef.current = null;
    loadedStepCountRef.current = 0;
    setLog(null);
    currentMoveIndexRef.current = 0;
    setCurrentMoveIndex(0);
    setIsPlaying(false);
  }, []);

  useEffect(() => () => {
    playbackGenerationRef.current += 1;
    const store = useGameStateStore.getState();
    const ownsState = ownedReplayStateRef.current !== null
      && store.gameState === ownedReplayStateRef.current;
    const ownsPresentation = ownedPresentationSessionRef.current !== null
      && currentPresentationSessionId() === ownedPresentationSessionRef.current;
    if (ownsState && ownsPresentation) resetPresentationQueue();
    if (ownsState) {
      store.setReplayGameState(null);
    }
    ownedReplayStateRef.current = null;
    ownedPresentationSessionRef.current = null;
    preparedReplayStatesRef.current = null;
    loadedStepCountRef.current = 0;
  }, []);

  const step = useCallback(() => {
    if (!log) return;
    const next = Math.min(currentMoveIndexRef.current + 1, loadedStepCountRef.current);
    if (!applyStateToStore(log, next)) return;
    currentMoveIndexRef.current = next;
    setCurrentMoveIndex(next);
  }, [log, applyStateToStore]);

  const seek = useCallback((idx: number) => {
    if (!log) return;
    const total = loadedStepCountRef.current;
    if (!Number.isSafeInteger(idx) || idx < 0 || idx > total) {
      throw new Error('Replay seek index out of range');
    }
    playbackGenerationRef.current += 1;
    setIsPlaying(false);
    if (!applyStateToStore(log, idx)) return;
    currentMoveIndexRef.current = idx;
    setCurrentMoveIndex(idx);
  }, [log, applyStateToStore]);

  const play = useCallback(() => {
    if (!log) return;
    setIsPlaying(true);
  }, [log]);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  // play / pause + interval 管理
  useEffect(() => {
    if (!isPlaying || !log) {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return undefined;
    }
    const generation = playbackGenerationRef.current;
    intervalRef.current = setInterval(() => {
      if (generation !== playbackGenerationRef.current) return;
      const current = currentMoveIndexRef.current;
      if (current >= loadedStepCountRef.current) {
        setIsPlaying(false);
        return;
      }
      const next = current + 1;
      if (!applyStateToStore(log, next)) {
        setIsPlaying(false);
        return;
      }
      currentMoveIndexRef.current = next;
      setCurrentMoveIndex(next);
      // Playback terminal frames are display-only. Stop immediately so a
      // replay timer cannot remain live after the final result projection.
      if (useGameStateStore.getState().gameState?.gameResult !== undefined
        || next >= loadedStepCountRef.current) {
        setIsPlaying(false);
      }
    }, speedMs);
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, log, speedMs, applyStateToStore]);

  return {
    state: { log, currentMoveIndex, isPlaying, speedMs },
    loadLog,
    unloadLog,
    play,
    pause,
    step,
    seek,
    setSpeed: setSpeedMs,
  };
}
