// BUG-138 (engine拡張 wave#2 cluster2 X8): drainAiEffectPicks の pick 所有権
//
// 従来: playTurn の per-move drain が __pendingEffectPickQueue を所有者無関係に heuristic で
// 解決していたため、CPU ターン中に発火した human 所有の triggered pick (例: 相手ターン中・
// 現場リムーブ時の「〜してもよい」) が human の選択なしに確定していた (横取り)。
// 修正: __humanPlayerSide (BUG-132 で導入済の human 検出 side-channel) が set のとき、
// human 所有 pending は queue に温存し、playTurn は paused:{humanPick:true} を返す。
// useOppTurnDriver が surfacePendingSideChannels で modal へ転送し、解決後に再開する。
// smoke / spectator は __humanPlayerSide 未設定 (null) のため従来挙動 byte-equal。
//
// rules: 15-abilities-effects.md (未解決効果は所有者が解決), 05-turn-phases.md (割り込み禁止)

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { drainAiEffectPicks } from '@/engine/effect/apply-pick';
import {
  _pushPendingEffectPickSideForTest,
  _peekPendingEffectPickQueueLength,
} from '@/engine/effect/resolve-picks';
import { run } from '@/engine/effect/resolver';
import { persistPendingRuntimeState, resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import type { PendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { _setHumanPlayerSide } from '@/engine/listeners/triggered';
import { playTurn } from '@/ai/policy';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import type { EffectCtx, GameState } from '@/engine/types';

function pendingFor(player: 'self' | 'opp'): PendingEffectPickSide {
  return {
    player,
    candidates: [{ uid: `u-${player}`, cardId: 'T-X', player }],
    atomVerb: 'noop',
    atomArgs: {},
    nMin: 0,
    nMax: 1,
    source: { cardId: 'T-X', abilityId: 'a1' },
  };
}

function queue(): PendingEffectPickSide[] {
  return (globalThis as { __pendingEffectPickQueue?: PendingEffectPickSide[] }).__pendingEffectPickQueue ?? [];
}

function queueHumanPickFromResolver(state: GameState): void {
  state.players.self.remove = ['T-X', 'T-Y'];
  run(state, {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'bindPick',
        args: {
          player: 'self',
          cardIds: '$pick.cardIds',
          bind: '$picked',
          target: {
            kind: 'pick',
            query: { area: 'remove', side: 'self' },
            n: { min: 0, max: 1 },
            chooser: 'self',
          },
        },
      },
      { kind: 'atom', verb: 'noop', args: {} },
    ],
  } as never, {
    source: { player: 'self', area: 'remove', cardId: 'T-X' },
    bindings: {},
  } as EffectCtx);
}

describe('BUG-138: drainAiEffectPicks の pick 所有権 (X8)', () => {
  beforeEach(() => {
    resetPendingRuntimeState();
    _setHumanPlayerSide(null);
  });
  afterEach(() => {
    resetPendingRuntimeState();
    _setHumanPlayerSide(null);
  });

  it('humanSide=self: self 所有 pending は温存、opp 所有は drain される', () => {
    _setHumanPlayerSide('self');
    _pushPendingEffectPickSideForTest(pendingFor('self'));
    _pushPendingEffectPickSideForTest(pendingFor('opp'));
    const s = createEmptyGameState();
    drainAiEffectPicks(s, new HeuristicPolicy());
    expect(_peekPendingEffectPickQueueLength()).toBe(1);
    expect(queue()[0]!.player).toBe('self');
  });

  it('humanSide=null (smoke / spectator): 全 pending を従来通り drain (回帰)', () => {
    _pushPendingEffectPickSideForTest(pendingFor('self'));
    _pushPendingEffectPickSideForTest(pendingFor('opp'));
    const s = createEmptyGameState();
    drainAiEffectPicks(s, new HeuristicPolicy());
    expect(_peekPendingEffectPickQueueLength()).toBe(0);
  });

  it('human pending の後ろに積まれた AI 所有 pending も drain される (FIFO 温存 skip)', () => {
    _setHumanPlayerSide('self');
    _pushPendingEffectPickSideForTest(pendingFor('self'));
    _pushPendingEffectPickSideForTest(pendingFor('opp'));
    _pushPendingEffectPickSideForTest(pendingFor('opp'));
    const s = createEmptyGameState();
    drainAiEffectPicks(s, new HeuristicPolicy());
    expect(_peekPendingEffectPickQueueLength()).toBe(1);
    expect(queue()[0]!.player).toBe('self');
  });

  it('playTurn: human 所有 pending が残っている間は move を打たず paused:{humanPick} を返す', () => {
    _setHumanPlayerSide('self');
    let s: GameState = createEmptyGameState();
    s = { ...s, turn: { ...s.turn, player: 'opp' } };
    queueHumanPickFromResolver(s);
    expect(_peekPendingEffectPickQueueLength()).toBe(1);
    persistPendingRuntimeState(s);
    expect(s.pendingRuntimeState?.snapshot.find(entry => entry.key === '__pendingEffectPickQueue')).toMatchObject({ present: true });

    resetPendingRuntimeState();
    expect(_peekPendingEffectPickQueueLength()).toBe(0);
    const result = playTurn(s, new HeuristicPolicy(), 'opp', { pauseOnAction: true });
    expect(result.paused?.humanPick).toBe(true);
    expect(result.moves).toHaveLength(0);
    expect(_peekPendingEffectPickQueueLength()).toBe(1); // 横取りされていない
    expect(result.finalState.pendingRuntimeState?.snapshot.find(entry => entry.key === '__pendingEffectPickQueue')).toMatchObject({ present: true });
  });

  it('playTurn 回帰: humanSide=null なら humanPick pause しない', () => {
    _pushPendingEffectPickSideForTest(pendingFor('self'));
    let s: GameState = createEmptyGameState();
    s = { ...s, turn: { ...s.turn, player: 'opp' } };
    const result = playTurn(s, new HeuristicPolicy(), 'opp', { pauseOnAction: true });
    expect(result.paused?.humanPick).toBeUndefined();
  });
});
