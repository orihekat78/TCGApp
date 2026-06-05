// BUG-121 残課題解消: sequence 内の human 複数択 choice が、pre-choice step を二重実行せず
// 正しく pause → choiceResolve 再開で option + post-choice step のみ実行されることを engine レベルで検証。
//
// 設計 (resolve-picks.ts / apply-pick.ts):
//   - resolveEffectPicks sequence case が choice pause を検知したら remainder を再開 holder
//     (__pendingEffectChoiceResume) に {sequence:[choice, ...remainder]} で wrap し walk を打ち切る。
//   - 初回 runtime は pre-choice step のみ実行。choiceResolve で holder を再 walk し option + remainder 実行。
//
// rules: 15-abilities-effects.md

import { describe, it, expect, beforeEach } from 'vitest';
import {
  resolveEffectPicks,
  _drainPendingEffectChoiceSide,
  _clearPendingEffectChoiceSide,
  _clearPendingEffectPickQueue,
  _peekPendingEffectChoiceSide,
} from '@/engine/effect/resolve-picks';
import { applyChoiceAndContinuation } from '@/engine/effect/apply-pick';
import { run as runEffect } from '@/engine/effect/resolver';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { EffectCtx, GameState } from '@/engine/types';

function ctxSelf(): EffectCtx {
  return {
    source: { player: 'self', cardId: 'SEQX', uid: 'sx#1', abilityId: 'a1', area: 'scene' },
    bindings: {},
  } as unknown as EffectCtx;
}

function stateWithDeck(n: number): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.self.deck = Array.from({ length: n }, (_, i) => `X${i}`);
  s.players.self.hand = [];
  return s;
}

describe('BUG-121 残課題: sequence 内 human choice (pre-step 二重実行なし)', () => {
  beforeEach(() => {
    _clearPendingEffectPickQueue();
    _clearPendingEffectChoiceSide();
    (globalThis as { __pendingChainContinuation?: unknown[] }).__pendingChainContinuation = [];
  });

  // sequence: [draw1, choice(draw2 / draw4), draw8]
  const eff = {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      { kind: 'choice', chooser: 'self', options: [
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 2 } },
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 4 } },
      ] },
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 8 } },
    ],
  };

  it('初回 walk+run は pre-choice (draw1) のみ実行し choice で pause、resume holder に remainder 保持', () => {
    const s = stateWithDeck(30);
    const walked = resolveEffectPicks(s, eff as never, ctxSelf(), {
      humanChooser: true, byPlayer: 'self', source: { cardId: 'SEQX', abilityId: 'a1' },
    });
    // 初回 runtime: pre-choice step のみ実行 (choice step は no-op、post-choice は truncate で未含)
    runEffect(s, walked as never, ctxSelf());
    runAllUntilEmpty(s);
    expect(s.players.self.hand.length, 'draw1 のみ実行 (draw2/4/8 は未実行)').toBe(1);
    // choice が surface
    const side = _peekPendingEffectChoiceSide();
    expect(side, 'pendingEffectChoice surface').not.toBeNull();
    expect(side?.options.length).toBe(2);
  });

  it('choiceResolve(index=1) で option1 (draw4) + post-choice (draw8) のみ実行 (draw1 二重実行なし)', () => {
    const s = stateWithDeck(30);
    const walked = resolveEffectPicks(s, eff as never, ctxSelf(), {
      humanChooser: true, byPlayer: 'self', source: { cardId: 'SEQX', abilityId: 'a1' },
    });
    runEffect(s, walked as never, ctxSelf());
    runAllUntilEmpty(s);
    expect(s.players.self.hand.length).toBe(1); // draw1

    // choiceResolve: option1 (draw4) を選択 → option1 + post-choice (draw8) 実行
    const pending = _drainPendingEffectChoiceSide()!;
    expect(pending).not.toBeNull();
    applyChoiceAndContinuation(s, pending, 1);

    // hand = draw1(1) + option1 draw4(4) + post draw8(8) = 13。draw1 は二重実行されない。
    expect(s.players.self.hand.length, 'draw1 + draw4 + draw8 = 13 (draw1 二重実行なし)').toBe(13);
  });

  it('choiceResolve(index=0) なら option0 (draw2) + post (draw8) = 1+2+8 = 11', () => {
    const s = stateWithDeck(30);
    const walked = resolveEffectPicks(s, eff as never, ctxSelf(), {
      humanChooser: true, byPlayer: 'self', source: { cardId: 'SEQX', abilityId: 'a1' },
    });
    runEffect(s, walked as never, ctxSelf());
    runAllUntilEmpty(s);
    const pending = _drainPendingEffectChoiceSide()!;
    applyChoiceAndContinuation(s, pending, 0);
    expect(s.players.self.hand.length, 'draw1(1) + draw2(2) + draw8(8) = 11').toBe(11);
  });
});
