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
import { stepTurn } from '@/ai/policy.js';
import { replayLog, ScriptedPolicy } from '@/ai/replay/player.js';
import { replayNondeterminism } from '@/ai/replay/nondeterminism.js';
import { withHeadlessDecisionContext } from '@/ai/headless-decision-context.js';
import { withIsolatedPendingRuntimeState } from '@/engine/effect/runtime-state.js';
import { produce } from '@/engine/produce';
import { engine } from '@/engine';
import type { GameState } from '@/engine/types';
import { useGameStateStore } from '@/ui/state/store.js';

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
  loadLog: (log: ReplayLog) => void;
  unloadLog: () => void;
  play: () => void;
  pause: () => void;
  step: () => void;
  seek: (idx: number) => void;
  setSpeed: (ms: number) => void;
};

/** initialState から moves[0..upto-1] を apply した結果の GameState を返す */
export function computeStateAt(log: ReplayLog, upto: number): GameState {
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
  const runHeadless = (): GameState => withHeadlessDecisionContext(() =>
    withIsolatedPendingRuntimeState(log.initialState, run));
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

  const applyStateToStore = useCallback((newLog: ReplayLog | null, idx: number) => {
    if (!newLog) {
      // unload: store.gameState を null に戻すとセットアップ画面に戻るため、
      // ユーザーが対戦をしていない前提なら null。安全側で null は touch しない。
      return;
    }
    const st = computeStateAt(newLog, idx);
    useGameStateStore.getState().setGameState(st);
  }, []);

  const loadLog = useCallback((newLog: ReplayLog) => {
    replayLog(newLog);
    setLog(newLog);
    currentMoveIndexRef.current = 0;
    setCurrentMoveIndex(0);
    setIsPlaying(false);
    applyStateToStore(newLog, 0);
  }, [applyStateToStore]);

  const unloadLog = useCallback(() => {
    setLog(null);
    currentMoveIndexRef.current = 0;
    setCurrentMoveIndex(0);
    setIsPlaying(false);
  }, []);

  const step = useCallback(() => {
    if (!log) return;
    const next = Math.min(currentMoveIndexRef.current + 1, log.moves.length);
    applyStateToStore(log, next);
    currentMoveIndexRef.current = next;
    setCurrentMoveIndex(next);
  }, [log, applyStateToStore]);

  const seek = useCallback((idx: number) => {
    if (!log) return;
    const clamped = Math.max(0, Math.min(idx, log.moves.length));
    applyStateToStore(log, clamped);
    currentMoveIndexRef.current = clamped;
    setCurrentMoveIndex(clamped);
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
    intervalRef.current = setInterval(() => {
      const current = currentMoveIndexRef.current;
      if (current >= log.moves.length) {
        setIsPlaying(false);
        return;
      }
      const next = current + 1;
      applyStateToStore(log, next);
      currentMoveIndexRef.current = next;
      setCurrentMoveIndex(next);
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
